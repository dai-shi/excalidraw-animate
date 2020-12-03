import { useCallback, useEffect, useState } from "react";

import { importFromBackend } from "./excalidraw/src/data";
import { exportToSvg } from "./excalidraw/src/scene/export";
import { getNonDeletedElements } from "./excalidraw/src/element";
import { ExcalidrawElement } from "./excalidraw/src/element/types";

import { animateSvg } from "./animate";

export const useLoadSvg = () => {
  const [loading, setLoading] = useState(true);
  const [loadedSvgList, setLoadedSvgList] = useState<
    {
      svg: SVGSVGElement;
      finishedMs: number;
    }[]
  >([]);

  const loadDataList = useCallback(
    (dataList: { elements: readonly ExcalidrawElement[] }[]) => {
      const svgList = dataList.map((data) => {
        const elements = getNonDeletedElements(data.elements);
        const svg = exportToSvg(elements, {
          exportBackground: true,
          exportPadding: 30,
          viewBackgroundColor: "white",
          shouldAddWatermark: false,
        });
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
      const match = /([0-9]+),?([a-zA-Z0-9_-]*)/.exec(
        searchParams.get("json") || ""
      );
      if (match) {
        const [, id, key] = match;
        const data = await importFromBackend(id, key);
        const [{ svg, finishedMs }] = loadDataList([data]);
        if (searchParams.get("autoplay") === "no") {
          svg.setCurrentTime(finishedMs);
        }
      }
      setLoading(false);
    })();
  }, [loadDataList]);

  return { loading, loadedSvgList, loadDataList };
};
