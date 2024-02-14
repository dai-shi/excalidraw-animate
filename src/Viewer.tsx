import React, { useEffect, useRef } from "react";

type Props = {
  svgList: {
    svg: SVGSVGElement;
    finishedMs: number;
  }[];
};

const Viewer: React.FC<Props> = ({ svgList }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    svgList.forEach(({ svg }) => {
      if (ref.current) {
        ref.current.appendChild(svg);
      }
    });
    return () => {
      svgList.forEach(({ svg }) => {
        svg.remove();
      });
    };
  }, [svgList]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const searchParams = new URLSearchParams(hash);
    if (searchParams.get("autoplay") === "no") {
      if (ref.current) {
        const ele = ref.current;
        const callback = () => {
          svgList.forEach(({ svg }) => {
            svg.setCurrentTime(0);
            svg.unpauseAnimations();
          });
        };
        ele.addEventListener("click", callback);
        return () => {
          ele.removeEventListener("click", callback);
        };
      }
    }
  }, [svgList]);

  const repeat = Math.ceil(Math.sqrt(svgList.length));
  const grids = `repeat(${repeat}, ${100 / repeat}%)`;

  return (
    <div className="flex items-center h-full">
      <div
        className="rounded-3xl p-2 bg-white flex-1"
        style={{ gridTemplateColumns: grids, gridTemplateRows: grids }}
        ref={ref}
      ></div>
    </div>
  );
};

export default Viewer;
