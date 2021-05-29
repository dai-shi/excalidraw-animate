import { fileOpen } from "browser-fs-access";

import { restore } from "@excalidraw/excalidraw";
import type { ImportedDataState } from "@excalidraw/excalidraw/types/data/types";
import type { AppState } from "@excalidraw/excalidraw/types/types";

const t = (s: string) => s;

const EXPORT_DATA_TYPES = {
  excalidraw: "excalidraw",
  excalidrawClipboard: "excalidraw/clipboard",
  excalidrawLibrary: "excalidrawlib",
} as const;

const isValidExcalidrawData = (data?: {
  type?: any;
  elements?: any;
  appState?: any;
}): data is ImportedDataState => {
  return (
    data?.type === EXPORT_DATA_TYPES.excalidraw &&
    (!data.elements ||
      (Array.isArray(data.elements) &&
        (!data.appState || typeof data.appState === "object")))
  );
};

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

const loadFromBlob = async (blob: Blob, localAppState: AppState | null) => {
  const contents = await parseFileContents(blob);
  try {
    const data = JSON.parse(contents);
    if (!isValidExcalidrawData(data)) {
      throw new Error(t("alerts.couldNotLoadInvalidFile"));
    }
    const result = restore({ elements: data.elements || [] }, localAppState);

    return result;
  } catch (error) {
    console.error(error.message);
    throw new Error(t("alerts.couldNotLoadInvalidFile"));
  }
};

export const loadFromJSON = async (localAppState: AppState | null) => {
  const blob = await fileOpen({
    description: "Excalidraw files",
  });
  return loadFromBlob(blob, localAppState);
};
