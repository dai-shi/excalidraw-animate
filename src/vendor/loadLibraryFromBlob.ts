import type { ImportedLibraryData } from "@excalidraw/excalidraw/types/data/types";

const t = (s: string) => s;

const EXPORT_DATA_TYPES = {
  excalidraw: "excalidraw",
  excalidrawClipboard: "excalidraw/clipboard",
  excalidrawLibrary: "excalidrawlib",
} as const;

const parseFileContents = async (blob: Blob | File) => {
  let contents: string;
  if ("text" in Blob) {
    contents = await blob.text();
  } else {
    contents = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsText(blob, "utf8");
      reader.onloadend = () => {
        if (reader.readyState === FileReader.DONE) {
          resolve(reader.result as string);
        }
      };
    });
  }
  return contents;
};

export const loadLibraryFromBlob = async (blob: Blob) => {
  const contents = await parseFileContents(blob);
  const data: ImportedLibraryData = JSON.parse(contents);
  if (data.type !== EXPORT_DATA_TYPES.excalidrawLibrary) {
    throw new Error(t("alerts.couldNotLoadInvalidFile"));
  }
  return data;
};
