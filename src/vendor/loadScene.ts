import { restore } from "@excalidraw/excalidraw";
import type {
  ImportedDataState
} from "@excalidraw/excalidraw/types/data/types";

const t = (s: string) => s;

const BACKEND_GET = "https://json.excalidraw.com/api/v1/";
const BACKEND_V2_GET = "https://json.excalidraw.com/api/v2/";
const IV_LENGTH_BYTES = 12; // 96 bits

const getImportedKey = (key: string, usage: KeyUsage) =>
  window.crypto.subtle.importKey(
    "jwk",
    {
      alg: "A128GCM",
      ext: true,
      k: key,
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    },
    {
      name: "AES-GCM",
      length: 128,
    },
    false, // extractable
    [usage],
  );
const decryptImported = async (
  iv: ArrayBuffer,
  encrypted: ArrayBuffer,
  privateKey: string,
): Promise<ArrayBuffer> => {
  const key = await getImportedKey(privateKey, "decrypt");
  return window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encrypted,
  );
};

const importFromBackend = async (
  id: string | null,
  privateKey?: string | null,
): Promise<ImportedDataState> => {
  try {
    const response = await fetch(
      privateKey ? `${BACKEND_V2_GET}${id}` : `${BACKEND_GET}${id}.json`,
    );

    if (!response.ok) {
      window.alert(t("alerts.importBackendFailed"));
      return {};
    }
    let data: ImportedDataState;
    if (privateKey) {
      const buffer = await response.arrayBuffer();

      let decrypted: ArrayBuffer;
      try {
        // Buffer should contain both the IV (fixed length) and encrypted data
        const iv = buffer.slice(0, IV_LENGTH_BYTES);
        const encrypted = buffer.slice(IV_LENGTH_BYTES, buffer.byteLength);
        decrypted = await decryptImported(iv, encrypted, privateKey);
      } catch (error) {
        // Fixed IV (old format, backward compatibility)
        const fixedIv = new Uint8Array(IV_LENGTH_BYTES);
        decrypted = await decryptImported(fixedIv, buffer, privateKey);
      }

      // We need to convert the decrypted array buffer to a string
      const string = new window.TextDecoder("utf-8").decode(
        new Uint8Array(decrypted) as any,
      );
      data = JSON.parse(string);
    } else {
      // Legacy format
      data = await response.json();
    }

    return {
      elements: data.elements || null,
      appState: data.appState || null,
    };
  } catch (error) {
    window.alert(t("alerts.importBackendFailed"));
    console.error(error);
    return {};
  }
};

export const loadScene = async (
  id: string | null,
  privateKey: string | null,
  // Supply local state even if importing from backend to ensure we restore
  // localStorage user settings which we do not persist on server.
  // Non-optional so we don't forget to pass it even if `undefined`.
  localDataState: ImportedDataState | undefined | null,
) => {
  let data: ReturnType<typeof restore>;
  if (id != null) {
    // the private key is used to decrypt the content from the server, take
    // extra care not to leak it
    data = restore(
      await importFromBackend(id, privateKey),
      localDataState?.appState,
      null,
    );
  } else {
    data = restore(localDataState || null, null, null);
  }

  return {
    elements: data.elements,
    appState: data.appState,
    commitToHistory: false,
  };
};
