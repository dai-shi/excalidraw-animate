import { Excalidraw } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

// eslint-disable-next-line import-x/no-unresolved
import '@excalidraw/excalidraw/index.css';

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
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Excalidraw
        initialData={initialData}
        onChange={(elements, appState, files) =>
          onChangeData({ elements, appState, files })
        }
      />
    </div>
  );
};

export default ExcalidrawApp;
