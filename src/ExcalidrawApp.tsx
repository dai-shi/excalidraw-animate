import { useState } from 'react';
import { Excalidraw, Footer, Sidebar } from '@excalidraw/excalidraw';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

// eslint-disable-next-line import/no-unresolved
import '@excalidraw/excalidraw/index.css';

import { AnimateConfig } from './AnimateConfig';
import { AnimateConfigV2 } from './AnimateConfigV2';
import type { Drawing } from './AnimateConfig';

const PANEL_MODE_KEY = 'animatePanelMode';

type Props = {
  initialData:
    | { elements: ExcalidrawElement[]; appState: AppState; files: BinaryFiles }
    | undefined;
  onChangeData: (data: {
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  }) => void;
  theme: 'light' | 'dark';
};

const ExcalidrawApp = ({ initialData, onChangeData, theme }: Props) => {
  const [drawing, setDrawing] = useState<Drawing | undefined>(initialData);
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  const [panelMode, setPanelMode] = useState<'v1' | 'v2'>(
    () => (localStorage.getItem(PANEL_MODE_KEY) as 'v1' | 'v2' | null) ?? 'v2',
  );

  // Sync with Excalidraw's persisted sidebar state so our toggle logic stays correct.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => !!(initialData?.appState as Record<string, unknown> | undefined)?.openSidebar,
  );

  const handleToggle = (mode: 'v1' | 'v2') => {
    if (!excalidrawAPI) return;
    if (sidebarOpen && panelMode !== mode) {
      setPanelMode(mode);
      localStorage.setItem(PANEL_MODE_KEY, mode);
      return;
    }
    const isNowOpen = excalidrawAPI.toggleSidebar({ name: 'custom' });
    setSidebarOpen(isNowOpen);
    if (isNowOpen) {
      setPanelMode(mode);
      localStorage.setItem(PANEL_MODE_KEY, mode);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Excalidraw
        theme={theme}
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={(elements, appState, files) => {
          setDrawing((prev) => {
            if (
              prev &&
              prev.elements === elements &&
              prev.appState === appState &&
              prev.files === files
            ) {
              return prev;
            }
            return { elements, appState, files };
          });
          onChangeData({ elements, appState, files });
        }}
      >
        <Sidebar name="custom" docked={true}>
          <Sidebar.Header />
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
            {drawing && excalidrawAPI ? (
              panelMode === 'v2' ? (
                <AnimateConfigV2 drawing={drawing} api={excalidrawAPI} />
              ) : (
                <AnimateConfig drawing={drawing} api={excalidrawAPI} />
              )
            ) : (
              <p>Loading...</p>
            )}
          </div>
        </Sidebar>
        <Footer>
          <button
            className="sidebar-trigger"
            aria-pressed={sidebarOpen && panelMode === 'v1'}
            title="Show or hide the Animate panel"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => handleToggle('v1')}
          >
            <div className="sidebar-trigger__label">Toggle Animate Panel</div>
          </button>
          <button
            className="sidebar-trigger"
            aria-pressed={sidebarOpen && panelMode === 'v2'}
            title="Show or hide the Animate panel v2"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => handleToggle('v2')}
          >
            <div className="sidebar-trigger__label">Toggle Animate Panel v2</div>
          </button>
        </Footer>
      </Excalidraw>
    </div>
  );
};

export default ExcalidrawApp;
