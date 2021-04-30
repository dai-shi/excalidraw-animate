import { SVG_NS } from "./excalidraw/src/utils";
import { NonDeletedExcalidrawElement } from "./excalidraw/src/element/types";

const findNode = (ele: SVGElement, name: string) => {
  const childNodes = ele.childNodes as NodeListOf<SVGElement>;
  for (let i = 0; i < childNodes.length; ++i) {
    if (childNodes[i].tagName === name) {
      return childNodes[i];
    }
  }
  return null;
};

const getPointer = () => {
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(hash);
  const img = searchParams.get("pointerImg");
  const width = searchParams.get("pointerWidth");
  const height = searchParams.get("pointerHeight");
  if (!img) {
    return null;
  }
  return {
    img,
    width,
    height,
  };
};

const pickOnePathItem = (path: string) => {
  const items = path.match(/(M[^C]*C[^M]*)/g);
  if (!items) {
    return path;
  }
  if (items.length <= 2) {
    return items[items.length - 1];
  }
  const [longestIndex] = items.reduce(
    (prev, item, index) => {
      const [, x1, y1, x2, y2] =
        item.match(/M([\d.-]+) ([\d.-]+) C([\d.-]+) ([\d.-]+)/) || [];
      const d = Math.hypot(Number(x2) - Number(x1), Number(y2) - Number(y1));
      if (d > prev[1]) {
        return [index, d];
      }
      return prev;
    },
    [0, 0]
  );
  return items[longestIndex];
};

const animatePointer = (
  svg: SVGSVGElement,
  ele: SVGElement,
  path: string,
  currentMs: number,
  durationMs: number
) => {
  const pointer = getPointer();
  if (!pointer) return;
  const img = svg.ownerDocument.createElementNS(SVG_NS, "image");
  img.setAttribute("href", pointer.img);
  if (pointer.width) {
    img.setAttribute("width", pointer.width);
  }
  if (pointer.height) {
    img.setAttribute("height", pointer.height);
  }
  img.setAttribute("opacity", "0");
  const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
  animate.setAttribute("attributeName", "opacity");
  animate.setAttribute("from", "1");
  animate.setAttribute("to", "1");
  animate.setAttribute("begin", `${currentMs}ms`);
  animate.setAttribute("dur", `${durationMs}ms`);
  img.appendChild(animate);
  const animateMotion = svg.ownerDocument.createElementNS(
    SVG_NS,
    "animateMotion"
  );
  animateMotion.setAttribute("path", pickOnePathItem(path));
  animateMotion.setAttribute("begin", `${currentMs}ms`);
  animateMotion.setAttribute("dur", `${durationMs}ms`);
  img.appendChild(animateMotion);
  ele.parentNode?.appendChild(img);
};

const animatePath = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  const dTo = ele.getAttribute("d") || "";
  const mCount = dTo.match(/M/g)?.length || 0;
  const cCount = dTo.match(/C/g)?.length || 0;
  const repeat = cCount / mCount;
  let dLast = dTo;
  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom = dTo.replace(
      new RegExp(
        [
          "M(\\S+) (\\S+)",
          "((?: C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+){",
          `${i}`, // skip count
          "})",
          "(?: C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+){1,}",
        ].join(""),
        "g"
      ),
      (...a) => {
        const [x, y] = a[3]
          ? a[3].match(/.* (\S+) (\S+)$/).slice(1, 3)
          : [a[1], a[2]];
        return (
          `M${a[1]} ${a[2]}${a[3]}` +
          ` C${x} ${y}, ${x} ${y}, ${x} ${y}`.repeat(repeat - i)
        );
      }
    );
    if (i === 0) {
      ele.setAttribute("d", dFrom);
    }
    const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
    animate.setAttribute("attributeName", "d");
    animate.setAttribute("from", dFrom);
    animate.setAttribute("to", dLast);
    animate.setAttribute("begin", `${currentMs + i * (durationMs / repeat)}ms`);
    animate.setAttribute("dur", `${durationMs / repeat}ms`);
    animate.setAttribute("fill", "freeze");
    ele.appendChild(animate);
    dLast = dFrom;
  }
  animatePointer(svg, ele, dTo, currentMs, durationMs);
};

