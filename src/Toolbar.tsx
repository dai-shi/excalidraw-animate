import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
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
import { applyThemeToSvg } from './useLoadSvg';
import { Modal } from './Modal';

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

const removeBackgroundRect = (svg: SVGSVGElement): SVGSVGElement => {
  const cloned = svg.cloneNode(true) as SVGSVGElement;
  const firstRect = cloned.querySelector('rect');
  if (firstRect) {
    firstRect.remove();
  }
  return cloned;
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
  theme: 'light' | 'dark';
};

const Toolbar = ({ svgList, loadDataList, theme }: Props) => {
  const [showToolbar, setShowToolbar] = useState<boolean | 'never'>(false);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [loop, setLoop] = useState<boolean>(false);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [link, setLink] = useState('');
  const [jumpStep, setJumpStep] = useState<number>(() => {
    try {
      const v = localStorage.getItem('excalidraw-animate-jumpStep');
      return v ? Number(v) : 5;
    } catch {
      return 5;
    }
  });
  const [largeJumpStep, setLargeJumpStep] = useState<number>(() => {
    try {
      const v = localStorage.getItem('excalidraw-animate-largeJumpStep');
      return v ? Number(v) : 50;
    } catch {
      return 50;
    }
  });
  const [showShortcuts, setShowShortcuts] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('excalidraw-animate-showShortcuts');
      return v ? v === '1' : false;
    } catch {
      return false;
    }
  });
  const [webmData, setWebmData] = useState<Blob>();
  const [showExport, setShowExport] = useState(false);
  const [exportTheme, setExportTheme] = useState<'light' | 'dark'>(theme);
  const [exportBackground, setExportBackground] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWebmData(undefined);
  }, [svgList]);

  // initialize current time when svgList changes
  useEffect(() => {
    if (!svgList.length) return;
    const t = svgList[0].svg.getCurrentTime() * 1000;
    setCurrentTimeMs(Math.floor(t));
    // pause native animations; we'll drive timeline manually when playing
    svgList.forEach(({ svg }) => svg.pauseAnimations());
    setPlaying(false);
  }, [svgList]);

  const beginTimeList = useMemo(() => getCombinedBeginTimeList(svgList), [svgList]);
  const maxFinishedMs = useMemo(
    () => (svgList.length ? Math.max(...svgList.map((s) => s.finishedMs)) : 0),
    [svgList],
  );

  const scrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const handleScrubStart = () => {
    scrubbingRef.current = true;
    wasPlayingRef.current = playing;
    setPlaying(false);
  };
  const handleScrub = (ms: number) => {
    setCurrentTimeMs(ms);
    svgList.forEach(({ svg }) => svg.setCurrentTime(ms / 1000));
  };
  const handleScrubEnd = () => {
    scrubbingRef.current = false;
    if (wasPlayingRef.current) setPlaying(true);
  };

  // Thumbnails: generate small preview images for frames (first SVG only)
  const [thumbnails, setThumbnails] = useState<(string | null)[]>([]);
  const thumbW = 160;
  const thumbH = 90;

  const createImageFromUrl = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

  useEffect(() => {
    if (!beginTimeList.length || !svgList.length) {
      setThumbnails([]);
      return;
    }
    let cancelled = false;
    const svg = svgList[0].svg; // use first svg for thumbnails
    const canvas = document.createElement('canvas');
    canvas.width = thumbW;
    canvas.height = thumbH;
    const ctx = canvas.getContext('2d');
    const gen = async () => {
      const arr: (string | null)[] = new Array(beginTimeList.length).fill(null);
      for (let i = 0; i < beginTimeList.length; i += 1) {
        if (cancelled) break;
        const t = beginTimeList[i];
        try {
          svg.setCurrentTime(t / 1000);
        } catch (e) {
          // ignore
        }
        // serialize SVG and render to canvas
        try {
          const xml = new XMLSerializer().serializeToString(svg);
          const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          try {
            // wait a tick for rendering
            await new Promise((r) => setTimeout(r, 20));
            const img = await createImageFromUrl(url);
            if (!ctx) break;
            ctx.clearRect(0, 0, thumbW, thumbH);
            const scale = Math.min(thumbW / img.width, thumbH / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, (thumbW - w) / 2, (thumbH - h) / 2, w, h);
            arr[i] = canvas.toDataURL('image/png');
            setThumbnails([...arr]);
          } finally {
            URL.revokeObjectURL(url);
          }
        } catch (err) {
          // skip on failure
          arr[i] = null;
          setThumbnails([...arr]);
        }
        // yield to main thread
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 30));
      }
    };
    gen();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beginTimeList, svgList]);

  // playback loop: drive SVG currentTime manually to support variable playbackRate & looping
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!svgList.length) return;
    const maxFinishedMs = Math.max(...svgList.map((s) => s.finishedMs));

    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;
      lastTsRef.current = ts;
      setCurrentTimeMs((prev) => {
        let next = prev + delta * playbackRate;
        if (next >= maxFinishedMs) {
          if (loop) {
            next = 0;
          } else {
            // stop at end
            next = maxFinishedMs;
            setPlaying(false);
          }
        }
        svgList.forEach(({ svg }) => svg.setCurrentTime(next / 1000));
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };

    if (playing) {
      // ensure we start from currentTimeMs
      svgList.forEach(({ svg }) => svg.setCurrentTime(currentTimeMs / 1000));
      lastTsRef.current = null;
      rafRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, playbackRate, loop, svgList]);

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
    try {
      const data = await loadFromJSON();
      loadDataList([data]);
    } catch (e) {
      console.error('Failed to load file:', e);
      setError('Failed to load file');
    }
  };

  useEffect(() => {
    if (!showExport) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowExport(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showExport]);

  const loadLibrary = async () => {
    try {
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
    } catch (e) {
      console.error('Failed to load library:', e);
      setError('Failed to load library');
    }
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

  const togglePlay = useCallback(() => {
    if (!svgList.length) return;
    setPlaying((p) => !p);
  }, [svgList]);

  const stepForwardAnimations = useCallback(() => {
    if (!svgList.length) return;
    const beginTimeList = getCombinedBeginTimeList(svgList);
    const currentTime = currentTimeMs;
    let nextTime = beginTimeList.find((t) => t > currentTime + 50);
    if (nextTime) {
      nextTime -= 1;
    } else {
      nextTime = Math.min(currentTime + 500, Math.max(...svgList.map((s) => s.finishedMs)));
    }
    setPlaying(false);
    svgList.forEach(({ svg }) => svg.setCurrentTime((nextTime as number) / 1000));
    setCurrentTimeMs(nextTime as number);
  }, [svgList, currentTimeMs]);

  const stepBackwardAnimations = useCallback(() => {
    if (!svgList.length) return;
    const beginTimeList = getCombinedBeginTimeList(svgList);
    const currentTime = currentTimeMs;
    const prevList = beginTimeList.filter((t) => t < currentTime - 50);
    const prevTime = prevList.length ? prevList[prevList.length - 1] : 0;
    setPlaying(false);
    svgList.forEach(({ svg }) => svg.setCurrentTime(prevTime / 1000));
    setCurrentTimeMs(prevTime);
  }, [svgList, currentTimeMs]);

  // Jump by N frames (positive for forward, negative for backward)
  const jumpFrames = useCallback(
    (n: number) => {
      if (!svgList.length || !beginTimeList.length) return;
      const idx = Math.max(0, beginTimeList.filter((t) => t <= currentTimeMs + 50).length - 1);
      const newIdx = Math.min(beginTimeList.length - 1, Math.max(0, idx + n));
      const t = beginTimeList[newIdx];
      setPlaying(false);
      svgList.forEach(({ svg }) => svg.setCurrentTime(t / 1000));
      setCurrentTimeMs(t);
    },
    [svgList, beginTimeList, currentTimeMs],
  );

  const goToStart = useCallback(() => {
    if (!svgList.length) return;
    setPlaying(false);
    svgList.forEach(({ svg }) => svg.setCurrentTime(0));
    setCurrentTimeMs(0);
  }, [svgList]);

  const goToEnd = useCallback(() => {
    if (!svgList.length) return;
    const last = Math.max(...svgList.map((s) => s.finishedMs));
    setPlaying(false);
    svgList.forEach(({ svg }) => svg.setCurrentTime(last / 1000));
    setCurrentTimeMs(last);
  }, [svgList]);

  const resetAnimations = useCallback(() => {
    setPlaying(false);
    svgList.forEach(({ svg }) => {
      svg.setCurrentTime(0);
    });
    setCurrentTimeMs(0);
  }, [svgList]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      // ignore when input is focused
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 'r') {
        resetAnimations();
      } else if (e.key === 'ArrowLeft') {
        if (e.shiftKey && e.ctrlKey) {
          e.preventDefault();
          jumpFrames(-largeJumpStep);
        } else if (e.shiftKey) {
          e.preventDefault();
          jumpFrames(-jumpStep);
        } else {
          stepBackwardAnimations();
        }
      } else if (e.key === 'ArrowRight') {
        if (e.shiftKey && e.ctrlKey) {
          e.preventDefault();
          jumpFrames(largeJumpStep);
        } else if (e.shiftKey) {
          e.preventDefault();
          jumpFrames(jumpStep);
        } else {
          stepForwardAnimations();
        }
      } else if (e.key === 'ArrowUp') {
        // increase speed
        setPlaybackRate((p) => Math.min(3, Math.round((p + 0.25) * 100) / 100));
      } else if (e.key === 'ArrowDown') {
        setPlaybackRate((p) => Math.max(0.25, Math.round((p - 0.25) * 100) / 100));
      } else if (e.key.toLowerCase() === 'q') {
        setShowToolbar((s) => (typeof s === 'boolean' ? !s : s));
      } else {
        setShowToolbar((s) => (typeof s === 'boolean' ? true : s));
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => {
      document.removeEventListener('keydown', onKeydown);
    };
  }, [togglePlay, stepForwardAnimations, stepBackwardAnimations, resetAnimations, jumpFrames, jumpStep]);

  // persist jumpStep
  useEffect(() => {
    try {
      localStorage.setItem('excalidraw-animate-jumpStep', String(jumpStep));
    } catch {
      // ignore
    }
  }, [jumpStep]);
  // persist largeJumpStep
  useEffect(() => {
    try {
      localStorage.setItem('excalidraw-animate-largeJumpStep', String(largeJumpStep));
    } catch {
      // ignore
    }
  }, [largeJumpStep]);

  // persist shortcuts modal visibility
  useEffect(() => {
    try {
      localStorage.setItem('excalidraw-animate-showShortcuts', showShortcuts ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showShortcuts]);

  const hideToolbar = () => {
    setShowToolbar((s) => (typeof s === 'boolean' ? false : s));
  };

  const exportToSvg = () => {
    if (!svgList.length) {
      return;
    }
    svgList.forEach(({ svg }) => {
      if (exportTheme === 'light' && exportBackground) {
        exportToSvgFile(svg);
      } else if (exportTheme === 'light' && !exportBackground) {
        exportToSvgFile(removeBackgroundRect(svg));
      } else if (exportTheme === 'dark' && exportBackground) {
        exportToSvgFile(applyThemeToSvg(svg, 'dark'));
      } else if (exportTheme === 'dark' && !exportBackground) {
        exportToSvgFile(applyThemeToSvg(removeBackgroundRect(svg), 'dark'));
      }
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

  if (showToolbar !== true) return null;

  const Toggle = ({
    checked,
    onChange,
    ariaLabel,
    title,
  }: {
    checked: boolean;
    onChange: () => void;
    ariaLabel: string;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onChange}
      aria-label={ariaLabel}
      title={title}
      style={{
        position: 'relative',
        width: 52,
        height: 28,
        borderRadius: 999,
        background: checked
          ? 'var(--color-primary)'
          : 'var(--color-surface-lowest)',
        border: checked ? 'none' : '1.5px solid #999',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: checked ? 3 : 6,
          left: checked ? 27 : 7,
          width: checked ? 22 : 14,
          height: checked ? 22 : 14,
          borderRadius: '50%',
          background: checked
            ? 'var(--color-surface-lowest)'
            : 'var(--color-on-surface)',
        }}
      />
    </button>
  );

  return (
    <>
      <div style={{ marginTop: 5 }}>
        <div
          className={`toolbar ${showToolbar === true ? '' : 'toolbar--hidden'}`}
        >
          <button
            type="button"
            onClick={loadFile}
            className="app-button"
            title="Load Excalidraw file (.json)"
          >
            Load File
          </button>
          <span>OR</span>
          <button
            type="button"
            onClick={loadLibrary}
            className="app-button"
            title="Load Excalidraw library file (.excalidrawlib)"
          >
            Load Library
          </button>
          <span>OR</span>
          <form onSubmit={loadLink}>
            <input
              className="app-input"
              placeholder="Enter link..."
              value={link}
              title="Enter #json= link or .excalidrawlib URL"
              onChange={(e) => setLink(e.target.value)}
            />
            <button
              type="submit"
              disabled={!linkRegex.test(link)}
              title="Animate the loaded SVG"
              className="app-button"
            >
              Animate!
            </button>
          </form>
        </div>
        {!!svgList.length && (
          <div className="toolbar" style={{ alignItems: 'center', gap: 8 }}>
            {/* Button order: Reset → Play/Pause → Prev → Next → Speed controls */}
            <button
              type="button"
              onClick={resetAnimations}
              className="app-button"
              title="Reset animation to beginning (shortcut: R)"
            >
              Reset <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }} className="kbd-badge">R</span>
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="app-button"
              title="Play/Pause (Space)"
            >
              {playing ? 'Pause' : 'Play'} <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }} className="kbd-badge">Space</span>
            </button>
            <button
              type="button"
              onClick={goToStart}
              className="app-button"
              title="Go to start"
            >
              |&lt; Start <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }} className="kbd-badge">Home</span>
            </button>
            <button
              type="button"
              onClick={stepBackwardAnimations}
              className="app-button"
              title="Previous frame (←)"
            >
              Prev <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }} className="kbd-badge">←</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12 }}>Jump:</label>
              <select
                value={jumpStep}
                onChange={(e) => setJumpStep(Number(e.target.value))}
                title="Jump step (frames)"
                style={{ padding: '6px', borderRadius: 6 }}
              >
                <option value={1}>1</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12 }}>Large:</label>
              <select
                value={largeJumpStep}
                onChange={(e) => setLargeJumpStep(Number(e.target.value))}
                title="Large jump step (frames)"
                style={{ padding: '6px', borderRadius: 6 }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => jumpFrames(-10)}
                className="app-button"
                title="Jump back 10 frames"
              >
                -10 <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }} className="kbd-badge">Shift+←</span>
              </button>
              <button
                type="button"
                onClick={() => jumpFrames(-5)}
                className="app-button"
                title="Jump back 5 frames"
              >
                -5
              </button>
            </div>
            <button
              type="button"
              onClick={stepForwardAnimations}
              className="app-button"
              title="Next frame (→)"
            >
              Next <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }} className="kbd-badge">→</span>
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => jumpFrames(5)}
                className="app-button"
                title="Jump forward 5 frames"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => jumpFrames(10)}
                className="app-button"
                title="Jump forward 10 frames"
              >
                +10 <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }} className="kbd-badge">Shift+→</span>
              </button>
            </div>
            <button
              type="button"
              onClick={goToEnd}
              className="app-button"
              title="Go to end"
            >
              End &gt;| <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }} className="kbd-badge">End</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setPlaybackRate((p) => Math.max(0.25, Math.round((p - 0.25) * 100) / 100))}
                className="app-button"
                title="Decrease speed (Arrow Down)"
              >
                -
              </button>
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.25}
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                aria-label="Playback speed"
                title="Playback speed (0.25x - 3x)"
              />
              <button
                type="button"
                onClick={() => setPlaybackRate((p) => Math.min(3, Math.round((p + 0.25) * 100) / 100))}
                className="app-button"
                title="Increase speed (Arrow Up)"
              >
                +
              </button>
              <div style={{ minWidth: 72, textAlign: 'center' }}>Speed: {playbackRate.toFixed(2)}x</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Loop playback">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={() => setLoop((s) => !s)}
                />
                Loop
              </label>
              <div style={{ minWidth: 140, textAlign: 'right' }}>
                {(() => {
                  const beginTimeList = getCombinedBeginTimeList(svgList);
                  const total = beginTimeList.length || 1;
                  const idx = Math.max(0, beginTimeList.filter((t) => t <= currentTimeMs + 50).length - 1) + 1;
                  return `${idx}/${total}`;
                })()}
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className="app-button"
                title="Show keyboard shortcuts"
              >
                Shortcuts
              </button>
              <button
                type="button"
                onClick={hideToolbar}
                className="app-button"
                title="Hide toolbar (shortcut: Q)"
              >
                Hide Toolbar (Q)
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportTheme(theme);
                  setShowExport(true);
                }}
                className="app-button"
                title="Export current animation as SVG file"
              >
                Export to SVG
              </button>
              <button
                type="button"
                onClick={exportToWebm}
                disabled={processing}
                className="app-button"
                title={
                  webmData
                    ? 'Export animation as WebM video file'
                    : 'Prepare animation for WebM export'
                }
              >
                {processing ? 'Processing...' : webmData ? 'Export to WebM' : 'Prepare WebM'}
              </button>
            </div>
          </div>
        )}
        {/* Timeline scrubber */}
        {!!svgList.length && (
          <div style={{ padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <input
                  type="range"
                  min={0}
                  max={maxFinishedMs}
                  step={50}
                  value={Math.min(currentTimeMs, maxFinishedMs)}
                  onMouseDown={handleScrubStart}
                  onTouchStart={handleScrubStart}
                  onChange={(e) => handleScrub(Number(e.target.value))}
                  onMouseUp={handleScrubEnd}
                  onTouchEnd={handleScrubEnd}
                  style={{ width: '100%' }}
                  aria-label="Timeline scrubber"
                />
                {/* markers for frames */}
                <div style={{ position: 'relative', height: 6, marginTop: 6 }}>
                  {beginTimeList.map((t, i) => {
                    const left = maxFinishedMs ? (t / maxFinishedMs) * 100 : 0;
                    return (
                      <div
                        key={i}
                        title={`Frame ${i + 1}: ${t}ms`}
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          top: 0,
                          width: 2,
                          height: '100%',
                          background: 'var(--color-on-surface)',
                          opacity: 0.5,
                          transform: 'translateX(-1px) ',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              <div style={{ minWidth: 120, textAlign: 'right', fontFamily: 'monospace' }}>
                {`${Math.floor(currentTimeMs / 1000)}.${String(Math.floor((currentTimeMs % 1000) / 10)).padStart(2, '0')}s / ${Math.floor(maxFinishedMs / 1000)}.${String(Math.floor((maxFinishedMs % 1000) / 10)).padStart(2, '0')}s`}
              </div>
            </div>
          </div>
        )}
        {/* Thumbnails strip */}
        {!!svgList.length && beginTimeList.length > 0 && (
          <div style={{ padding: '6px 12px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {beginTimeList.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    svgList.forEach(({ svg }) => svg.setCurrentTime(t / 1000));
                    setCurrentTimeMs(t);
                  }}
                  title={`Go to frame ${i + 1}`}
                  style={{
                    width: thumbW,
                    height: thumbH,
                    padding: 0,
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: '#fff',
                    display: 'inline-block',
                    overflow: 'hidden',
                  }}
                >
                  {thumbnails[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnails[i] as string} alt={`Frame ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 12 }}>
                      {`#${i + 1}`}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <GitHubCorner
          link="https://github.com/dai-shi/excalidraw-animate"
          size={40}
        />
      </div>
      {showExport && (
        <Modal
          title="Export to SVG"
          onClose={() => setShowExport(false)}
          footerLabel="Export"
          footerTitle="Export with current settings to SVG"
          onFooterClick={() => {
            exportToSvg();
            setShowExport(false);
          }}
        >
          <div className="modal-row">
            <div style={{ fontWeight: 600 }}>Background</div>
            <Toggle
              checked={exportBackground}
              onChange={() => setExportBackground(!exportBackground)}
              ariaLabel="Toggle background"
              title={
                exportBackground ? 'Background enabled' : 'Background disabled'
              }
            />
          </div>
          <div className="modal-row">
            <div style={{ fontWeight: 600 }}>Dark mode</div>
            <Toggle
              checked={exportTheme === 'dark'}
              onChange={() =>
                setExportTheme(exportTheme === 'dark' ? 'light' : 'dark')
              }
              ariaLabel="Toggle dark mode"
              title={exportTheme === 'dark' ? 'Dark mode' : 'Light mode'}
            />
          </div>
        </Modal>
      )}

      {showShortcuts && (
        <Modal
          title="Keyboard Shortcuts"
          onClose={() => setShowShortcuts(false)}
          footerLabel="Close"
          footerTitle="Close shortcuts"
          onFooterClick={() => setShowShortcuts(false)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><strong>Space</strong>: Play / Pause</div>
            <div><strong>R</strong>: Reset to start</div>
            <div><strong>← / →</strong>: Prev / Next frame</div>
            <div><strong>Shift + ← / →</strong>: Jump by configured step ({jumpStep})</div>
            <div><strong>Shift + Ctrl + ← / →</strong>: Jump by 50 frames</div>
            <div><strong>↑ / ↓</strong>: Increase / Decrease speed</div>
            <div><strong>Ctrl + E</strong>: Switch to Animate mode (from Edit)</div>
            <div><strong>Esc</strong>: Switch to Edit mode (from Animate)</div>
            <div><strong>Q</strong>: Toggle toolbar</div>
          </div>
        </Modal>
      )}

      {error && (
        <Modal title="Error" onClose={() => setError(null)}>
          <p>{error}</p>
        </Modal>
      )}
    </>
  );
};

export default Toolbar;
