import React, { useEffect, useRef } from "react";

import "./Viewer.css";

type Props = {
  svg: SVGSVGElement;
};

const Viewer: React.FC<Props> = ({ svg }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.appendChild(svg);
      return () => {
        svg.remove();
      };
    }
    return undefined;
  }, [svg]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const searchParams = new URLSearchParams(hash);
    if (searchParams.get("autoplay") === "no") {
      if (ref.current) {
        const ele = ref.current;
        const callback = () => {
          svg.setCurrentTime(0);
        };
        ele.addEventListener("click", callback);
        return () => {
          ele.removeEventListener("click", callback);
        };
      }
    }
    return undefined;
  }, [svg]);

  return <div className="Viewer" ref={ref}></div>;
};

export default Viewer;
