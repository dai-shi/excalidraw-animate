import { useCallback, useEffect, useState } from "react";

import { loadScene } from "./excalidraw/src/excalidraw-app/data";
import { isValidLibrary } from "./excalidraw/src/data/json";
import { loadLibraryFromBlob } from "./excalidraw/src/data/blob";
import { restoreElements } from "./excalidraw/src/data/restore";
import { exportToSvg } from "./excalidraw/src/scene/export";
import { getNonDeletedElements } from "./excalidraw/src/element";
import { ExcalidrawElement } from "./excalidraw/src/element/types";
import { AppState } from "./excalidraw/src/types";

import { animateSvg } from "./animate";

const importLibraryFromUrl = async (url: string) => {
  try {
    const request = await fetch(url);
    const blob = await request.blob();
    const json = JSON.parse(await blob.text());
    if (!isValidLibrary(json)) {
      throw new Error();
    }
    const libraryFile = await loadLibraryFromBlob(blob);
    if (!libraryFile || !libraryFile.library) {
      throw new Error();
    }
    return libraryFile.library.map((libraryItem) =>
      getNonDeletedElements(restoreElements(libraryItem))
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
    (
      dataList: {
        elements: readonly ExcalidrawElement[];
        appState?: MarkOptional<AppState, "offsetTop" | "offsetLeft">;
      }[]
    ) => {
      const svgList = dataList.map((data) => {
        const elements = getNonDeletedElements(data.elements);
        const svg = exportToSvg(
          elements,
          data?.appState || {
            exportBackground: true,
            exportPadding: 30,
            viewBackgroundColor: "white",
            shouldAddWatermark: false,
          }
        );
        const result = animateSvg(svg, elements);
        console.log(svg);
        return { svg, finishedMs: result.finishedMs };
      });
      setLoadedSvgList(svgList);
      return svgList;
    },
    []
  );

  useEffect(() => {
    (async () => {
      const hash = window.location.hash.slice(1);
      const searchParams = new URLSearchParams(hash);
      const matchIdKey = /([0-9]+),?([a-zA-Z0-9_-]*)/.exec(
        searchParams.get("json") || ""
      );
      if (matchIdKey) {
        const [, id, key] = matchIdKey;
        const data = await loadScene(id, key, null);
        const [{ svg, finishedMs }] = loadDataList([data]);
        if (searchParams.get("autoplay") === "no") {
          svg.setCurrentTime(finishedMs);
        }
      }
      const matchLibrary = /(.*\.excalidrawlib)/.exec(
        searchParams.get("library") || ""
      );
      if (matchLibrary) {
        const [, url] = matchLibrary;
        const dataList = await importLibraryFromUrl(url);
        const svgList = loadDataList(
          dataList.map((elements) => ({ elements }))
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
