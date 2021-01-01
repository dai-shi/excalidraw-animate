import React, { useCallback, useEffect, useState } from "react";
import { fileOpen } from "browser-nativefs";

import "./Toolbar.css";
import GitHubCorner from "./GitHubCorner";
import { exportToSvgFile, exportToWebmFile, prepareWebmData } from "./export";
import { ExcalidrawElement } from "./excalidraw/src/element/types";
import { loadFromJSON } from "./excalidraw/src/data/json";
import { loadLibraryFromBlob } from "./excalidraw/src/data/blob";
import { getNonDeletedElements } from "./excalidraw/src/element";
import { restoreElements } from "./excalidraw/src/data/restore";
import { AppState } from "./excalidraw/src/types";

const linkRegex = /#json=([0-9]+),?([a-zA-Z0-9_-]*)|^http.*\.excalidrawlib$/;

type Props = {
  svgList: {
    svg: SVGSVGElement;
    finishedMs: number;
  }[];
  loadDataList: (data: { elements: readonly ExcalidrawElement[] }[]) => void;
};

const Toolbar: React.FC<Props> = ({ svgList, loadDataList }) => {
  const [showToolbar, setShowToolbar] = useState<boolean | "never">(false);
  const [paused, setPaused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [link, setLink] = useState("");
  const [webmData, setWebmData] = useState<Blob>();
  useEffect(() => {
    setWebmData(undefined);
  }, [svgList]);

  useEffect(() => {
    svgList.forEach(({ svg }) => {
      if (paused) {
        svg.pauseAnimations();
      } else {
        svg.unpauseAnimations();
      }
    });
  }, [svgList, paused]);

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
    const data = await loadFromJSON((undefined as unknown) as AppState);
    loadDataList([data]);
  };

  const loadLibrary = async () => {
    const blob = await fileOpen({
      description: "Excalidraw library files",
      extensions: [".json", ".excalidrawlib"],
      mimeTypes: ["application/json"],
    });
    const libraryFile = await loadLibraryFromBlob(blob);
    if (!libraryFile || !libraryFile.library) {
      window.alert("Unable to load library");
      return;
    }
    const dataList = libraryFile.library.map((libraryItem) =>
      getNonDeletedElements(restoreElements(libraryItem))
    );
    loadDataList(dataList.map((elements) => ({ elements })));
  };

  const loadLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const match = linkRegex.exec(link);
    if (!match) {
      window.alert("Invalid link");
      return;
    }
    if (match[1]) {
      window.location.hash = match[0];
    } else {
      window.location.hash = `library=${match[0]}`;
    }
    window.location.reload();
  };

  const togglePausedAnimations = useCallback(() => {
    if (!svgList.length) {
      return;
    }
    setPaused((p) => !p);
  }, [svgList]);

  const resetAnimations = useCallback(() => {
    svgList.forEach(({ svg }) => {
      svg.setCurrentTime(0);
    });
  }, [svgList]);

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
    if (!svgList.length) {
      return;
    }
    svgList.forEach(({ svg }) => {
      exportToSvgFile(svg);
    });
  };

  const exportToWebm = async () => {
    if (!svgList.length) {
      return;
    }
    if (webmData) {
      await exportToWebmFile(webmData);
      return;
    }
    setProcessing(true);
    setShowToolbar(false);
    try {
      const data = await prepareWebmData(svgList);
      setWebmData(data);
    } catch (e) {
      console.log(e);
    }
    setShowToolbar(true);
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
        <button type="button" onClick={loadLibrary}>
          Load Library
        </button>
        <span>OR</span>
        <form onSubmit={loadLink}>
          <input
            placeholder="Enter link..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button type="submit" disabled={!linkRegex.test(link)}>
            Animate!
          </button>
        </form>
      </div>
      {!!svgList.length && (
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
            {processing
              ? "Processing..."
              : webmData
              ? "Export to WebM"
              : "Prepare WebM"}
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
