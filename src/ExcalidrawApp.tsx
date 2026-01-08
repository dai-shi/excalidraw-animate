<<<<<<< HEAD
import { useState, useRef, useEffect } from 'react';
=======
>>>>>>> parent of 555a719 (feat: add autosave status indicator for drawing changes)
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
import type { Drawing } from './AnimateConfig';

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
<<<<<<< HEAD


  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        excalidrawAPI?.toggleSidebar?.('custom');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [excalidrawAPI]);

=======
>>>>>>> parent of 555a719 (feat: add autosave status indicator for drawing changes)
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
          <div style={{ padding: '1rem' }}>
            {drawing && excalidrawAPI ? (
              <AnimateConfig drawing={drawing} api={excalidrawAPI} />
            ) : (
              <p>Loading...</p>
            )}
          </div>
        </Sidebar>
        <Footer>
          <Sidebar.Trigger
            name="custom"
<<<<<<< HEAD
            style={{ marginLeft: '0.5rem' }}
            title="Show or hide the Animate panel (Ctrl/Cmd + Shift + A)"
=======
            style={{
              marginLeft: '0.5rem',
            }}
            title="Show or hide the Animate panel"
>>>>>>> parent of 555a719 (feat: add autosave status indicator for drawing changes)
          >
            Toggle Animate Panel
          </Sidebar.Trigger>
        </Footer>
      </Excalidraw>
    </div>
  );
};

export default ExcalidrawApp;
