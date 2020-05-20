const EXCALIDRAW_NS = "https://excalidraw.com/svg";

let currentMs = 0;

const animatePath = (svg, ele, ms) => {
  const dTo = ele.getAttribute("d");
  const mCount = dTo.match(/M/g).length;
  const cCount = dTo.match(/C/g).length;
  const repeat = cCount / mCount;
  let dLast = dTo;
  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom = dTo.replace(new RegExp([
      "M(\\S+) (\\S+)",
      "((?: C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+){",
      `${i}`, // skip count
      "})",
      "(?: C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+){1,}",
    ].join(""), "g"), (...a) => {
      const [x, y] = a[3]
        ? a[3].match(/.* (\S+) (\S+)$/).slice(1, 3)
        : [a[1], a[2]];
      return `M${a[1]} ${a[2]}${a[3]}` + ` C${x} ${y}, ${x} ${y}, ${x} ${y}`.repeat(repeat - i);
    });
    if (i === 0) {
      ele.setAttribute("d", dFrom);
    }
    const animate = svg.ownerDocument.createElementNS(SVG_NS, "animate");
    animate.setAttribute("attributeName", "d");
    animate.setAttribute("from", dFrom);
    animate.setAttribute("to", dLast);
    animate.setAttribute("begin", `${currentMs + i * (ms / repeat)}ms`);
    animate.setAttribute("dur", `${ms / repeat}ms`);
    animate.setAttribute("fill", "freeze");
    ele.appendChild(animate);
    dLast = dFrom;
  }
  currentMs += ms;
}

const patchSvgLine = (svg, ele) => {
  animatePath(svg, ele.childNodes[0].childNodes[0], 1000);
};

const patchSvgArrow = (svg, ele) => {
  animatePath(svg, ele.childNodes[0].childNodes[0], 1000);
  animatePath(svg, ele.childNodes[1].childNodes[0], 200);
  animatePath(svg, ele.childNodes[2].childNodes[0], 200);
};

const patchSvg = (svg) => {
  const walk = (ele) => {
    const type = ele.getAttributeNS && ele.getAttributeNS(EXCALIDRAW_NS, "element-type");
    if (type === "line" || type === "draw") {
      patchSvgLine(svg, ele);
    } else if (type === "arrow") {
      patchSvgArrow(svg, ele);
    }
    ele.childNodes.forEach(walk);
  };
  walk(svg);
};

let restore;
const main = async () => {
  const [, id, key] = /json=([0-9]+),?([a-zA-Z0-9_-]*)/.exec(location.hash);
  let elements;
  restore = (e) => { elements = e };
  await importFromBackend(id, key);
  const svg = exportToSvg(elements, {
    exportBackground: false,
    exportPadding: 30,
    viewBackgroundColor: "lightgreen",
    shouldAddWatermark: false,
  });
  patchSvg(svg);
  document.body.appendChild(svg);
  console.log(svg);
};

window.addEventListener('load', main);

const t = x => x;

// --------------------------------------
// copied code from core (See: ADDED)
// --------------------------------------

const BACKEND_GET = "https://json.excalidraw.com/api/v1/";
const BACKEND_V2_POST = "https://json.excalidraw.com/api/v2/post/";
const BACKEND_V2_GET = "https://json.excalidraw.com/api/v2/";

async function importFromBackend(
  id,
  privateKey,
) {
  let elements = [];
  let appState = {};

  try {
    const response = await fetch(
      privateKey ? `${BACKEND_V2_GET}${id}` : `${BACKEND_GET}${id}.json`,
      { mode: "cors" }, // ADDED
    );
    if (!response.ok) {
      window.alert(t("alerts.importBackendFailed"));
      return restore(elements, appState, { scrollToContent: true });
    }
    let data;
    if (privateKey) {
      const buffer = await response.arrayBuffer();
      const key = await getImportedKey(privateKey, "decrypt");
      const iv = new Uint8Array(12);
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
        },
        key,
        buffer,
      );
      // We need to convert the decrypted array buffer to a string
      const string = new window.TextDecoder("utf-8").decode(
        new Uint8Array(decrypted),
      );
      data = JSON.parse(string);
    } else {
      // Legacy format
      data = await response.json();
    }

    elements = data.elements || elements;
    appState = data.appState || appState;
  } catch (error) {
    window.alert(t("alerts.importBackendFailed"));
    console.error(error);
  } finally {
    return restore(elements, appState, { scrollToContent: true });
  }
}

