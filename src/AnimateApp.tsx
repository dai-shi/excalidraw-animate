import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import Toolbar from './Toolbar';
import Viewer from './Viewer';
import { useLoadSvg } from './useLoadSvg';

type Props = {
  initialData:
    | { elements: ExcalidrawElement[]; appState: AppState; files: BinaryFiles }
    | undefined;
  theme: 'light' | 'dark';
};

const AnimateApp = ({ initialData, theme }: Props) => {
  const { loading, loadedSvgList, loadDataList } = useLoadSvg(
    initialData,
    theme,
  );
  if (loading) {
    return <div style={{ margin: '3px 3px 3px 40px' }}>Loading...</div>;
  }
  return (
    <div className="App">
      <Toolbar
        svgList={loadedSvgList}
        loadDataList={loadDataList}
        theme={theme}
      />
      {!!loadedSvgList.length && <Viewer svgList={loadedSvgList} />}
    </div>
  );
};

export default AnimateApp;