const animateFillPath = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  const dTo = ele.getAttribute("d") || "";
  if (dTo.includes("C")) {
    animatePath(svg, ele, currentMs, durationMs);
    return;
  }
  const dFrom = dTo.replace(
    new RegExp(["M(\\S+) (\\S+)", "((?: L\\S+ \\S+){1,})"].join("")),
    (...a) => {
      return `M${a[1]} ${a[2]}` + a[3].replace(/L\S+ \S+/g, `L${a[1]} ${a[2]}`);
    }
  );
  ele.setAttribute("d", dFrom);
  const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
  animate.setAttribute("attributeName", "d");
  animate.setAttribute("from", dFrom);
  animate.setAttribute("to", dTo);
  animate.setAttribute("begin", `${currentMs}ms`);
  animate.setAttribute("dur", `${durationMs}ms`);
  animate.setAttribute("fill", "freeze");
  ele.appendChild(animate);
};

const animatePolygon = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  let dTo = ele.getAttribute("d") || "";
  let mCount = dTo.match(/M/g)?.length || 0;
  let cCount = dTo.match(/C/g)?.length || 0;
  if (mCount === cCount + 1) {
    // workaround for round rect
    dTo = dTo.replace(/^M\S+ \S+ M/, "M");
    mCount = dTo.match(/M/g)?.length || 0;
    cCount = dTo.match(/C/g)?.length || 0;
  }
  if (mCount !== cCount) throw new Error("unexpected m/c counts");
  const dups = Math.min(2, mCount);
  const repeat = mCount / dups;
  let dLast = dTo;
  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom = dTo.replace(
      new RegExp(
        [
          "((?:",
          "M(\\S+) (\\S+) C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+ ?".repeat(dups),
          "){",
          `${i}`, // skip count
          "})",
          "M(\\S+) (\\S+) C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+ ?".repeat(dups),
          ".*",
        ].join("")
      ),
      (...a) => {
        return (
          `${a[1]}` +
          [...Array(dups).keys()]
            .map((d) => {
              const [x, y] = a.slice(2 + dups * 2 + d * 2);
              return `M${x} ${y} C${x} ${y}, ${x} ${y}, ${x} ${y} `;
            })
            .join("")
            .repeat(repeat - i)
        );
      }
    );
    if (i === 0) {
      ele.setAttribute("d", dFrom);
    }
    const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
    animate.setAttribute("attributeName", "d");
    animate.setAttribute("from", dFrom);
    animate.setAttribute("to", dLast);
    animate.setAttribute("begin", `${currentMs + i * (durationMs / repeat)}ms`);
    animate.setAttribute("dur", `${durationMs / repeat}ms`);
    animate.setAttribute("fill", "freeze");
    ele.appendChild(animate);
    dLast = dFrom;
    animatePointer(
      svg,
      ele,
      dTo.replace(
        new RegExp(
          [
            "(?:",
            "M\\S+ \\S+ C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+ ?".repeat(dups),
            "){",
            `${i}`, // skip count
            "}",
            "(M\\S+ \\S+ C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+) ?".repeat(dups),
            ".*",
          ].join("")
        ),
        "$1"
      ),
      currentMs + i * (durationMs / repeat),
      durationMs / repeat
    );
  }
};

let pathForTextIndex = 0;

const animateText = (
  svg: SVGSVGElement,
  width: number,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  const anchor = ele.getAttribute("text-anchor") || "start";
  if (anchor !== "start") {
    // Not sure how to support it, fallback with opacity
    const toOpacity = ele.getAttribute("opacity") || "1.0";
    const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
    animate.setAttribute("attributeName", "opacity");
    animate.setAttribute("from", "0.0");
    animate.setAttribute("to", toOpacity);
    animate.setAttribute("begin", `${currentMs}ms`);
    animate.setAttribute("dur", `${durationMs}ms`);
    animate.setAttribute("fill", "freeze");
    ele.appendChild(animate);
    ele.setAttribute("opacity", "0.0");
    return;
  }
  const x = Number(ele.getAttribute("x") || 0);
  const y = Number(ele.getAttribute("y") || 0);
  pathForTextIndex += 1;
  const path = svg.ownerDocument.createElementNS(SVG_NS, "path");
  path.setAttribute("id", "pathForText" + pathForTextIndex);
  const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
  animate.setAttribute("attributeName", "d");
  animate.setAttribute("from", `m${x} ${y} h0`);
  animate.setAttribute("to", `m${x} ${y} h${width}`);
  animate.setAttribute("begin", `${currentMs}ms`);
  animate.setAttribute("dur", `${durationMs}ms`);
  animate.setAttribute("fill", "freeze");
  path.appendChild(animate);
  const textPath = svg.ownerDocument.createElementNS(SVG_NS, "textPath");
  textPath.setAttribute("href", "#pathForText" + pathForTextIndex);
  textPath.textContent = ele.textContent;
  ele.textContent = " "; // HACK for Firebox as `null` does not work
  findNode(svg, "defs")?.appendChild(path);
  ele.appendChild(textPath);
  animatePointer(svg, ele, `m${x} ${y} h${width}`, currentMs, durationMs);
};

