import { useState } from 'react';
import { Excalidraw, Footer, Sidebar } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

// eslint-disable-next-line import/no-unresolved
import '@excalidraw/excalidraw/index.css';

const AnimatePanel = () => {
  // TODO
  return <p>TODO</p>;
};

const ExcalidrawApp = ({
  initialData,
  onChangeData,
}: {
  initialData:
    | { elements: ExcalidrawElement[]; appState: AppState; files: BinaryFiles }
    | undefined;
  onChangeData: (data: {
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  }) => void;
}) => {
  const [docked, setDocked] = useState(false);
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Excalidraw
        initialData={initialData}
        onChange={(elements, appState, files) =>
          onChangeData({ elements, appState, files })
        }
      >
        <Sidebar name="custom" docked={docked} onDock={setDocked}>
          <Sidebar.Header />
          <AnimatePanel />
        </Sidebar>
        <Footer>
          <Sidebar.Trigger
            name="custom"
            style={{
              marginLeft: '0.5rem',
            }}
          >
            Toggle Animate Panel
          </Sidebar.Trigger>
        </Footer>
      </Excalidraw>
    </div>
  );
};

export default ExcalidrawApp;
