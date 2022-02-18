import { loadLibraryFromBlob } from "@excalidraw/excalidraw";

// some libraries seem to use old format
// https://libraries.excalidraw.com/libraries/youritjang/stick-figures.excalidrawlib

export const importLibraryFromBlob = async (blob: Blob) => {
  const libraryFile = await loadLibraryFromBlob(blob);
  if (!libraryFile || libraryFile.libraryItems) {
    return libraryFile;
  }
  const { library: deprecatedLibrary } = libraryFile;
  if (deprecatedLibrary) {
    const libraryItems: any[] = [];
    deprecatedLibrary.forEach((elements) => {
      libraryItems.push({ elements });
    });
    libraryFile.libraryItems = libraryItems;
  }
  return libraryFile;
};
