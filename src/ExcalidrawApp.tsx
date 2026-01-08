import { useState, useRef } from 'react';
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

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const saveTimeoutRef = useRef<number | null>(null);

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

            setSaveStatus('saving');

            if (saveTimeoutRef.current) {
              window.clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = window.setTimeout(() => {
              setSaveStatus('saved');
            }, 500);

            return { elements, appState, files };
          });

          onChangeData({ elements, appState, files });
        }}
      >
        <Sidebar name="custom" docked={true}>
          <Sidebar.Header />

          <div
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: saveStatus === 'saved' ? '#16a34a' : '#d97706',
            }}
            title={
              saveStatus === 'saved'
                ? 'All changes are saved'
                : 'Saving changes…'
            }
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor:
                  saveStatus === 'saved' ? '#16a34a' : '#f59e0b',
                display: 'inline-block',
              }}
            />
            {saveStatus === 'saved' ? 'All changes saved' : 'Saving…'}
          </div>

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
            style={{ marginLeft: '0.5rem' }}
            title="Show or hide the Animate panel"
          >
            Toggle Animate Panel
          </Sidebar.Trigger>
        </Footer>
      </Excalidraw>
    </div>
  );
};

export default ExcalidrawApp;
