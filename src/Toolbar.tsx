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

const Toolbar = ({ svgList, loadDataList, theme }: Props) => {
  const [showToolbar, setShowToolbar] = useState<boolean | 'never'>(false);
  const [paused, setPaused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [link, setLink] = useState('');
  const [webmData, setWebmData] = useState<Blob>();
  const [showExport, setShowExport] = useState(false);
  const [exportTheme, setExportTheme] = useState<'light' | 'dark'>(theme);
  const [exportBackground, setExportBackground] = useState(false);
  const [exportBackgroundColor, setExportBackgroundColor] =
    useState('#ffffff');
  const [autoLoop, setAutoLoop] = useState(false);
  const [speed, setSpeed] = useState<'0.5' | '1' | '1.5'>('1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // FIXME
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // FIXME
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowToolbar(true);
    } else {
      setShowToolbar('never');
    }
    const speedParam = searchParams.get('speed');
    if (speedParam === '0.5' || speedParam === '1' || speedParam === '1.5') {
      setSpeed(speedParam);
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

  const togglePausedAnimations = useCallback(() => {
    if (!svgList.length) {
      return;
    }
    setPaused((p) => !p);
  }, [svgList]);

  const timer = useRef<NodeJS.Timeout>(undefined);
  const autoLoopTimer = useRef<NodeJS.Timeout | undefined>(undefined);
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
    if (!autoLoop || !svgList.length) {
      if (autoLoopTimer.current) {
        clearTimeout(autoLoopTimer.current);
        autoLoopTimer.current = undefined;
      }
      return;
    }

    const totalDuration = Math.max(
      ...svgList.map(({ finishedMs }) => finishedMs),
    );

    const scheduleLoop = () => {
      autoLoopTimer.current = setTimeout(() => {
        svgList.forEach(({ svg }) => {
          svg.setCurrentTime(0);
          svg.unpauseAnimations();
        });
        scheduleLoop();
      }, totalDuration);
    };

    scheduleLoop();

    return () => {
      if (autoLoopTimer.current) {
        clearTimeout(autoLoopTimer.current);
        autoLoopTimer.current = undefined;
      }
    };
  }, [autoLoop, svgList]);

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

  const updateSpeed = (value: '0.5' | '1' | '1.5') => {
    setSpeed(value);
    const hash = window.location.hash.slice(1);
    const searchParams = new URLSearchParams(hash);
    if (value === '1') {
      searchParams.delete('speed');
    } else {
      searchParams.set('speed', value);
    }
    window.location.hash = searchParams.toString();
    window.location.reload();
  };

  const applyBackgroundColor = (
    svg: SVGSVGElement,
    color: string,
  ): SVGSVGElement => {
    const cloned = svg.cloneNode(true) as SVGSVGElement;
    const firstRect = cloned.querySelector('rect');
    if (firstRect) {
      firstRect.setAttribute('fill', color);
    }
    return cloned;
  };

  const exportToSvg = () => {
    if (!svgList.length) {
      return;
    }
    svgList.forEach(({ svg }) => {
      if (!exportBackground) {
        if (exportTheme === 'dark') {
          exportToSvgFile(
            applyThemeToSvg(removeBackgroundRect(svg), 'dark'),
          );
        } else {
          exportToSvgFile(removeBackgroundRect(svg));
        }
        return;
      }

      if (exportTheme === 'dark') {
        const themed = applyThemeToSvg(svg, 'dark');
        exportToSvgFile(applyBackgroundColor(themed, exportBackgroundColor));
      } else {
        exportToSvgFile(applyBackgroundColor(svg, exportBackgroundColor));
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

  if (showToolbar !== true) {
    return null;
  }

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
          <div className="toolbar">
            <button
              type="button"
              onClick={togglePausedAnimations}
              className="app-button"
              title={
                paused
                  ? 'Play animation (shortcut: P)'
                  : 'Pause animation (shortcut: P)'
              }
            >
              {paused ? 'Play (P)' : 'Pause (P)'}
            </button>
            <button
              type="button"
              onClick={stepForwardAnimations}
              className="app-button"
              title="Advance animation to next step (shortcut: S)"
            >
              Step (S)
            </button>
            <button
              type="button"
              onClick={resetAnimations}
              className="app-button"
              title="Restart animation from beginning (shortcut: R)"
            >
              Reset (R)
            </button>
            <button
              type="button"
              onClick={() => setAutoLoop((value) => !value)}
              className="app-button"
              title={
                autoLoop
                  ? 'Disable auto loop playback'
                  : 'Enable auto loop playback'
              }
            >
              {autoLoop ? 'Auto loop: On' : 'Auto loop: Off'}
            </button>
            <span style={{ marginLeft: 8, fontSize: 12 }}>Speed:</span>
            <button
              type="button"
              className="app-button app-button-compact"
              onClick={() => updateSpeed('0.5')}
              title="Play animation at 0.5x speed"
              aria-pressed={speed === '0.5'}
              style={{
                fontWeight: speed === '0.5' ? 600 : 400,
                textDecoration: speed === '0.5' ? 'underline' : 'none',
              }}
            >
              Slow
            </button>
            <button
              type="button"
              className="app-button app-button-compact"
              onClick={() => updateSpeed('1')}
              title="Play animation at normal speed"
              aria-pressed={speed === '1'}
              style={{
                fontWeight: speed === '1' ? 600 : 400,
                textDecoration: speed === '1' ? 'underline' : 'none',
              }}
            >
              Normal
            </button>
            <button
              type="button"
              className="app-button app-button-compact"
              onClick={() => updateSpeed('1.5')}
              title="Play animation at 1.5x speed"
              aria-pressed={speed === '1.5'}
              style={{
                fontWeight: speed === '1.5' ? 600 : 400,
                textDecoration: speed === '1.5' ? 'underline' : 'none',
              }}
            >
              Fast
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
              {processing
                ? 'Processing...'
                : webmData
                  ? 'Export to WebM'
                  : 'Prepare WebM'}
            </button>
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
            <div
              style={{
                fontWeight: 600,
                opacity: exportBackground ? 1 : 0.5,
              }}
            >
              Background color
            </div>
            <input
              type="color"
              value={exportBackgroundColor}
              onChange={(e) => setExportBackgroundColor(e.target.value)}
              disabled={!exportBackground}
              aria-label="Pick background color"
              title="Pick background color for exported SVG"
              style={{
                width: 40,
                height: 24,
                borderRadius: 4,
                border: '1px solid var(--input-border-color)',
                cursor: exportBackground ? 'pointer' : 'not-allowed',
                backgroundColor: 'transparent',
              }}
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

      {error && (
        <Modal title="Error" onClose={() => setError(null)}>
          <p>{error}</p>
        </Modal>
      )}
    </>
  );
};

export default Toolbar;
