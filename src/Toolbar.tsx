import React, { useCallback, useEffect, useState } from "react";

import "./Toolbar.css";
import GitHubCorner from "./GitHubCorner";
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
  const [showToolbar, setShowToolbar] = useState<boolean | "never">(false);
  const [paused, setPaused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    if (!svg) {
      return;
    }
    if (paused) {
      svg.pauseAnimations();
    } else {
      svg.unpauseAnimations();
    }
  }, [svg, paused]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const searchParams = new URLSearchParams(hash);
    if (searchParams.get("toolbar") !== "no") {
      setShowToolbar(true);
    } else {
      setShowToolbar("never");
    }
  }, []);

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

  const togglePausedAnimations = useCallback(() => {
    if (!svg) {
      return;
    }
    setPaused((p) => !p);
  }, [svg]);

  const resetAnimations = useCallback(() => {
    if (!svg) {
      return;
    }
    svg.setCurrentTime(0);
  }, [svg]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "p") {
        togglePausedAnimations();
      } else if (e.key.toLowerCase() === "r") {
        resetAnimations();
      } else if (e.key.toLowerCase() === "q") {
        // toggle toolbar
        setShowToolbar((s) => (typeof s === "boolean" ? !s : s));
      } else {
        // show toolbar otherwise
        setShowToolbar((s) => (typeof s === "boolean" ? true : s));
      }
    };
    document.addEventListener("keydown", onKeydown);
    return () => {
      document.removeEventListener("keydown", onKeydown);
    };
  }, [togglePausedAnimations, resetAnimations]);

  const hideToolbar = () => {
    setShowToolbar((s) => (typeof s === "boolean" ? false : s));
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

  if (showToolbar !== true) {
    return null;
  }

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
          <button type="button" onClick={togglePausedAnimations}>
            {paused ? "Play (P)" : "Pause (P)"}
          </button>
          <button type="button" onClick={resetAnimations}>
            Reset (R)
          </button>
          <button type="button" onClick={hideToolbar}>
            Hide Toolbar (Q)
          </button>
          <button type="button" onClick={exportToSvg}>
            Export to SVG
          </button>
          <button type="button" onClick={exportToWebm} disabled={processing}>
            Export to WebM {processing && "(Processing...)"}
          </button>
        </div>
      )}
      <GitHubCorner
        link="https://github.com/dai-shi/excalidraw-animate"
        size={40}
      />
    </div>
  );
};

export default Toolbar;
