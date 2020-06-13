import React, { useEffect, useState } from "react";

import "./Toolbar.css";
import { exportToSvgFile, exportToWebmFile } from "./export";
import { ExcalidrawElement } from "./excalidraw/src/element/types";
import { loadFromJSON } from "./excalidraw/src/data/json";

const linkRegex = /#json=([0-9]+),?([a-zA-Z0-9_-]*)/;

type Props = {
  svg?: SVGSVGElement;
  finishedMs?: number;
  loadData: (data: { elements: readonly ExcalidrawElement[] }) => void;
};

const Toolbar: React.FC<Props> = ({ svg, finishedMs, loadData }) => {
  const [showToolbar, setShowToolbar] = useState(false);
  const [paused, setPaused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    if (!svg) {
      return;
    }
    if (svg.animationsPaused()) {
      setPaused(true);
    } else {
      setPaused(false);
    }
  }, [svg]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const searchParams = new URLSearchParams(hash);
    if (searchParams.get("toolbar") !== "no") {
      setShowToolbar(true);
    } else {
      const eleList = document.getElementsByClassName("github-corner");
      const ele = eleList[0] as HTMLElement | undefined;
      if (ele) {
        ele.style.display = "none";
      }
    }
  }, []);

  if (!showToolbar) {
    return null;
  }

  const loadFile = async () => {
    const data = await loadFromJSON();
    loadData(data);
  };

  const loadLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const match = linkRegex.exec(link);
    if (!match) {
      window.alert("Invalid link");
      return;
    }
    window.location.hash = match[0];
    window.location.reload();
  };

  const pauseResumeAnimations = () => {
    if (!svg) {
      return;
    }
    if (paused) {
      svg.unpauseAnimations();
      setPaused(false);
    } else {
      svg.pauseAnimations();
      setPaused(true);
    }
  };

  const resetAnimations = () => {
    if (!svg) {
      return;
    }
    svg.setCurrentTime(0);
  };

  const exportToSvg = () => {
    if (!svg) {
      return;
    }
    exportToSvgFile(svg);
  };

  const exportToWebm = async () => {
    if (!svg || !finishedMs) {
      return;
    }
    setProcessing(true);
    await exportToWebmFile(svg, finishedMs);
    setProcessing(false);
  };

  return (
    <div className="Toolbar">
      <div className="Toolbar-loader">
        <button type="button" onClick={loadFile}>
          Load File
        </button>
        <span>OR</span>
        <form onSubmit={loadLink}>
          <input
            placeholder="Enter shareable link..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button type="submit" disabled={!linkRegex.test(link)}>
            Animate!
          </button>
        </form>
      </div>
      {svg && (
        <div className="Toolbar-controller">
          <button type="button" onClick={pauseResumeAnimations}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" onClick={resetAnimations}>
            Reset
          </button>
          <button type="button" onClick={exportToSvg}>
            Export to SVG
          </button>
          <button type="button" onClick={exportToWebm} disabled={processing}>
            Export to WebM {processing && "(Processing...)"}
          </button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
