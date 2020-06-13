import React, { useEffect, useState } from "react";

import "./Toolbar.css";
import { exportToSvgFile, exportToWebmFile } from "./export";

const linkRegex = /#json=([0-9]+),?([a-zA-Z0-9_-]*)/;

type Props = {
  svg?: SVGSVGElement;
  finishedMs?: number;
};

const Toolbar: React.FC<Props> = ({ svg, finishedMs }) => {
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
    }
  }, []);

  if (!showToolbar) {
    return null;
  }

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
      <form onSubmit={loadLink}>
        <label>
          Excalidraw shareable link:
          <input value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <button type="submit" disabled={!linkRegex.test(link)}>Animate!</button>
      </form>
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
  );
};

export default Toolbar;
