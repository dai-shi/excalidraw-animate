// This file is tentative.
// We would like to reorganize it with React & TypeScript.

import { fileSave } from "browser-nativefs";

import { SVG_NS } from "./excalidraw/src/utils";
import { importFromBackend } from "./excalidraw/src/data";
import { exportToSvg } from "./excalidraw/src/scene/export";

const resourceCache = new Map();

const embedUrlResources = async (text) => {
  const urls = text.match(/url\(".*?"\);/g);
  const resources = await Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve, reject) => {
          url = url.slice(5, -3);
          if (resourceCache.has(url)) {
            resolve(resourceCache.get(url));
            return;
          }
          fetch(url)
            .then((response) => response.blob())
            .then((blob) => {
              const reader = new FileReader();
              reader.onload = () => {
                const resource = `url(${reader.result});`;
                resourceCache.set(url, resource);
                resolve(resource);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            })
            .catch(reject);
        })
    )
  );
  return text.replace(/url\(".*?"\);/g, () => resources.shift());
};

const findNode = (ele, name) => {
  for (let i = 0; i < ele.childNodes.length; ++i) {
    if (ele.childNodes[i].tagName === name) {
      return ele.childNodes[i];
    }
  }
  return null;
};

const animatePath = (svg, ele, currentMs, durationMs) => {
  const dTo = ele.getAttribute("d");
  const mCount = dTo.match(/M/g).length;
  const cCount = dTo.match(/C/g).length;
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

const animateFillPath = (svg, ele, currentMs, durationMs) => {
  const dTo = ele.getAttribute("d");
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

const animateRect = (svg, ele, currentMs, durationMs) => {
  const dTo = ele.getAttribute("d");
  const mCount = dTo.match(/M/g).length;
  const cCount = dTo.match(/C/g).length;
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

const animateText = (svg, width, ele, currentMs, durationMs) => {
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
  ele.textContent = null;
  findNode(svg, "defs").appendChild(path);
  ele.appendChild(textPath);
};

const patchSvgLine = (svg, ele, currentMs, durationMs) => {
  if (ele.childNodes[0].getAttribute("fill-rule")) {
    animatePath(
      svg,
      ele.childNodes[0].childNodes[1],
      currentMs,
      durationMs * 0.75
    );
    currentMs += durationMs * 0.75;
    animateFillPath(
      svg,
      ele.childNodes[0].childNodes[0],
      currentMs,
      durationMs * 0.25
    );
  } else {
    animatePath(svg, ele.childNodes[0].childNodes[0], currentMs, durationMs);
  }
};

const patchSvgArrow = (svg, ele, currentMs, durationMs) => {
  animatePath(
    svg,
    ele.childNodes[0].childNodes[0],
    currentMs,
    durationMs * 0.6
  );
  currentMs += durationMs * 0.6;
  animatePath(
    svg,
    ele.childNodes[1].childNodes[0],
    currentMs,
    durationMs * 0.2
  );
  currentMs += durationMs * 0.2;
  animatePath(
    svg,
    ele.childNodes[2].childNodes[0],
    currentMs,
    durationMs * 0.2
  );
};

const patchSvgRectangle = (svg, ele, currentMs, durationMs) => {
  if (ele.childNodes[1]) {
    animateRect(svg, ele.childNodes[1], currentMs, durationMs * 0.75);
    currentMs += durationMs * 0.75;
    animateFillPath(svg, ele.childNodes[0], currentMs, durationMs * 0.25);
  } else {
    animateRect(svg, ele.childNodes[0], currentMs, durationMs);
  }
};

const patchSvgEllipse = (svg, ele, currentMs, durationMs) => {
  if (ele.childNodes[1]) {
    animatePath(svg, ele.childNodes[1], currentMs, durationMs * 0.75);
    currentMs += durationMs * 0.75;
    animateFillPath(svg, ele.childNodes[0], currentMs, durationMs * 0.25);
  } else {
    animatePath(svg, ele.childNodes[0], currentMs, durationMs);
  }
};

const patchSvgText = (svg, ele, width, currentMs, durationMs) => {
  const len = ele.childNodes.length;
  ele.childNodes.forEach((child, index) => {
    animateText(svg, width, child, currentMs, durationMs / len);
    currentMs += durationMs / len;
  });
};

const patchSvgEle = (svg, ele, type, width, currentMs, durationMs) => {
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

const createGroups = (svg, elements) => {
  const groups = {};
  let index = 0;
  svg.childNodes.forEach((ele) => {
    if (ele.tagName === "g") {
      const { groupIds } = elements[index];
      if (groupIds.length >= 1) {
        const groupId = groupIds[0];
        groups[groupId] = groups[groupId] || [];
        groups[groupId].push([ele, index]);
      }
      index += 1;
    }
  });
  return groups;
};

let finishedMs;

const patchSvg = (svg, elements) => {
  const groups = createGroups(svg, elements);
  const finished = new Map();
  let current = 1000; // 1 sec margin
  const groupDur = 5000;
  const individualDur = 500;
  let index = 0;
  svg.childNodes.forEach((ele) => {
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
};

let svg;
const main = async () => {
  const container = document.getElementById("container");
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(hash);
  if (searchParams.get("toolbar") !== "no") {
    try {
      document.getElementById("toolbar").style.display = "block";
    } catch (e) {
      // ignore
    }
  }
  const match = /([0-9]+),?([a-zA-Z0-9_-]*)/.exec(searchParams.get("json"));
  if (!match) {
    try {
      container.removeChild(container.firstChild);
    } catch (e) {
      // ignore
    }
    return;
  }
  const [, id, key] = match;
  const { elements } = await importFromBackend(id, key);
  svg = exportToSvg(elements, {
    exportBackground: true,
    exportPadding: 30,
    viewBackgroundColor: "white",
    shouldAddWatermark: false,
  });
  patchSvg(svg, elements);
  container.removeChild(container.firstChild);
  container.appendChild(svg);
  console.log(svg);
  if (searchParams.get("autoplay") === "no") {
    svg.setCurrentTime(finishedMs);
    container.addEventListener("click", () => {
      svg.setCurrentTime(0);
    });
  }
};

const generateImagesFromSvg = (fps) =>
  new Promise((resolve, reject) => {
    const container = document.getElementById("container");
    const svgEle = container.getElementsByTagName("svg")[0];
    svgEle.pauseAnimations();
    const images = [];
    const loop = async (t) => {
      if (t > finishedMs) {
        svgEle.unpauseAnimations();
        resolve(images);
        return;
      }
      svgEle.setCurrentTime(t / 1000);
      const html = await embedUrlResources(container.innerHTML);
      const img = new Image();
      img.src = "data:image/svg+xml;base64," + btoa(html);
      img.onload = () => {
        images.push(img);
        loop(t + 1000 / fps);
      };
      img.onerror = reject;
    };
    loop(0);
  });

window.addEventListener("load", main);

window.loadLink = (event) => {
  event.preventDefault();
  const match = /#json=([0-9]+),?([a-zA-Z0-9_-]*)/.exec(
    event.target.link.value
  );
  if (!match) {
    window.alert("Invalid link");
    return;
  }
  window.location.hash = match[0];
  window.location.reload();
};

window.pauseResumeAnimations = (event) => {
  const container = document.getElementById("container");
  const svgEle = container.getElementsByTagName("svg")[0];
  if (svgEle.animationsPaused()) {
    event.target.innerHTML = "Pause";
    svgEle.unpauseAnimations();
  } else {
    event.target.innerHTML = "Resume";
    svgEle.pauseAnimations();
  }
};

window.resetAnimations = (event) => {
  const container = document.getElementById("container");
  container.getElementsByTagName("svg")[0].setCurrentTime(0);
};

window.exportToSvgFile = async (event) => {
  if (!svg) {
    alert("svg not ready");
    return;
  }
  const savedMs = svg.getCurrentTime();
  svg.setCurrentTime(0);
  const svgStr = new XMLSerializer().serializeToString(svg);
  svg.setCurrentTime(savedMs);
  await fileSave(new Blob([svgStr], { type: "svg" }), {
    fileName: "excalidraw-animate.svg",
  });
};

window.exportToWebmFile = async (event) => {
  if (!svg) {
    alert("svg not ready");
    return;
  }
  const origHtml = event.target.innerHTML;
  event.target.innerHTML = `${origHtml} (Processing...)`;
  event.target.disabled = true;
  const images = await generateImagesFromSvg(60);
  const [, width, height] = svg
    .getAttribute("viewBox")
    .match(/0 0 (\S+) (\S+)/);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", `${width}px`);
  canvas.setAttribute("height", `${height}px`);
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream();
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = async (e) => {
    await fileSave(new Blob([e.data], { type: e.data.type }), {
      fileName: "excalidraw-animate.webm",
    });
    event.target.innerHTML = origHtml;
    event.target.disabled = false;
  };
  recorder.start();
  let index = 0;
  const drawSvg = () => {
    if (index >= images.length) {
      recorder.stop();
      return;
    }
    ctx.drawImage(images[index], 0, 0);
    index += 1;
    setTimeout(drawSvg, 1000 / 60);
  };
  drawSvg();
};
