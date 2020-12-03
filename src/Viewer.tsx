import React, { useEffect, useRef } from "react";

import "./Viewer.css";

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

  return <div className="Viewer" ref={ref}></div>;
};

export default Viewer;
