import { useState } from 'react';
import AnimateApp from './AnimateApp';
import ExcalidrawApp from './ExcalidrawApp';

import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

const STORAGE_KEY = 'excalidraw-app';

const loadFromStorage = ():
  | { elements: ExcalidrawElement[]; appState: AppState; files: BinaryFiles }
  | undefined => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '');
    data.appState.collaborators = new Map();
    data.scrollToContent = true;
    return data;
  } catch {
    return undefined;
  }
};

const saveToStorage = (data: {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
}) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
};

type ViewMode = 'animate' | 'excalidraw';

const App = () => {
  const [mode, setMode] = useState<ViewMode>('animate');

  const toggleMode = () => {
    setMode((prev) => (prev === 'animate' ? 'excalidraw' : 'animate'));
  };

  return (
    <div>
      <button
        onClick={toggleMode}
        style={{
          position: 'absolute',
          top: 1,
          left: 1,
          fontSize: 8,
          zIndex: 10,
        }}
      >
        {mode === 'animate' ? 'Edit' : 'Animate'}
      </button>
      {mode === 'animate' ? (
        <AnimateApp initialData={loadFromStorage()} />
      ) : (
        <ExcalidrawApp
          initialData={loadFromStorage()}
          onChangeData={(data) => saveToStorage(data)}
        />
      )}
    </div>
  );
};

export default App;
