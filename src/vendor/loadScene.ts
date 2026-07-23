/* eslint-disable @typescript-eslint/no-explicit-any */

import { inflate } from 'pako';
import { restore } from '@excalidraw/excalidraw';
import type { ImportedDataState } from '@excalidraw/excalidraw/data/types';

const t = (s: string) => s;

// const BACKEND_GET = "https://json.excalidraw.com/api/v1/";
const BACKEND_V2_GET = 'https://json.excalidraw.com/api/v2/';
const IV_LENGTH_BYTES = 12; // 96 bits
const ENCRYPTION_KEY_BITS = 128;
const CONCAT_BUFFERS_VERSION = 1;
const VERSION_DATAVIEW_BYTES = 4;
const NEXT_CHUNK_SIZE_DATAVIEW_BYTES = 4;
const DATA_VIEW_BITS_MAP = { 1: 8, 2: 16, 4: 32 } as const;

function dataView(buffer: Uint8Array, bytes: 1 | 2 | 4, offset: number): number;
function dataView(
  buffer: Uint8Array,
  bytes: 1 | 2 | 4,
  offset: number,
  value: number,
): Uint8Array;
function dataView(
  buffer: Uint8Array,
  bytes: 1 | 2 | 4,
  offset: number,
  value?: number,
): Uint8Array | number {
  if (value != null) {
    if (value > Math.pow(2, DATA_VIEW_BITS_MAP[bytes]) - 1) {
      throw new Error(
        `attempting to set value higher than the allocated bytes (value: ${value}, bytes: ${bytes})`,
      );
    }
    const method = `setUint${DATA_VIEW_BITS_MAP[bytes]}` as const;
    new DataView(buffer.buffer)[method](offset, value);
    return buffer;
  }
  const method = `getUint${DATA_VIEW_BITS_MAP[bytes]}` as const;
  return new DataView(buffer.buffer)[method](offset);
}

const splitBuffers = (concatenatedBuffer: Uint8Array) => {
  const buffers = [];

  let cursor = 0;

  // first chunk is the version
  const version = dataView(
    concatenatedBuffer,
    NEXT_CHUNK_SIZE_DATAVIEW_BYTES,
    cursor,
  );
  // If version is outside of the supported versions, throw an error.
  // This usually means the buffer wasn't encoded using this API, so we'd only
  // waste compute.
  if (version > CONCAT_BUFFERS_VERSION) {
    throw new Error(`invalid version ${version}`);
  }

  cursor += VERSION_DATAVIEW_BYTES;

  while (true) {
    const chunkSize = dataView(
      concatenatedBuffer,
      NEXT_CHUNK_SIZE_DATAVIEW_BYTES,
      cursor,
    );
    cursor += NEXT_CHUNK_SIZE_DATAVIEW_BYTES;

    buffers.push(concatenatedBuffer.slice(cursor, cursor + chunkSize));
    cursor += chunkSize;
    if (cursor >= concatenatedBuffer.byteLength) {
      break;
    }
  }

  return buffers;
};

type FileEncodingInfo = {
  /* version 2 is the version we're shipping the initial image support with.
    version 1 was a PR version that a lot of people were using anyway.
    Thus, if there are issues we can check whether they're not using the
    unoffic version */
  version: 1 | 2;
  compression: 'pako@1' | null;
  encryption: 'AES-GCM' | null;
};

const getCryptoKey = (key: string, usage: KeyUsage) =>
  window.crypto.subtle.importKey(
    'jwk',
    {
      alg: 'A128GCM',
      ext: true,
      k: key,
      key_ops: ['encrypt', 'decrypt'],
      kty: 'oct',
    },
    {
      name: 'AES-GCM',
      length: ENCRYPTION_KEY_BITS,
    },
    false, // extractable
    [usage],
  );

const decryptData = async (
  iv: Uint8Array<ArrayBuffer>,
  encrypted: Uint8Array<ArrayBuffer> | ArrayBuffer,
  privateKey: string,
): Promise<ArrayBuffer> => {
  const key = await getCryptoKey(privateKey, 'decrypt');
  return window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encrypted,
  );
};

const _decryptAndDecompress = async (
  iv: Uint8Array<ArrayBuffer>,
  decryptedBuffer: Uint8Array<ArrayBuffer>,
  decryptionKey: string,
  isCompressed: boolean,
) => {
  decryptedBuffer = new Uint8Array(
    await decryptData(iv, decryptedBuffer, decryptionKey),
  );

  if (isCompressed) {
    return inflate(decryptedBuffer);
  }

  return decryptedBuffer;
};

const decompressData = async <T extends Record<string, any>>(
  bufferView: Uint8Array,
  options: { decryptionKey: string },
) => {
  // first chunk is encoding metadata (ignored for now)
  const [encodingMetadataBuffer, iv, buffer] = splitBuffers(bufferView);

  const encodingMetadata: FileEncodingInfo = JSON.parse(
    new TextDecoder().decode(encodingMetadataBuffer),
  );

  try {
    const [contentsMetadataBuffer, contentsBuffer] = splitBuffers(
      await _decryptAndDecompress(
        iv,
        buffer,
        options.decryptionKey,
        !!encodingMetadata.compression,
      ),
    );

    const metadata = JSON.parse(
      new TextDecoder().decode(contentsMetadataBuffer),
    ) as T;

    return {
      /** metadata source is always JSON so we can decode it here */
      metadata,
      /** data can be anything so the caller must decode it */
      data: contentsBuffer,
    };
  } catch (error: any) {
    console.error(
      `Error during decompressing and decrypting the file.`,
      encodingMetadata,
    );
    throw error;
  }
};

