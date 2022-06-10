import React, { useCallback, useEffect, useRef, useState } from "react";
import { fileOpen } from "browser-fs-access";

import { restoreElements, loadFromBlob } from "@excalidraw/excalidraw";
import type { BinaryFiles } from "@excalidraw/excalidraw/types/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

import "./Toolbar.css";
import GitHubCorner from "./GitHubCorner";
import { getBeginTimeList } from "./animate";
import { exportToSvgFile, exportToWebmFile, prepareWebmData } from "./export";
import { getNonDeletedElements } from "./useLoadSvg";
import { importLibraryFromBlob } from "./importLibrary";

const loadFromJSON = async () => {
  const blob = await fileOpen({
    description: "Excalidraw files",
  });
  return loadFromBlob(blob, null, null);
};

const linkRegex =
  /#json=([a-zA-Z0-9_-]+),?([a-zA-Z0-9_-]*)|^http.*\.excalidrawlib$/;

const getCombinedBeginTimeList = (svgList: Props["svgList"]) => {
  const beginTimeList = ([] as number[]).concat(
    ...svgList.map(({ svg }) =>
      getBeginTimeList(svg).map((n) => Math.floor(n / 100) * 100)
    )
  );
  return [...new Set(beginTimeList)].sort((a, b) => a - b);
};

type Props = {
  svgList: {
    svg: SVGSVGElement;
    finishedMs: number;
  }[];
  loadDataList: (
    data: { elements: readonly ExcalidrawElement[]; files: BinaryFiles }[]
  ) => void;
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
    const data = await loadFromJSON();
    loadDataList([data]);
  };

  const loadLibrary = async () => {
    const blob = await fileOpen({
      description: "Excalidraw library files",
      extensions: [".json", ".excalidrawlib"],
      mimeTypes: ["application/json"],
    });
    const libraryFile = await importLibraryFromBlob(blob);
    if (!libraryFile || !libraryFile.libraryItems) {
      window.alert("Unable to load library");
      return;
    }
    const dataList = libraryFile.libraryItems.map((libraryItem) =>
      getNonDeletedElements(restoreElements(libraryItem.elements, null))
    );
    loadDataList(dataList.map((elements) => ({ elements, files: {} })));
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

  const timer = useRef<NodeJS.Timeout>();
  const stepForwardAnimations = useCallback(() => {
    if (!svgList.length) {
      return;
    }
    const beginTimeList = getCombinedBeginTimeList(svgList);
    const currentTime = svgList[0].svg.getCurrentTime() * 1000;
    let nextTime = beginTimeList.find((t) => t > currentTime + 50);
    if (nextTime) {
      nextTime -= 1;
    } else {
      nextTime = currentTime + 500;
    }
    clearTimeout(timer.current as NodeJS.Timeout);
    svgList.forEach(({ svg }) => {
      svg.unpauseAnimations();
    });
    timer.current = setTimeout(() => {
      svgList.forEach(({ svg }) => {
        svg.pauseAnimations();
        svg.setCurrentTime((nextTime as number) / 1000);
      });
      setPaused(true);
    }, nextTime - currentTime);
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
      } else if (e.key.toLowerCase() === "s") {
        stepForwardAnimations();
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
  }, [togglePausedAnimations, stepForwardAnimations, resetAnimations]);

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
          <button type="button" onClick={stepForwardAnimations}>
            Step (S)
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
