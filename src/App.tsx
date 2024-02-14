import React from "react";

import Toolbar from "./Toolbar";
import Viewer from "./Viewer";
import { useLoadSvg } from "./useLoadSvg";

const App: React.FC = () => {
  const { loading, loadedSvgList, loadDataList } = useLoadSvg();
  if (loading) {
    return <div>Loading...</div>;
  }
  return (
    <>
      <div className="justify-between px-4 py-2 bg-gray-300">
        <Toolbar svgList={loadedSvgList} loadDataList={loadDataList} />
      </div>
      <div className="mt-4 flex items-center justify-center">
        {!!loadedSvgList.length && <Viewer svgList={loadedSvgList} />}
      </div>
    </>
  );
};

export default App;
