import { useState, useEffect } from 'react';
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
type Theme = 'light' | 'dark';

const App = () => {
  const [mode, setMode] = useState<ViewMode>('animate');
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme | null) ?? 'light',
  );

  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'animate' ? 'excalidraw' : 'animate'));
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  return (
    <div>
      <div
        style={{
          position: 'absolute',
          zIndex: 10,
        }}
      >
        <button className="app-button app-button-compact" onClick={toggleMode}>
          {mode === 'animate' ? 'Edit' : 'Animate'}
        </button>
        <button className="app-button app-button-compact" onClick={toggleTheme}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </div>
      {mode === 'animate' ? (
        <AnimateApp initialData={loadFromStorage()} theme={theme} />
      ) : (
        <ExcalidrawApp
          initialData={loadFromStorage()}
          onChangeData={(data) => saveToStorage(data)}
          theme={theme}
          onThemeChange={(t) => setTheme(t)}
        />
      )}
    </div>
  );
};

export default App;
