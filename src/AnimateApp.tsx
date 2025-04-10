import React from "react";

import "./App.css";
import Toolbar from "./Toolbar";
import Viewer from "./Viewer";
import { useLoadSvg } from "./useLoadSvg";

const AnimateApp: React.FC = () => {
  const { loading, loadedSvgList, loadDataList } = useLoadSvg();
  if (loading) {
    return <div>Loading...</div>;
  }
  return (
    <div className="App">
      <Toolbar svgList={loadedSvgList} loadDataList={loadDataList} />
      {!!loadedSvgList.length && <Viewer svgList={loadedSvgList} />}
    </div>
  );
};

export default AnimateApp;