const patchSvgLine = (
  svg: SVGSVGElement,
  ele: SVGElement,
  strokeSharpness: string,
  currentMs: number,
  durationMs: number
) => {
  const animateLine =
    strokeSharpness !== "sharp" ? animatePath : animatePolygon;
  const childNodes = ele.childNodes as NodeListOf<SVGElement>;
  if (childNodes[0].getAttribute("fill-rule")) {
    animateLine(
      svg,
      childNodes[0].childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75
    );
    currentMs += durationMs * 0.75;
    animateFillPath(
      svg,
      childNodes[0].childNodes[0] as SVGElement,
      currentMs,
      durationMs * 0.25
    );
  } else {
    animateLine(
      svg,
      childNodes[0].childNodes[0] as SVGElement,
      currentMs,
      durationMs
    );
  }
};

const patchSvgArrow = (
  svg: SVGSVGElement,
  ele: SVGElement,
  strokeSharpness: string,
  currentMs: number,
  durationMs: number
) => {
  const animateLine =
    strokeSharpness !== "sharp" ? animatePath : animatePolygon;
  const numParts = ele.childNodes.length;
  animateLine(
    svg,
    ele.childNodes[0].childNodes[0] as SVGElement,
    currentMs,
    (durationMs / (numParts + 2)) * 3
  );
  currentMs += (durationMs / (numParts + 2)) * 3;
  for (let i = 1; i < numParts; i += 1) {
    const numChildren = ele.childNodes[i].childNodes.length;
    for (let j = 0; j < numChildren; j += 1) {
      animatePath(
        svg,
        ele.childNodes[i].childNodes[j] as SVGElement,
        currentMs,
        durationMs / (numParts + 2) / numChildren
      );
      currentMs += durationMs / (numParts + 2) / numChildren;
    }
  }
};

const patchSvgRectangle = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  if (ele.childNodes[1]) {
    animatePolygon(
      svg,
      ele.childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75
    );
    currentMs += durationMs * 0.75;
    animateFillPath(
      svg,
      ele.childNodes[0] as SVGElement,
      currentMs,
      durationMs * 0.25
    );
  } else {
    animatePolygon(svg, ele.childNodes[0] as SVGElement, currentMs, durationMs);
  }
};

const patchSvgEllipse = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  if (ele.childNodes[1]) {
    animatePath(
      svg,
      ele.childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75
    );
    currentMs += durationMs * 0.75;
    animateFillPath(
      svg,
      ele.childNodes[0] as SVGElement,
      currentMs,
      durationMs * 0.25
    );
  } else {
    animatePath(svg, ele.childNodes[0] as SVGElement, currentMs, durationMs);
  }
};

const patchSvgText = (
  svg: SVGSVGElement,
  ele: SVGElement,
  width: number,
  currentMs: number,
  durationMs: number
) => {
  const childNodes = ele.childNodes as NodeListOf<SVGElement>;
  const len = childNodes.length;
  childNodes.forEach((child) => {
    animateText(svg, width, child, currentMs, durationMs / len);
    currentMs += durationMs / len;
  });
};

