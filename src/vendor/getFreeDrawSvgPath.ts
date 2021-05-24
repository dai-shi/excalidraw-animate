import getFreeDrawShape from "perfect-freehand";
import type {
  ExcalidrawFreeDrawElement,
} from "@excalidraw/excalidraw/types/element/types";

export function getFreeDrawSvgPath(element: ExcalidrawFreeDrawElement) {
  const inputPoints = element.simulatePressure
    ? element.points
    : element.points.length
    ? element.points.map(([x, y], i) => [x, y, element.pressures[i]])
    : [[0, 0, 0]];

  // Consider changing the options for simulated pressure vs real pressure
  const options = {
    simulatePressure: element.simulatePressure,
    size: element.strokeWidth * 6,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t: number) => t * (2 - t),
    last: true,
  };

  const points = getFreeDrawShape(inputPoints as number[][], options);
  const d: (string | number)[] = [];

  let [p0, p1] = points;

  d.push("M", p0[0], p0[1], "Q");

  for (let i = 0; i < points.length; i++) {
    d.push(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    p0 = p1;
    p1 = points[i];
  }

  p1 = points[0];
  d.push(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);

  d.push("Z");

  return d.join(" ");
}
