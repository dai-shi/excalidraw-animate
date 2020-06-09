import { useEffect, useState } from "react";

import { importFromBackend } from "./excalidraw/src/data";
import { exportToSvg } from "./excalidraw/src/scene/export";
import { getNonDeletedElements } from "./excalidraw/src/element";

import { animateSvg } from "./animate";

export const useLoadSvg = () => {
  const [loading, setLoading] = useState(true);
  const [loadedSvg, setLoadedSvg] = useState<SVGSVGElement>();
  const [finishedMs, setFinishedMs] = useState<number>();

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
        const elements = getNonDeletedElements(data.elements);
        const svg = exportToSvg(elements, {
          exportBackground: true,
          exportPadding: 30,
          viewBackgroundColor: "white",
          shouldAddWatermark: false,
        });
        const result = animateSvg(svg, elements);
        console.log(svg);
        if (searchParams.get("autoplay") === "no") {
          svg.setCurrentTime(result.finishedMs);
        }
        setLoadedSvg(svg);
        setFinishedMs(result.finishedMs);
      }
      setLoading(false);
    })();
  }, []);

  return { loading, loadedSvg, finishedMs };
};
