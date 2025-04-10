import { Excalidraw } from "@excalidraw/excalidraw";

import "@excalidraw/excalidraw/index.css";

const ExcalidrawApp = () => {
  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <Excalidraw />
    </div>
  );
};

export default ExcalidrawApp;