const legacy_decodeFromBackend = async ({
  buffer,
  decryptionKey,
}: {
  buffer: ArrayBuffer;
  decryptionKey: string;
}) => {
  let decrypted: ArrayBuffer;

  try {
    // Buffer should contain both the IV (fixed length) and encrypted data
    const iv = buffer.slice(0, IV_LENGTH_BYTES);
    const encrypted = buffer.slice(IV_LENGTH_BYTES, buffer.byteLength);
    decrypted = await decryptData(new Uint8Array(iv), encrypted, decryptionKey);
  } catch {
    // Fixed IV (old format, backward compatibility)
    const fixedIv = new Uint8Array(IV_LENGTH_BYTES);
    decrypted = await decryptData(fixedIv, buffer, decryptionKey);
  }

  // We need to convert the decrypted array buffer to a string
  const string = new window.TextDecoder('utf-8').decode(
    new Uint8Array(decrypted),
  );
  const data: ImportedDataState = JSON.parse(string);

  return {
    elements: data.elements || null,
    appState: data.appState || null,
  };
};

const importFromBackend = async (
  id: string,
  decryptionKey: string,
): Promise<ImportedDataState> => {
  try {
    const response = await fetch(`${BACKEND_V2_GET}${id}`);

    if (!response.ok) {
      window.alert(t('alerts.importBackendFailed'));
      return {};
    }
    const buffer = await response.arrayBuffer();

    try {
      const { data: decodedBuffer } = await decompressData(
        new Uint8Array(buffer),
        {
          decryptionKey,
        },
      );
      const data: ImportedDataState = JSON.parse(
        new TextDecoder().decode(decodedBuffer),
      );

      return {
        elements: data.elements || null,
        appState: data.appState || null,
      };
    } catch (error: any) {
      console.warn(
        'error when decoding shareLink data using the new format:',
        error,
      );
      return legacy_decodeFromBackend({ buffer, decryptionKey });
    }
  } catch (error: any) {
    window.alert(t('alerts.importBackendFailed'));
    console.error(error);
    return {};
  }
};

const FIREBASE_FILES_URL =
  'https://firebasestorage.googleapis.com/v0/b/excalidraw-production.appspot.com/o/files%2F';

const getMimeTypeFromBuffer = (buffer: Uint8Array): string => {
  if (buffer.length >= 4) {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'image/gif';
    }
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    ) {
      return 'image/webp';
    }
    if (buffer[0] === 0x3c) {
      return 'image/svg+xml';
    }
  }
  return 'image/png';
};

const arrayBufferToDataUrl = (buffer: Uint8Array, mimeType: string) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  return `data:${mimeType};base64,${base64}`;
};

export const fetchAndDecryptFile = async (
  fileId: string,
  privateKey: string,
) => {
  const urls = [
    `${FIREBASE_FILES_URL}${fileId}?alt=media`,
    `${BACKEND_V2_GET}files/${fileId}`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      try {
        const { metadata, data } = await decompressData<{
          mimeType?: string;
          id?: string;
          created?: number;
        }>(uint8, { decryptionKey: privateKey });
        const mimeType = metadata?.mimeType || getMimeTypeFromBuffer(data);
        const dataURL = arrayBufferToDataUrl(data, mimeType);
        return {
          id: fileId,
          dataURL,
          mimeType,
          created: metadata?.created || Date.now(),
        };
      } catch {
        const iv = uint8.slice(0, IV_LENGTH_BYTES);
        const encrypted = uint8.slice(IV_LENGTH_BYTES);
        const decrypted = new Uint8Array(
          await decryptData(iv, encrypted, privateKey),
        );
        const mimeType = getMimeTypeFromBuffer(decrypted);
        const dataURL = arrayBufferToDataUrl(decrypted, mimeType);
        return {
          id: fileId,
          dataURL,
          mimeType,
          created: Date.now(),
        };
      }
    } catch (e) {
      console.warn(`Failed to fetch/decrypt file ${fileId} from ${url}:`, e);
    }
  }
  return null;
};

export const loadScene = async (
  id: string | null,
  privateKey: string | null,
  // Supply local state even if importing from backend to ensure we restore
  // localStorage user settings which we do not persist on server.
  // Non-optional so we don't forget to pass it even if `undefined`.
  localDataState: ImportedDataState | undefined | null,
) => {
  let data;
  if (id != null && privateKey != null) {
    // the private key is used to decrypt the content from the server, take
    // extra care not to leak it
    data = restore(
      await importFromBackend(id, privateKey),
      localDataState?.appState,
      localDataState?.elements,
    );
  } else {
    data = restore(localDataState || null, null, null);
  }

  const files: Record<string, any> = { ...(data.files || {}) };

  if (id != null && privateKey != null && data.elements) {
    const fileIds = new Set<string>();
    data.elements.forEach((el: any) => {
      if (el.type === 'image' && el.fileId && !files[el.fileId]) {
        fileIds.add(el.fileId);
      }
    });

    if (fileIds.size > 0) {
      const fetchedFiles = await Promise.all(
        Array.from(fileIds).map((fileId) =>
          fetchAndDecryptFile(fileId, privateKey),
        ),
      );
      fetchedFiles.forEach((file) => {
        if (file) {
          files[file.id] = file;
        }
      });
    }
  }

  return {
    elements: data.elements,
    appState: data.appState,
    files,
    commitToHistory: false,
  };
};