const patchSvgEle = (
  svg: SVGSVGElement,
  ele: SVGElement,
  type: string,
  strokeSharpness: string,
  width: number,
  currentMs: number,
  durationMs: number
) => {
  if (type === "line") {
    patchSvgLine(svg, ele, strokeSharpness, currentMs, durationMs);
  } else if (type === "draw") {
    patchSvgLine(svg, ele, "round", currentMs, durationMs);
  } else if (type === "arrow") {
    patchSvgArrow(svg, ele, strokeSharpness, currentMs, durationMs);
  } else if (type === "rectangle" || type === "diamond") {
    patchSvgRectangle(svg, ele, currentMs, durationMs);
  } else if (type === "ellipse") {
    patchSvgEllipse(svg, ele, currentMs, durationMs);
  } else if (type === "text") {
    patchSvgText(svg, ele, width, currentMs, durationMs);
  }
};

const createGroups = (
  svg: SVGSVGElement,
  elements: readonly NonDeletedExcalidrawElement[]
) => {
  const groups: { [groupId: string]: (readonly [SVGElement, number])[] } = {};
  let index = 0;
  const childNodes = svg.childNodes as NodeListOf<SVGElement>;
  childNodes.forEach((ele) => {
    if (ele.tagName === "g") {
      const { groupIds } = elements[index];
      if (groupIds.length >= 1) {
        const groupId = groupIds[0];
        groups[groupId] = groups[groupId] || [];
        groups[groupId].push([ele, index] as const);
      }
      index += 1;
    }
  });
  return groups;
};

export const animateSvg = (
  svg: SVGSVGElement,
  elements: readonly NonDeletedExcalidrawElement[],
  startMs?: number
) => {
  let finishedMs;
  const groups = createGroups(svg, elements);
  const finished = new Map();
  let current = startMs ?? 1000; // 1 sec margin
  const groupDur = 5000;
  const individualDur = 500;
  let index = 0;
  (svg.childNodes as NodeListOf<SVGElement>).forEach((ele) => {
    if (ele.tagName === "g") {
      const { type, strokeSharpness, width, groupIds } = elements[index];
      if (!finished.has(ele)) {
        if (groupIds.length >= 1) {
          const groupId = groupIds[0];
          const group = groups[groupId];
          const dur = groupDur / (group.length + 1);
          patchSvgEle(svg, ele, type, strokeSharpness, width, current, dur);
          current += dur;
          finished.set(ele, true);
          group.forEach(([childEle, childIndex]) => {
            const {
              type: childType,
              strokeSharpness: chileStrokeSharpness,
              width: childWidth,
            } = elements[childIndex];
            if (!finished.has(childEle)) {
              patchSvgEle(
                svg,
                childEle,
                childType,
                chileStrokeSharpness,
                childWidth,
                current,
                dur
              );
              current += dur;
              finished.set(childEle, true);
            }
          });
          delete groups[groupId];
        } else {
          patchSvgEle(
            svg,
            ele,
            type,
            strokeSharpness,
            width,
            current,
            individualDur
          );
          current += individualDur;
          finished.set(ele, true);
        }
      }
      index += 1;
    }
  });
  finishedMs = current + 1000; // 1 sec margin
  return { finishedMs };
};

export const getBeginTimeList = (svg: SVGSVGElement) => {
  const beginTimeList: number[] = [];
  const tmpTimeList: number[] = [];
  const findAnimate = (ele: SVGElement) => {
    if (ele.tagName === "animate") {
      const match = /([0-9.]+)ms/.exec(ele.getAttribute("begin") || "");
      if (match) {
        tmpTimeList.push(Number(match[1]));
      }
    }
    (ele.childNodes as NodeListOf<SVGElement>).forEach((ele) => {
      findAnimate(ele);
    });
  };
  (svg.childNodes as NodeListOf<SVGElement>).forEach((ele) => {
    if (ele.tagName === "g") {
      findAnimate(ele);
      if (tmpTimeList.length) {
        beginTimeList.push(Math.min(...tmpTimeList));
        tmpTimeList.splice(0);
      }
    } else if (ele.tagName === "defs") {
      (ele.childNodes as NodeListOf<SVGElement>).forEach((ele) => {
        findAnimate(ele);
        if (tmpTimeList.length) {
          beginTimeList.push(Math.min(...tmpTimeList));
          tmpTimeList.splice(0);
        }
      });
    }
  });
  return beginTimeList;
};