function getImportedKey(key, usage) {
  return window.crypto.subtle.importKey(
    "jwk",
    {
      alg: "A128GCM",
      ext: true,
      k: key,
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    },
    {
      name: "AES-GCM",
      length: 128,
    },
    false, // extractable
    [usage],
  );
}

async function decryptAESGEM(
  data,
  key,
  iv,
) {
  try {
    const importedKey = await getImportedKey(key, "decrypt");
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      importedKey,
      data,
    );

    const decodedData = new TextDecoder("utf-8").decode(
      new Uint8Array(decrypted),
    );
    return JSON.parse(decodedData);
  } catch (error) {
    window.alert(t("alerts.decryptFailed"));
    console.error(error);
  }
  return {
    type: "INVALID_RESPONSE",
  };
}

function exportToSvg(
  elements,
  {
    exportBackground,
    exportPadding = 10,
    viewBackgroundColor,
    shouldAddWatermark,
  },
) {
  let sceneElements = elements;
  if (shouldAddWatermark) {
    const [, , maxX, maxY] = getCommonBounds(elements);
    sceneElements = [...sceneElements, getWatermarkElement(maxX, maxY)];
  }

  // calculate canvas dimensions
  const [minX, minY, maxX, maxY] = getCommonBounds(sceneElements);
  const width = distance(minX, maxX) + exportPadding * 2;
  const height =
    distance(minY, maxY) +
    exportPadding +
    (shouldAddWatermark ? 0 : exportPadding);

  // initialze SVG root
  const svgRoot = document.createElementNS(SVG_NS, "svg");
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute("xmlns:excalidraw", EXCALIDRAW_NS); // ADDED
  svgRoot.setAttribute("viewBox", `0 0 ${width} ${height}`);

  svgRoot.innerHTML = `
  ${SVG_EXPORT_TAG}
  <defs>
    <style>
      @font-face {
        font-family: "Virgil";
        src: url("https://excalidraw.com/FG_Virgil.woff2");
      }
      @font-face {
        font-family: "Cascadia";
        src: url("https://excalidraw.com/Cascadia.woff2");
      }
    </style>
  </defs>
  `;

  // render backgroiund rect
  if (exportBackground && viewBackgroundColor) {
    const rect = svgRoot.ownerDocument.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", `${width}`);
    rect.setAttribute("height", `${height}`);
    rect.setAttribute("fill", viewBackgroundColor);
    svgRoot.appendChild(rect);
  }

  const rsvg = rough.svg(svgRoot);
  renderSceneToSvg(sceneElements, rsvg, svgRoot, {
    offsetX: -minX + exportPadding,
    offsetY: -minY + exportPadding,
  });

  return svgRoot;
}

function getElementAbsoluteCoords(
  element,
) {
  if (isLinearElement(element)) {
    return getLinearElementAbsoluteCoords(element);
  }
  return [
    element.x,
    element.y,
    element.x + element.width,
    element.y + element.height,
  ];
}

function getDiamondPoints(element) {
  // Here we add +1 to avoid these numbers to be 0
  // otherwise rough.js will throw an error complaining about it
  const topX = Math.floor(element.width / 2) + 1;
  const topY = 0;
  const rightX = element.width;
  const rightY = Math.floor(element.height / 2) + 1;
  const bottomX = topX;
  const bottomY = element.height;
  const leftX = topY;
  const leftY = rightY;

  return [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY];
}

function getCurvePathOps(shape) {
  for (const set of shape.sets) {
    if (set.type === "path") {
      return set.ops;
    }
  }
  return shape.sets[0].ops;
}

