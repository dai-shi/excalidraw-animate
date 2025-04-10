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
        style={{
          position: "absolute",
          top: 1,
          left: 1,
          fontSize: 8,
          zIndex: 10,
        }}
      >
        {viewMode === "animate" ? "Edit" : "Animate"}
      </button>
      {viewMode === "animate" ? <AnimateApp /> : <ExcalidrawApp />}
    </div>
  );
};

export default App;
