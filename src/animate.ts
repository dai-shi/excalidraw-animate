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

const animateRect = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  const dTo = ele.getAttribute("d") || "";
  const mCount = dTo.match(/M/g)?.length || 0;
  const cCount = dTo.match(/C/g)?.length || 0;
  if (mCount !== cCount) throw new Error("unexpected m/c counts");
  const repeat = 4;
  const dups = mCount / repeat;
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
  const y = ele.getAttribute("y");
  pathForTextIndex += 1;
  const path = svg.ownerDocument.createElementNS(SVG_NS, "path");
  path.setAttribute("id", "pathForText" + pathForTextIndex);
  const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
  animate.setAttribute("attributeName", "d");
  animate.setAttribute("from", `m0,${y} h0`);
  animate.setAttribute("to", `m0,${y} h${width}`);
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
};

const patchSvgLine = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  const childNodes = ele.childNodes as NodeListOf<SVGElement>;
  if (childNodes[0].getAttribute("fill-rule")) {
    animatePath(
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
    animatePath(
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
  currentMs: number,
  durationMs: number
) => {
  animatePath(
    svg,
    ele.childNodes[0].childNodes[0] as SVGElement,
    currentMs,
    durationMs * 0.6
  );
  currentMs += durationMs * 0.6;
  animatePath(
    svg,
    ele.childNodes[1].childNodes[0] as SVGElement,
    currentMs,
    durationMs * 0.2
  );
  currentMs += durationMs * 0.2;
  animatePath(
    svg,
    ele.childNodes[2].childNodes[0] as SVGElement,
    currentMs,
    durationMs * 0.2
  );
};

const patchSvgRectangle = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number
) => {
  if (ele.childNodes[1]) {
    animateRect(
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
    animateRect(svg, ele.childNodes[0] as SVGElement, currentMs, durationMs);
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
  width: number,
  currentMs: number,
  durationMs: number
) => {
  if (type === "line" || type === "draw") {
    patchSvgLine(svg, ele, currentMs, durationMs);
  } else if (type === "arrow") {
    patchSvgArrow(svg, ele, currentMs, durationMs);
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
  elements: readonly NonDeletedExcalidrawElement[]
) => {
  let finishedMs;
  const groups = createGroups(svg, elements);
  const finished = new Map();
  let current = 1000; // 1 sec margin
  const groupDur = 5000;
  const individualDur = 500;
  let index = 0;
  (svg.childNodes as NodeListOf<SVGElement>).forEach((ele) => {
    if (ele.tagName === "g") {
      const { type, width, groupIds } = elements[index];
      if (!finished.has(ele)) {
        if (groupIds.length >= 1) {
          const groupId = groupIds[0];
          const group = groups[groupId];
          const dur = groupDur / (group.length + 1);
          patchSvgEle(svg, ele, type, width, current, dur);
          current += dur;
          finished.set(ele, true);
          group.forEach(([childEle, childIndex]) => {
            const { type: childType, width: childWidth } = elements[childIndex];
            if (!finished.has(childEle)) {
              patchSvgEle(svg, childEle, childType, childWidth, current, dur);
              current += dur;
              finished.set(childEle, true);
            }
          });
          delete groups[groupId];
        } else {
          patchSvgEle(svg, ele, type, width, current, individualDur);
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
