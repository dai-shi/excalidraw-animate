import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import Toolbar from './Toolbar';
import Viewer from './Viewer';
import { useLoadSvg } from './useLoadSvg';

const AnimateApp = ({
  initialData,
  isDarkMode,
  onToggleMode,
  onToggleDarkMode,
}: {
  initialData:
    | { elements: ExcalidrawElement[]; appState: AppState; files: BinaryFiles }
    | undefined;
  isDarkMode: boolean;
  onToggleMode: () => void;
  onToggleDarkMode: () => void;
}) => {
  const { loading, loadedSvgList, loadDataList } = useLoadSvg(initialData);
  if (loading) {
    return <div style={{ margin: '3px 3px 3px 40px' }}>Loading...</div>;
  }
  return (
    <div className="App">
      <Toolbar
        svgList={loadedSvgList}
        loadDataList={loadDataList}
        isDarkMode={isDarkMode}
        onToggleMode={onToggleMode}
        onToggleDarkMode={onToggleDarkMode}
      />
      {!!loadedSvgList.length && <Viewer svgList={loadedSvgList} />}
    </div>
  );
};

export default AnimateApp;
