import { useState } from "react";
import AnimateApp from "./AnimateApp";
import ExcalidrawApp from "./ExcalidrawApp";

type ViewMode = "animate" | "excalidraw";

const App = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("animate");

  const toggleViewMode = () => {
    setViewMode((prevMode) =>
      prevMode === "animate" ? "excalidraw" : "animate"
    );
  };

  return (
    <div>
      <button
        onClick={toggleViewMode}
        style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}
      >
        Switch to {viewMode === "animate" ? "Excalidraw" : "Animate"} View
      </button>
      {viewMode === "animate" ? <AnimateApp /> : <ExcalidrawApp />}
    </div>
  );
};

export default App;
