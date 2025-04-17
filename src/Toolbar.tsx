import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { fileOpen } from 'browser-fs-access';

import {
  exportToSvg,
  restoreElements,
  loadFromBlob,
  loadLibraryFromBlob,
  getNonDeletedElements,
} from '@excalidraw/excalidraw';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import GitHubCorner from './GitHubCorner';
import { getBeginTimeList } from './animate';
import { exportToSvgFile, exportToWebmFile, prepareWebmData } from './export';

const loadFromJSON = async () => {
  const blob = await fileOpen({
    description: 'Excalidraw files',
  });
  return loadFromBlob(blob, null, null);
};

const linkRegex =
  /#json=([a-zA-Z0-9_-]+),?([a-zA-Z0-9_-]*)|^http.*\.excalidrawlib$/;

const getCombinedBeginTimeList = (svgList: Props['svgList']) => {
  const beginTimeList = ([] as number[]).concat(
    ...svgList.map(({ svg }) =>
      getBeginTimeList(svg).map((n) => Math.floor(n / 100) * 100),
    ),
  );
  return [...new Set(beginTimeList)].sort((a, b) => a - b);
};

type Props = {
  svgList: {
    svg: SVGSVGElement;
    finishedMs: number;
  }[];
  loadDataList: (
    data: {
      elements: readonly ExcalidrawElement[];
      appState: Parameters<typeof exportToSvg>[0]['appState'];
      files: BinaryFiles;
    }[],
  ) => void;
  isDarkMode: boolean;
  onToggleMode: () => void;
  onToggleDarkMode: () => void;
};

const Toolbar = ({ svgList, loadDataList, isDarkMode, onToggleMode, onToggleDarkMode }: Props) => {
  const [showToolbar, setShowToolbar] = useState<boolean | 'never'>(false);
  const [paused, setPaused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [link, setLink] = useState('');
  const [webmData, setWebmData] = useState<Blob>();
  const [mode, setMode] = useState<'animate' | 'edit'>('animate');
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsScrolled(true);
      } else if (currentScrollY < lastScrollY.current) {
        setIsScrolled(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    if (searchParams.get('toolbar') !== 'no') {
      setShowToolbar(true);
    } else {
      setShowToolbar('never');
    }
  }, []);

  const loadFile = async () => {
    const data = await loadFromJSON();
    loadDataList([data]);
  };

  const loadLibrary = async () => {
    const blob = await fileOpen({
      description: 'Excalidraw library files',
      extensions: ['.json', '.excalidrawlib'],
      mimeTypes: ['application/json'],
    });
    const libraryItems = await loadLibraryFromBlob(blob);
    const dataList = libraryItems.map((libraryItem) =>
      getNonDeletedElements(restoreElements(libraryItem.elements, null)),
    );
    loadDataList(
      dataList.map((elements) => ({ elements, appState: {}, files: {} })),
    );
  };

  const loadLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const match = linkRegex.exec(link);
    if (!match) {
      window.alert('Invalid link');
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

  const timer = useRef<NodeJS.Timeout>(undefined);
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
      if (e.key.toLowerCase() === 'p') {
        togglePausedAnimations();
      } else if (e.key.toLowerCase() === 's') {
        stepForwardAnimations();
      } else if (e.key.toLowerCase() === 'r') {
        resetAnimations();
      } else if (e.key.toLowerCase() === 'q') {
        // toggle toolbar
        setShowToolbar((s) => (typeof s === 'boolean' ? !s : s));
      } else {
        // show toolbar otherwise
        setShowToolbar((s) => (typeof s === 'boolean' ? true : s));
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('keydown', onKeydown);
    };
  }, [togglePausedAnimations, stepForwardAnimations, resetAnimations]);

  const hideToolbar = () => {
    setShowToolbar((s) => (typeof s === 'boolean' ? false : s));
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
    <div className={`toolbar ${isScrolled ? 'hidden' : ''}`}>
      <div className="toolbar-section">
        <button type="button" onClick={onToggleMode} className="toolbar-button">
          {mode === 'animate' ? 'Edit' : 'Animate'}
        </button>
        <button type="button" onClick={onToggleDarkMode} className="toolbar-button">
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        <span className="toolbar-separator">|</span>
        <button type="button" onClick={loadFile} className="toolbar-button">
          Load File
        </button>
        <span className="toolbar-separator">OR</span>
        <button type="button" onClick={loadLibrary} className="toolbar-button">
          Load Library
        </button>
        <span className="toolbar-separator">OR</span>
        <form onSubmit={loadLink} className="toolbar-form">
          <input
            placeholder="Enter link..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="toolbar-input"
          />
          <button
            type="submit"
            disabled={!linkRegex.test(link)}
            className="toolbar-button"
          >
            Animate!
          </button>
        </form>
      </div>
      {!!svgList.length && (
        <div className="toolbar-section">
          <button
            type="button"
            onClick={togglePausedAnimations}
            className="toolbar-button"
          >
            {paused ? 'Play' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={stepForwardAnimations}
            className="toolbar-button"
          >
            Step Forward
          </button>
          <button
            type="button"
            onClick={resetAnimations}
            className="toolbar-button"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={hideToolbar}
            className="toolbar-button"
          >
            Hide Toolbar (Q)
          </button>
          <button
            type="button"
            onClick={exportToSvg}
            className="toolbar-button"
          >
            Export SVG
          </button>
          <button
            type="button"
            onClick={exportToWebm}
            disabled={processing}
            className="toolbar-button"
          >
            {processing ? 'Processing...' : 'Export WebM'}
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
