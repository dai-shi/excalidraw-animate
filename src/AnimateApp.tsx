import Toolbar from "./Toolbar";
import Viewer from "./Viewer";
import { useLoadSvg } from "./useLoadSvg";

const AnimateApp = () => {
  const { loading, loadedSvgList, loadDataList } = useLoadSvg();
  if (loading) {
    return <div style={{ margin: "3px 3px 3px 40px" }}>Loading...</div>;
  }
  return (
    <div className="App">
      <Toolbar svgList={loadedSvgList} loadDataList={loadDataList} />
      {!!loadedSvgList.length && <Viewer svgList={loadedSvgList} />}
    </div>
  );
};

export default AnimateApp;
