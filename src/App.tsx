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
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleMode = () => {
    setMode((prev) => (prev === 'animate' ? 'excalidraw' : 'animate'));
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <div className={isDarkMode ? 'dark-mode' : 'light-mode'}>
      <div className="top-buttons">
        <button
          onClick={toggleMode}
          className="mode-button"
        >
          {mode === 'animate' ? 'Edit' : 'Animate'}
        </button>
        <button
          onClick={toggleDarkMode}
          className="mode-button"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>
      {mode === 'animate' ? (
        <AnimateApp 
          initialData={loadFromStorage()} 
          isDarkMode={isDarkMode}
          onToggleMode={toggleMode}
          onToggleDarkMode={toggleDarkMode}
        />
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