const getMinMaxXYFromCurvePathOps = (
  ops,
  transformXY,
) => {
  let currentP = [0, 0];
  const { minX, minY, maxX, maxY } = ops.reduce(
    (limits, { op, data }) => {
      // There are only four operation types:
      // move, bcurveTo, lineTo, and curveTo
      if (op === "move") {
        // change starting point
        currentP = data;
        // move operation does not draw anything; so, it always
        // returns false
      } else if (op === "bcurveTo") {
        // create points from bezier curve
        // bezier curve stores data as a flattened array of three positions
        // [x1, y1, x2, y2, x3, y3]
        const p1 = [data[0], data[1]];
        const p2 = [data[2], data[3]];
        const p3 = [data[4], data[5]];

        const p0 = currentP;
        currentP = p3;

        const equation = (t, idx) =>
          Math.pow(1 - t, 3) * p3[idx] +
          3 * t * Math.pow(1 - t, 2) * p2[idx] +
          3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
          p0[idx] * Math.pow(t, 3);

        let t = 0;
        while (t <= 1.0) {
          let x = equation(t, 0);
          let y = equation(t, 1);
          if (transformXY) {
            [x, y] = transformXY(x, y);
          }

          limits.minY = Math.min(limits.minY, y);
          limits.minX = Math.min(limits.minX, x);

          limits.maxX = Math.max(limits.maxX, x);
          limits.maxY = Math.max(limits.maxY, y);

          t += 0.1;
        }
      } else if (op === "lineTo") {
        // TODO: Implement this
      } else if (op === "qcurveTo") {
        // TODO: Implement this
      }
      return limits;
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  return [minX, minY, maxX, maxY];
};

const getLinearElementAbsoluteCoords = (
  element,
) => {
  if (element.points.length < 2 || !getShapeForElement(element)) {
    const { minX, minY, maxX, maxY } = element.points.reduce(
      (limits, [x, y]) => {
        limits.minY = Math.min(limits.minY, y);
        limits.minX = Math.min(limits.minX, x);

        limits.maxX = Math.max(limits.maxX, x);
        limits.maxY = Math.max(limits.maxY, y);

        return limits;
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    return [
      minX + element.x,
      minY + element.y,
      maxX + element.x,
      maxY + element.y,
    ];
  }

  const shape = getShapeForElement(element);

  // first element is always the curve
  const ops = getCurvePathOps(shape[0]);

  const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);

  return [
    minX + element.x,
    minY + element.y,
    maxX + element.x,
    maxY + element.y,
  ];
};

const getLinearElementRotatedBounds = (
  element,
  cx,
  cy,
) => {
  if (element.points.length < 2 || !getShapeForElement(element)) {
    const { minX, minY, maxX, maxY } = element.points.reduce(
      (limits, [x, y]) => {
        [x, y] = rotate(element.x + x, element.y + y, cx, cy, element.angle);
        limits.minY = Math.min(limits.minY, y);
        limits.minX = Math.min(limits.minX, x);
        limits.maxX = Math.max(limits.maxX, x);
        limits.maxY = Math.max(limits.maxY, y);
        return limits;
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    return [minX, minY, maxX, maxY];
  }

  const shape = getShapeForElement(element);

  // first element is always the curve
  const ops = getCurvePathOps(shape[0]);

  const transformXY = (x, y) =>
    rotate(element.x + x, element.y + y, cx, cy, element.angle);
  return getMinMaxXYFromCurvePathOps(ops, transformXY);
};

const getElementBounds = (
  element,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  if (isLinearElement(element)) {
    return getLinearElementRotatedBounds(element, cx, cy);
  }
  if (element.type === "diamond") {
    const [x11, y11] = rotate(cx, y1, cx, cy, element.angle);
    const [x12, y12] = rotate(cx, y2, cx, cy, element.angle);
    const [x22, y22] = rotate(x1, cy, cx, cy, element.angle);
    const [x21, y21] = rotate(x2, cy, cx, cy, element.angle);
    const minX = Math.min(x11, x12, x22, x21);
    const minY = Math.min(y11, y12, y22, y21);
    const maxX = Math.max(x11, x12, x22, x21);
    const maxY = Math.max(y11, y12, y22, y21);
    return [minX, minY, maxX, maxY];
  }
  if (element.type === "ellipse") {
    const w = (x2 - x1) / 2;
    const h = (y2 - y1) / 2;
    const cos = Math.cos(element.angle);
    const sin = Math.sin(element.angle);
    const ww = Math.hypot(w * cos, h * sin);
    const hh = Math.hypot(h * cos, w * sin);
    return [cx - ww, cy - hh, cx + ww, cy + hh];
  }
  const [x11, y11] = rotate(x1, y1, cx, cy, element.angle);
  const [x12, y12] = rotate(x1, y2, cx, cy, element.angle);
  const [x22, y22] = rotate(x2, y2, cx, cy, element.angle);
  const [x21, y21] = rotate(x2, y1, cx, cy, element.angle);
  const minX = Math.min(x11, x12, x22, x21);
  const minY = Math.min(y11, y12, y22, y21);
  const maxX = Math.max(x11, x12, x22, x21);
  const maxY = Math.max(y11, y12, y22, y21);
  return [minX, minY, maxX, maxY];
};

const getCommonBounds = (
  elements,
) => {
  if (!elements.length) {
    return [0, 0, 0, 0];
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  elements.forEach((element) => {
    const [x1, y1, x2, y2] = getElementBounds(element);
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  });

  return [minX, minY, maxX, maxY];
};

const shapeCache = new WeakMap();

function getShapeForElement(element) {
  return shapeCache.get(element);
}

function isLinearElement(
  element,
) {
  return (
    element != null &&
    (element.type === "arrow" ||
      element.type === "line" ||
      element.type === "draw")
  );
}

function rotate(
  x1,
  y1,
  x2,
  y2,
  angle,
) {
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  return [
    (x1 - x2) * Math.cos(angle) - (y1 - y2) * Math.sin(angle) + x2,
    (x1 - x2) * Math.sin(angle) + (y1 - y2) * Math.cos(angle) + y2,
  ];
}

function distance(x, y) {
  return Math.abs(x - y);
}

const SVG_NS = "http://www.w3.org/2000/svg";

const SVG_EXPORT_TAG = `<!-- svg-source:excalidraw -->`;

function renderSceneToSvg(
  elements,
  rsvg,
  svgRoot,
  {
    offsetX = 0,
    offsetY = 0,
  } = {},
) {
  if (!svgRoot) {
    return;
  }
  // render elements
  elements.forEach((element) => {
    if (!element.isDeleted) {
      renderElementToSvg(
        element,
        rsvg,
        svgRoot,
        element.x + offsetX,
        element.y + offsetY,
      );
    }
  });
}

function renderElementToSvg(
  element,
  rsvg,
  svgRoot,
  offsetX,
  offsetY,
) {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x2 - x1) / 2 - (element.x - x1);
  const cy = (y2 - y1) / 2 - (element.y - y1);
  const degree = (180 * element.angle) / Math.PI;
  const generator = rsvg.generator;
  switch (element.type) {
    case "selection": {
      // Since this is used only during editing experience, which is canvas based,
      // this should not happen
      throw new Error("Selection rendering is not supported for SVG");
    }
    case "rectangle":
    case "diamond":
    case "ellipse": {
      generateElement(element, generator);
      const node = rsvg.draw(getShapeForElement(element));
      const opacity = element.opacity / 100;
      if (opacity !== 1) {
        node.setAttribute("stroke-opacity", `${opacity}`);
        node.setAttribute("fill-opacity", `${opacity}`);
      }
      node.setAttribute(
        "transform",
        `translate(${offsetX || 0} ${
          offsetY || 0
        }) rotate(${degree} ${cx} ${cy})`,
      );
      node.setAttributeNS(EXCALIDRAW_NS, "excalidraw:element-type", element.type); // ADDED
      svgRoot.appendChild(node);
      break;
    }
    case "line":
    case "draw":
    case "arrow": {
      generateElement(element, generator);
      const group = svgRoot.ownerDocument.createElementNS(SVG_NS, "g");
      const opacity = element.opacity / 100;
      (getShapeForElement(element)).forEach((shape) => {
        const node = rsvg.draw(shape);
        if (opacity !== 1) {
          node.setAttribute("stroke-opacity", `${opacity}`);
          node.setAttribute("fill-opacity", `${opacity}`);
        }
        node.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );
        if (
          (element.type === "line" || element.type === "draw") &&
          isPathALoop(element.points) &&
          element.backgroundColor !== "transparent"
        ) {
          node.setAttribute("fill-rule", "evenodd");
        }
        group.appendChild(node);
      });
      group.setAttributeNS(EXCALIDRAW_NS, "excalidraw:element-type", element.type); // ADDED
      svgRoot.appendChild(group);
      break;
    }
    default: {
      if (isTextElement(element)) {
        const opacity = element.opacity / 100;
        const node = svgRoot.ownerDocument.createElementNS(SVG_NS, "g");
        if (opacity !== 1) {
          node.setAttribute("stroke-opacity", `${opacity}`);
          node.setAttribute("fill-opacity", `${opacity}`);
        }
        node.setAttribute(
          "transform",
          `translate(${offsetX || 0} ${
            offsetY || 0
          }) rotate(${degree} ${cx} ${cy})`,
        );
        const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
        const lineHeight = element.height / lines.length;
        const verticalOffset = element.height - element.baseline;
        const horizontalOffset =
          element.textAlign === "center"
            ? element.width / 2
            : element.textAlign === "right"
            ? element.width
            : 0;
        const fontSplit = element.font.split(" ").filter((d) => !!d.trim());
        let fontFamily = fontSplit[0];
        let fontSize = "20px";
        if (fontSplit.length > 1) {
          fontFamily = fontSplit[1];
          fontSize = fontSplit[0];
        }
        const textAnchor =
          element.textAlign === "center"
            ? "middle"
            : element.textAlign === "right"
            ? "end"
            : "start";
        for (let i = 0; i < lines.length; i++) {
          const text = svgRoot.ownerDocument.createElementNS(SVG_NS, "text");
          text.textContent = lines[i];
          text.setAttribute("x", `${horizontalOffset}`);
          text.setAttribute("y", `${(i + 1) * lineHeight - verticalOffset}`);
          text.setAttribute("font-family", fontFamily);
          text.setAttribute("font-size", fontSize);
          text.setAttribute("fill", element.strokeColor);
          text.setAttribute("text-anchor", textAnchor);
          text.setAttribute("style", "white-space: pre;");
          node.appendChild(text);
        }
        node.setAttributeNS(EXCALIDRAW_NS, "excalidraw:element-type", element.type); // ADDED
        svgRoot.appendChild(node);
      } else {
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
}

function generateElement(
  element,
  generator,
  sceneState,
) {
  let shape = shapeCache.get(element) || null;
  if (!shape) {
    elementWithCanvasCache.delete(element);

    const strokeLineDash =
      element.strokeStyle === "dashed"
        ? DASHARRAY_DASHED
        : element.strokeStyle === "dotted"
        ? DASHARRAY_DOTTED
        : undefined;
    // for non-solid strokes, disable multiStroke because it tends to make
    //  dashes/dots overlay each other
    const disableMultiStroke = element.strokeStyle !== "solid";
    // for non-solid strokes, increase the width a bit to make it visually
    //  similar to solid strokes, because we're also disabling multiStroke
    const strokeWidth =
      element.strokeStyle !== "solid"
        ? element.strokeWidth + 0.5
        : element.strokeWidth;
    // when increasing strokeWidth, we must explicitly set fillWeight and
    //  hachureGap because if not specified, roughjs uses strokeWidth to
    //  calculate them (and we don't want the fills to be modified)
    const fillWeight = element.strokeWidth / 2;
    const hachureGap = element.strokeWidth * 4;

    switch (element.type) {
      case "rectangle":
        shape = generator.rectangle(0, 0, element.width, element.height, {
          strokeWidth,
          fillWeight,
          hachureGap,
          strokeLineDash,
          disableMultiStroke,
          stroke: element.strokeColor,
          fill:
            element.backgroundColor === "transparent"
              ? undefined
              : element.backgroundColor,
          fillStyle: element.fillStyle,
          roughness: element.roughness,
          seed: element.seed,
        });

        break;
      case "diamond": {
        const [
          topX,
          topY,
          rightX,
          rightY,
          bottomX,
          bottomY,
          leftX,
          leftY,
        ] = getDiamondPoints(element);
        shape = generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY],
          ],
          {
            strokeWidth,
            fillWeight,
            hachureGap,
            strokeLineDash,
            disableMultiStroke,
            stroke: element.strokeColor,
            fill:
              element.backgroundColor === "transparent"
                ? undefined
                : element.backgroundColor,
            fillStyle: element.fillStyle,
            roughness: element.roughness,
            seed: element.seed,
          },
        );
        break;
      }
      case "ellipse":
        shape = generator.ellipse(
          element.width / 2,
          element.height / 2,
          element.width,
          element.height,
          {
            strokeWidth,
            fillWeight,
            hachureGap,
            strokeLineDash,
            disableMultiStroke,
            stroke: element.strokeColor,
            fill:
              element.backgroundColor === "transparent"
                ? undefined
                : element.backgroundColor,
            fillStyle: element.fillStyle,
            roughness: element.roughness,
            seed: element.seed,
            curveFitting: 1,
          },
        );
        break;
      case "line":
      case "draw":
      case "arrow": {
        const options = {
          strokeWidth,
          fillWeight,
          hachureGap,
          strokeLineDash,
          disableMultiStroke,
          stroke: element.strokeColor,
          seed: element.seed,
          roughness: element.roughness,
        };

        // points array can be empty in the beginning, so it is important to add
        // initial position to it
        const points = element.points.length ? element.points : [[0, 0]];

        // If shape is a line and is a closed shape,
        // fill the shape if a color is set.
        if (element.type === "line" || element.type === "draw") {
          if (isPathALoop(element.points)) {
            options.fillStyle = element.fillStyle;
            options.fill =
              element.backgroundColor === "transparent"
                ? undefined
                : element.backgroundColor;
          }
        }

        // curve is always the first element
        // this simplifies finding the curve for an element
        shape = [generator.curve(points, options)];

        // add lines only in arrow
        if (element.type === "arrow") {
          const [x2, y2, x3, y3, x4, y4] = getArrowPoints(element, shape);
          // for dotted arrows caps, reduce gap to make it more legible
          if (element.strokeStyle === "dotted") {
            options.strokeLineDash = [3, 4];
            // for solid/dashed, keep solid arrow cap
          } else {
            delete options.strokeLineDash;
          }
          shape.push(
            ...[
              generator.line(x3, y3, x2, y2, options),
              generator.line(x4, y4, x2, y2, options),
            ],
          );
        }
        break;
      }
      case "text": {
        // just to ensure we don't regenerate element.canvas on rerenders
        shape = [];
        break;
      }
    }
    shapeCache.set(element, shape);
  }
  const zoom = sceneState ? sceneState.zoom : 1;
  const prevElementWithCanvas = elementWithCanvasCache.get(element);
  const shouldRegenerateBecauseZoom =
    prevElementWithCanvas &&
    prevElementWithCanvas.canvasZoom !== zoom &&
    !sceneState?.shouldCacheIgnoreZoom;
  if (!prevElementWithCanvas || shouldRegenerateBecauseZoom) {
    const elementWithCanvas = generateElementCanvas(element, zoom);
    elementWithCanvasCache.set(element, elementWithCanvas);
    return elementWithCanvas;
  }
  return prevElementWithCanvas;
}

const elementWithCanvasCache = new WeakMap();

function getArrowPoints(
  element,
  shape,
) {
  const ops = getCurvePathOps(shape[0]);

  const data = ops[ops.length - 1].data;
  const p3 = [data[4], data[5]];
  const p2 = [data[2], data[3]];
  const p1 = [data[0], data[1]];

  // we need to find p0 of the bezier curve
  // it is typically the last point of the previous
  // curve; it can also be the position of moveTo operation
  const prevOp = ops[ops.length - 2];
  let p0 = [0, 0];
  if (prevOp.op === "move") {
    p0 = prevOp.data;
  } else if (prevOp.op === "bcurveTo") {
    p0 = [prevOp.data[4], prevOp.data[5]];
  }

  // B(t) = p0 * (1-t)^3 + 3p1 * t * (1-t)^2 + 3p2 * t^2 * (1-t) + p3 * t^3
  const equation = (t, idx) =>
    Math.pow(1 - t, 3) * p3[idx] +
    3 * t * Math.pow(1 - t, 2) * p2[idx] +
    3 * Math.pow(t, 2) * (1 - t) * p1[idx] +
    p0[idx] * Math.pow(t, 3);

  // we know the last point of the arrow
  const [x2, y2] = p3;

  // by using cubic bezier equation (B(t)) and the given parameters,
  // we calculate a point that is closer to the last point
  // The value 0.3 is chosen arbitrarily and it works best for all
  // the tested cases
  const [x1, y1] = [equation(0.3, 0), equation(0.3, 1)];

  // find the normalized direction vector based on the
  // previously calculated points
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const nx = (x2 - x1) / distance;
  const ny = (y2 - y1) / distance;

  const size = 30; // pixels
  const arrowLength = element.points.reduce((total, [cx, cy], idx, points) => {
    const [px, py] = idx > 0 ? points[idx - 1] : [0, 0];
    return total + Math.hypot(cx - px, cy - py);
  }, 0);

  // Scale down the arrow until we hit a certain size so that it doesn't look weird
  // This value is selected by minizing a minmum size with the whole length of the arrow
  // intead of last segment of the arrow
  const minSize = Math.min(size, arrowLength / 2);
  const xs = x2 - nx * minSize;
  const ys = y2 - ny * minSize;

  const angle = 20; // degrees
  const [x3, y3] = rotate(xs, ys, x2, y2, (-angle * Math.PI) / 180);
  const [x4, y4] = rotate(xs, ys, x2, y2, (angle * Math.PI) / 180);

  return [x2, y2, x3, y3, x4, y4];
}

function generateElementCanvas(
  element,
  zoom,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  let canvasOffsetX = 0;
  let canvasOffsetY = 0;

  if (isLinearElement(element)) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    canvas.width =
      distance(x1, x2) * window.devicePixelRatio * zoom + CANVAS_PADDING * 2;
    canvas.height =
      distance(y1, y2) * window.devicePixelRatio * zoom + CANVAS_PADDING * 2;

    canvasOffsetX =
      element.x > x1
        ? Math.floor(distance(element.x, x1)) * window.devicePixelRatio
        : 0;
    canvasOffsetY =
      element.y > y1
        ? Math.floor(distance(element.y, y1)) * window.devicePixelRatio
        : 0;
    context.translate(canvasOffsetX * zoom, canvasOffsetY * zoom);
  } else {
    canvas.width =
      element.width * window.devicePixelRatio * zoom + CANVAS_PADDING * 2;
    canvas.height =
      element.height * window.devicePixelRatio * zoom + CANVAS_PADDING * 2;
  }

  context.translate(CANVAS_PADDING, CANVAS_PADDING);
  context.scale(window.devicePixelRatio * zoom, window.devicePixelRatio * zoom);

  const rc = rough.canvas(canvas);
  drawElementOnCanvas(element, rc, context);
  context.translate(-CANVAS_PADDING, -CANVAS_PADDING);
  context.scale(
    1 / (window.devicePixelRatio * zoom),
    1 / (window.devicePixelRatio * zoom),
  );
  return { element, canvas, canvasZoom: zoom, canvasOffsetX, canvasOffsetY };
}

const CANVAS_PADDING = 20;

function drawElementOnCanvas(
  element,
  rc,
  context,
) {
  context.globalAlpha = element.opacity / 100;
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "ellipse": {
      rc.draw(getShapeForElement(element));
      break;
    }
    case "arrow":
    case "draw":
    case "line": {
      (getShapeForElement(element)).forEach((shape) => {
        rc.draw(shape);
      });
      break;
    }
    default: {
      if (isTextElement(element)) {
        const font = context.font;
        context.font = element.font;
        const fillStyle = context.fillStyle;
        context.fillStyle = element.strokeColor;
        const textAlign = context.textAlign;
        context.textAlign = element.textAlign;
        // Canvas does not support multiline text by default
        const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
        const lineHeight = element.height / lines.length;
        const verticalOffset = element.height - element.baseline;
        const horizontalOffset =
          element.textAlign === "center"
            ? element.width / 2
            : element.textAlign === "right"
            ? element.width
            : 0;
        for (let i = 0; i < lines.length; i++) {
          context.fillText(
            lines[i],
            0 + horizontalOffset,
            (i + 1) * lineHeight - verticalOffset,
          );
        }
        context.fillStyle = fillStyle;
        context.font = font;
        context.textAlign = textAlign;
      } else {
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
  context.globalAlpha = 1;
}

function isPathALoop(points) {
  if (points.length >= 3) {
    const [firstPoint, lastPoint] = [points[0], points[points.length - 1]];
    return (
      distance2d(firstPoint[0], firstPoint[1], lastPoint[0], lastPoint[1]) <=
      LINE_CONFIRM_THRESHOLD
    );
  }
  return false;
}

function isTextElement(
  element,
) {
  return element != null && element.type === "text";
}

function distance2d(x1, y1, x2, y2) {
  const xd = x2 - x1;
  const yd = y2 - y1;
  return Math.hypot(xd, yd);
}

const LINE_CONFIRM_THRESHOLD = 10; // 10px
