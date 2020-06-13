import { useCallback, useEffect, useState } from "react";

import { importFromBackend } from "./excalidraw/src/data";
import { exportToSvg } from "./excalidraw/src/scene/export";
import { getNonDeletedElements } from "./excalidraw/src/element";
import { ExcalidrawElement } from "./excalidraw/src/element/types";

import { animateSvg } from "./animate";

export const useLoadSvg = () => {
  const [loading, setLoading] = useState(true);
  const [loadedSvg, setLoadedSvg] = useState<SVGSVGElement>();
  const [finishedMs, setFinishedMs] = useState<number>();

  const loadData = useCallback(
    (data: { elements: readonly ExcalidrawElement[] }) => {
      const elements = getNonDeletedElements(data.elements);
      const svg = exportToSvg(elements, {
        exportBackground: true,
        exportPadding: 30,
        viewBackgroundColor: "white",
        shouldAddWatermark: false,
      });
      const result = animateSvg(svg, elements);
      console.log(svg);
      setLoadedSvg(svg);
      setFinishedMs(result.finishedMs);
      return { svg, finishedMs: result.finishedMs };
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
        const { svg, finishedMs } = loadData(data);
        if (searchParams.get("autoplay") === "no") {
          svg.setCurrentTime(finishedMs);
        }
      }
      setLoading(false);
    })();
  }, [loadData]);

  return { loading, loadedSvg, finishedMs, loadData };
};
