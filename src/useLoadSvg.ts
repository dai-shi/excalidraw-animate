import { useCallback, useEffect, useState } from "react";

import {
  exportToSvg,
  restoreElements,
  loadLibraryFromBlob,
} from "@excalidraw/excalidraw";

import type { BinaryFiles } from "@excalidraw/excalidraw/types/types";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/excalidraw/types/element/types";

import { loadScene } from "./vendor/loadScene";
import { animateSvg } from "./animate";

export const getNonDeletedElements = (
  elements: readonly ExcalidrawElement[],
): NonDeletedExcalidrawElement[] =>
  elements.filter(
    (element): element is NonDeletedExcalidrawElement => !element.isDeleted,
  );

const importLibraryFromUrl = async (url: string) => {
  try {
    const request = await fetch(url);
    const blob = await request.blob();
    const libraryItems = await loadLibraryFromBlob(blob);
    return libraryItems.map((libraryItem) =>
      getNonDeletedElements(restoreElements(libraryItem.elements, null)),
    );
  } catch (error) {
    window.alert("Unable to load library");
    return [];
  }
};

export const useLoadSvg = () => {
  const [loading, setLoading] = useState(true);
  const [loadedSvgList, setLoadedSvgList] = useState<
    {
      svg: SVGSVGElement;
      finishedMs: number;
    }[]
  >([]);

  const loadDataList = useCallback(
    async (
      dataList: {
        elements: readonly ExcalidrawElement[];
        appState: Parameters<typeof exportToSvg>[0]["appState"];
        files: BinaryFiles;
      }[],
      inSequence?: boolean,
    ) => {
      const hash = window.location.hash.slice(1);
      const searchParams = new URLSearchParams(hash);
      const options = {
        startMs: undefined as number | undefined,
        pointerImg: searchParams.get("pointerImg") || undefined,
        pointerWidth: searchParams.get("pointerWidth") || undefined,
        pointerHeight: searchParams.get("pointerHeight") || undefined,
      };
      const svgList = await Promise.all(
        dataList.map(async (data) => {
          const elements = getNonDeletedElements(data.elements);

          const svg = await exportToSvg({
            elements,
            files: data.files,
            appState: data.appState,
            exportPadding: 30,
          });

          // This is a patch up function to apply new fonts that are not part of Excalidraw package
          // Remove this function once Excalidraw package is updated (v0.17.6 as of now)
          applyNewFontsToSvg(svg, elements);

          const result = animateSvg(svg, elements, options);
          console.log(svg);
          if (inSequence) {
            options.startMs = result.finishedMs;
          }
          return { svg, finishedMs: result.finishedMs };
        }),
      );
      setLoadedSvgList(svgList);
      return svgList;
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const hash = window.location.hash.slice(1);
      const searchParams = new URLSearchParams(hash);
      const matchIdKey = /([a-zA-Z0-9_-]+),?([a-zA-Z0-9_-]*)/.exec(
        searchParams.get("json") || "",
      );
      if (matchIdKey) {
        const [, id, key] = matchIdKey;
        const data = await loadScene(id, key, null);
        const [{ svg, finishedMs }] = await loadDataList([data]);
        if (searchParams.get("autoplay") === "no") {
          svg.setCurrentTime(finishedMs);
        }
      }
      const matchLibrary = /(.*\.excalidrawlib)/.exec(
        searchParams.get("library") || "",
      );
      if (matchLibrary) {
        const [, url] = matchLibrary;
        const dataList = await importLibraryFromUrl(url);
        const svgList = await loadDataList(
          dataList.map((elements) => ({ elements, appState: {}, files: {} })),
          searchParams.has("sequence"),
        );
        if (searchParams.get("autoplay") === "no") {
          svgList.forEach(({ svg, finishedMs }) => {
            svg.setCurrentTime(finishedMs);
          });
        }
      }
      setLoading(false);
    })();
  }, [loadDataList]);

  return { loading, loadedSvgList, loadDataList };
};

// Change below are to apply new fonts that are not part of current version of Excalidraw package
// Remove them all below once Excalidraw is updated (v0.17.6 as of now)
// ================================================
const DEFAULT_FONT = "Segoe UI Emoji";
/** Up to date version of font family. It's brought from the latest version of Excalidraw repo */
export const FONT_FAMILY = {
  Virgil: 1,
  Helvetica: 2,
  Cascadia: 3,
  // leave 4 unused as it was historically used for Assistant (which we don't use anymore) or custom font (Obsidian)
  Excalifont: 5,
  Nunito: 6,
  "Lilita One": 7,
  "Comic Shanns": 8,
  "Liberation Sans": 9,
} as const;

/**
 * Recursively apply new fonts to all text elements in the given SVG.
 * `exportToSvg()` is not compatible with new fonts due to a discrepancy between package and release excalidraw.
 * This function patches up the fonts resulting in a default font family.
 *
 * issue link: https://github.com/dai-shi/excalidraw-animate/issues/55
 *  */
function applyNewFontsToSvg(svg: SVGSVGElement, elements: ExcalidrawElement[]) {
  const textElements: ExcalidrawTextElement[] = elements.filter(
    (element): element is ExcalidrawTextElement =>
      element.type === "text" && !!element.fontFamily,
  ) as ExcalidrawTextElement[];

  svg.querySelectorAll("text").forEach((textElement, index) => {
    const fontFamily = textElements[index].fontFamily;
    convertFontFamily(textElement, fontFamily);
  });
}

function convertFontFamily(
  textElement: SVGTextElement,
  fontFamilyNumber: number,
) {
  switch (fontFamilyNumber) {
    case FONT_FAMILY.Virgil:
      textElement.setAttribute("font-family", `Virgil, ${DEFAULT_FONT}`);
      break;

    case FONT_FAMILY.Helvetica:
      textElement.setAttribute("font-family", `Helvetica, ${DEFAULT_FONT}`);
      break;

    case FONT_FAMILY.Cascadia:
      textElement.setAttribute("font-family", `Cascadia, ${DEFAULT_FONT}`);
      break;

    case FONT_FAMILY.Excalifont:
      textElement.setAttribute("font-family", `Excalifont, ${DEFAULT_FONT}`);
      break;

    case FONT_FAMILY.Nunito:
      textElement.setAttribute("font-family", `Nunito, ${DEFAULT_FONT}`);
      break;

    case FONT_FAMILY["Lilita One"]:
      textElement.setAttribute("font-family", `Lilita One, ${DEFAULT_FONT}`);
      break;

    case FONT_FAMILY["Comic Shanns"]:
      textElement.setAttribute("font-family", `Comic Shanns, ${DEFAULT_FONT}`);
      break;

    case FONT_FAMILY["Liberation Sans"]:
      textElement.setAttribute(
        "font-family",
        `Liberation Sans, ${DEFAULT_FONT}`,
      );
      break;

    default:
      textElement.setAttribute("font-family", DEFAULT_FONT);
      break;
  }
}
