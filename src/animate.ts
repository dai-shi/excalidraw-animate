import type {
  NonDeletedExcalidrawElement,
  NonDeleted,
  ExcalidrawFreeDrawElement,
} from '@excalidraw/excalidraw/element/types';

import { getFreeDrawSvgPath } from '@excalidraw/excalidraw';

type AnimateOptions = {
  startMs?: number;
  pointerImg?: string;
  pointerWidth?: string;
  pointerHeight?: string;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const findNode = (ele: SVGElement, name: string) => {
  const childNodes = ele.childNodes as NodeListOf<SVGElement>;
  for (let i = 0; i < childNodes.length; ++i) {
    if (childNodes[i].tagName === name) {
      return childNodes[i];
    }
  }
  return null;
};

const hideBeforeAnimation = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number,
  freeze?: boolean,
) => {
  ele.setAttribute('opacity', '0');
  const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
  animate.setAttribute('attributeName', 'opacity');
  animate.setAttribute('from', '1');
  animate.setAttribute('to', '1');
  animate.setAttribute('begin', `${currentMs}ms`);
  animate.setAttribute('dur', `${durationMs}ms`);
  if (freeze) {
    animate.setAttribute('fill', 'freeze');
  }
  ele.appendChild(animate);
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
    [0, 0],
  );
  return items[longestIndex];
};

const animatePointer = (
  svg: SVGSVGElement,
  ele: SVGElement,
  path: string,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  if (!options.pointerImg) return;
  const img = svg.ownerDocument.createElementNS(SVG_NS, 'image');
  img.setAttribute('href', options.pointerImg);
  if (options.pointerWidth) {
    img.setAttribute('width', options.pointerWidth);
  }
  if (options.pointerHeight) {
    img.setAttribute('height', options.pointerHeight);
  }
  hideBeforeAnimation(svg, img, currentMs, durationMs);
  const animateMotion = svg.ownerDocument.createElementNS(
    SVG_NS,
    'animateMotion',
  );
  animateMotion.setAttribute('path', pickOnePathItem(path));
  animateMotion.setAttribute('begin', `${currentMs}ms`);
  animateMotion.setAttribute('dur', `${durationMs}ms`);
  img.appendChild(animateMotion);
  ele.parentNode?.appendChild(img);
};

const animatePath = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  const dTo = ele.getAttribute('d') || '';
  const mCount = dTo.match(/M/g)?.length || 0;
  const cCount = dTo.match(/C/g)?.length || 0;
  const repeat = cCount / mCount;
  let dLast = dTo;
  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom = dTo.replace(
      new RegExp(
        [
          'M(\\S+) (\\S+)',
          '((?: C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+){',
          `${i}`, // skip count
          '})',
          '(?: C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+){1,}',
        ].join(''),
        'g',
      ),
      (...a) => {
        const [x, y] = a[3]
          ? a[3].match(/.* (\S+) (\S+)$/).slice(1, 3)
          : [a[1], a[2]];
        return (
          `M${a[1]} ${a[2]}${a[3]}` +
          ` C${x} ${y}, ${x} ${y}, ${x} ${y}`.repeat(repeat - i)
        );
      },
    );
    if (i === 0) {
      ele.setAttribute('d', dFrom);
    }
    const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
    animate.setAttribute('attributeName', 'd');
    animate.setAttribute('from', dFrom);
    animate.setAttribute('to', dLast);
    animate.setAttribute('begin', `${currentMs + i * (durationMs / repeat)}ms`);
    animate.setAttribute('dur', `${durationMs / repeat}ms`);
    animate.setAttribute('fill', 'freeze');
    ele.appendChild(animate);
    dLast = dFrom;
  }
  animatePointer(svg, ele, dTo, currentMs, durationMs, options);
  hideBeforeAnimation(svg, ele, currentMs, durationMs, true);
};

const animateFillPath = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  const dTo = ele.getAttribute('d') || '';
  if (dTo.includes('C')) {
    animatePath(svg, ele, currentMs, durationMs, options);
    return;
  }
  const dFrom = dTo.replace(
    new RegExp(['M(\\S+) (\\S+)', '((?: L\\S+ \\S+){1,})'].join('')),
    (...a) => {
      return `M${a[1]} ${a[2]}` + a[3].replace(/L\S+ \S+/g, `L${a[1]} ${a[2]}`);
    },
  );
  ele.setAttribute('d', dFrom);
  const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
  animate.setAttribute('attributeName', 'd');
  animate.setAttribute('from', dFrom);
  animate.setAttribute('to', dTo);
  animate.setAttribute('begin', `${currentMs}ms`);
  animate.setAttribute('dur', `${durationMs}ms`);
  animate.setAttribute('fill', 'freeze');
  ele.appendChild(animate);
};

const animatePolygon = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  let dTo = ele.getAttribute('d') || '';
  let mCount = dTo.match(/M/g)?.length || 0;
  let cCount = dTo.match(/C/g)?.length || 0;
  if (mCount === cCount + 1) {
    // workaround for round rect
    dTo = dTo.replace(/^M\S+ \S+ M/, 'M');
    mCount = dTo.match(/M/g)?.length || 0;
    cCount = dTo.match(/C/g)?.length || 0;
  }
  if (mCount !== cCount) throw new Error('unexpected m/c counts');
  const dups = ele.getAttribute('stroke-dasharray') ? 1 : Math.min(2, mCount);
  const repeat = mCount / dups;
  let dLast = dTo;
  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom = dTo.replace(
      new RegExp(
        [
          '((?:',
          'M(\\S+) (\\S+) C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+ ?'.repeat(dups),
          '){',
          `${i}`, // skip count
          '})',
          'M(\\S+) (\\S+) C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+ ?'.repeat(dups),
          '.*',
        ].join(''),
      ),
      (...a) => {
        return (
          `${a[1]}` +
          [...Array(dups).keys()]
            .map((d) => {
              const [x, y] = a.slice(2 + dups * 2 + d * 2);
              return `M${x} ${y} C${x} ${y}, ${x} ${y}, ${x} ${y} `;
            })
            .join('')
            .repeat(repeat - i)
        );
      },
    );
    if (i === 0) {
      ele.setAttribute('d', dFrom);
    }
    const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
    animate.setAttribute('attributeName', 'd');
    animate.setAttribute('from', dFrom);
    animate.setAttribute('to', dLast);
    animate.setAttribute('begin', `${currentMs + i * (durationMs / repeat)}ms`);
    animate.setAttribute('dur', `${durationMs / repeat}ms`);
    animate.setAttribute('fill', 'freeze');
    ele.appendChild(animate);
    dLast = dFrom;
    animatePointer(
      svg,
      ele,
      dTo.replace(
        new RegExp(
          [
            '(?:',
            'M\\S+ \\S+ C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+ ?'.repeat(dups),
            '){',
            `${i}`, // skip count
            '}',
            '(M\\S+ \\S+ C\\S+ \\S+, \\S+ \\S+, \\S+ \\S+) ?'.repeat(dups),
            '.*',
          ].join(''),
        ),
        '$1',
      ),
      currentMs + i * (durationMs / repeat),
      durationMs / repeat,
      options,
    );
  }
  hideBeforeAnimation(svg, ele, currentMs, durationMs, true);
};

let pathForTextIndex = 0;

const animateText = (
  svg: SVGSVGElement,
  width: number,
  ele: SVGElement,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  const anchor = ele.getAttribute('text-anchor') || 'start';
  if (anchor !== 'start') {
    // Not sure how to support it, fallback with opacity
    const toOpacity = ele.getAttribute('opacity') || '1.0';
    const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
    animate.setAttribute('attributeName', 'opacity');
    animate.setAttribute('from', '0.0');
    animate.setAttribute('to', toOpacity);
    animate.setAttribute('begin', `${currentMs}ms`);
    animate.setAttribute('dur', `${durationMs}ms`);
    animate.setAttribute('fill', 'freeze');
    ele.appendChild(animate);
    ele.setAttribute('opacity', '0.0');
    return;
  }
  const x = Number(ele.getAttribute('x') || 0);
  const y = Number(ele.getAttribute('y') || 0);
  pathForTextIndex += 1;
  const path = svg.ownerDocument.createElementNS(SVG_NS, 'path');
  path.setAttribute('id', 'pathForText' + pathForTextIndex);
  const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
  animate.setAttribute('attributeName', 'd');
  animate.setAttribute('from', `m${x} ${y} h0`);
  animate.setAttribute('to', `m${x} ${y} h${width}`);
  animate.setAttribute('begin', `${currentMs}ms`);
  animate.setAttribute('dur', `${durationMs}ms`);
  animate.setAttribute('fill', 'freeze');
  path.appendChild(animate);
  const textPath = svg.ownerDocument.createElementNS(SVG_NS, 'textPath');
  textPath.setAttribute('href', '#pathForText' + pathForTextIndex);
  textPath.textContent = ele.textContent;
  ele.textContent = ' '; // HACK for Firebox as `null` does not work
  findNode(svg, 'defs')?.appendChild(path);
  ele.appendChild(textPath);
  animatePointer(
    svg,
    ele,
    `m${x} ${y} h${width}`,
    currentMs,
    durationMs,
    options,
  );
};

const animateFromToPath = (
  svg: SVGSVGElement,
  ele: SVGElement,
  dFrom: string,
  dTo: string,
  currentMs: number,
  durationMs: number,
) => {
  const path = svg.ownerDocument.createElementNS(SVG_NS, 'path');
  const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
  animate.setAttribute('attributeName', 'd');
  animate.setAttribute('from', dFrom);
  animate.setAttribute('to', dTo);
  animate.setAttribute('begin', `${currentMs}ms`);
  animate.setAttribute('dur', `${durationMs}ms`);
  path.appendChild(animate);
  ele.appendChild(path);
};

const patchSvgLine = (
  svg: SVGSVGElement,
  ele: SVGElement,
  isRounded: boolean,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  const animateLine = isRounded ? animatePath : animatePolygon;
  const childNodes = ele.childNodes as NodeListOf<SVGElement>;
  if (childNodes[0].getAttribute('fill-rule')) {
    animateLine(
      svg,
      childNodes[0].childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75,
      options,
    );
    currentMs += durationMs * 0.75;
    animateFillPath(
      svg,
      childNodes[0].childNodes[0] as SVGElement,
      currentMs,
      durationMs * 0.25,
      options,
    );
  } else {
    animateLine(
      svg,
      childNodes[0].childNodes[0] as SVGElement,
      currentMs,
      durationMs,
      options,
    );
  }
};

const patchSvgArrow = (
  svg: SVGSVGElement,
  ele: SVGElement,
  isRounded: boolean,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  const animateLine = isRounded ? animatePath : animatePolygon;
  const numParts = ele.childNodes.length;
  animateLine(
    svg,
    ele.childNodes[0].childNodes[0] as SVGElement,
    currentMs,
    (durationMs / (numParts + 2)) * 3,
    options,
  );
  currentMs += (durationMs / (numParts + 2)) * 3;
  for (let i = 1; i < numParts; i += 1) {
    const numChildren = ele.childNodes[i].childNodes.length;
    for (let j = 0; j < numChildren; j += 1) {
      animatePath(
        svg,
        ele.childNodes[i].childNodes[j] as SVGElement,
        currentMs,
        durationMs / (numParts + 2) / numChildren,
        options,
      );
      currentMs += durationMs / (numParts + 2) / numChildren;
    }
  }
};

const patchSvgRectangle = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  if (ele.childNodes[1]) {
    animatePolygon(
      svg,
      ele.childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75,
      options,
    );
    currentMs += durationMs * 0.75;
    animateFillPath(
      svg,
      ele.childNodes[0] as SVGElement,
      currentMs,
      durationMs * 0.25,
      options,
    );
  } else {
    animatePolygon(
      svg,
      ele.childNodes[0] as SVGElement,
      currentMs,
      durationMs,
      options,
    );
  }
};

const patchSvgEllipse = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  if (ele.childNodes[1]) {
    animatePath(
      svg,
      ele.childNodes[1] as SVGElement,
      currentMs,
      durationMs * 0.75,
      options,
    );
    currentMs += durationMs * 0.75;
    animateFillPath(
      svg,
      ele.childNodes[0] as SVGElement,
      currentMs,
      durationMs * 0.25,
      options,
    );
  } else {
    animatePath(
      svg,
      ele.childNodes[0] as SVGElement,
      currentMs,
      durationMs,
      options,
    );
  }
};

const patchSvgText = (
  svg: SVGSVGElement,
  ele: SVGElement,
  width: number,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  const childNodes = ele.childNodes as NodeListOf<SVGElement>;
  const len = childNodes.length;
  childNodes.forEach((child) => {
    animateText(svg, width, child, currentMs, durationMs / len, options);
    currentMs += durationMs / len;
  });
};

const patchSvgFreedraw = (
  svg: SVGSVGElement,
  ele: SVGElement,
  freeDrawElement: NonDeleted<ExcalidrawFreeDrawElement>,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  const childNode = ele.childNodes[0] as SVGPathElement;
  childNode.setAttribute('opacity', '0');
  const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
  animate.setAttribute('attributeName', 'opacity');
  animate.setAttribute('from', '0');
  animate.setAttribute('to', '1');
  animate.setAttribute('calcMode', 'discrete');
  animate.setAttribute('begin', `${currentMs + durationMs - 1}ms`);
  animate.setAttribute('dur', `${1}ms`);
  animate.setAttribute('fill', 'freeze');
  childNode.appendChild(animate);
  animatePointer(
    svg,
    childNode,
    freeDrawElement.points.reduce(
      (p, [x, y]) => (p ? p + ` T ${x} ${y}` : `M ${x} ${y}`),
      '',
    ),
    currentMs,
    durationMs,
    options,
  );

  // interporation
  const repeat = freeDrawElement.points.length;
  let dTo = childNode.getAttribute('d') as string;
  for (let i = repeat - 1; i >= 0; i -= 1) {
    const dFrom =
      i > 0
        ? getFreeDrawSvgPath({
            ...freeDrawElement,
            points: freeDrawElement.points.slice(0, i),
          })
        : 'M 0 0';
    animateFromToPath(
      svg,
      ele,
      dFrom,
      dTo,
      currentMs + i * (durationMs / repeat),
      durationMs / repeat,
    );
    dTo = dFrom;
  }
};

const patchSvgImage = (
  svg: SVGSVGElement,
  ele: SVGElement,
  currentMs: number,
  durationMs: number,
) => {
  const toOpacity = ele.getAttribute('opacity') || '1.0';
  const animate = svg.ownerDocument.createElementNS(SVG_NS, 'animate');
  animate.setAttribute('attributeName', 'opacity');
  animate.setAttribute('from', '0.0');
  animate.setAttribute('to', toOpacity);
  animate.setAttribute('begin', `${currentMs}ms`);
  animate.setAttribute('dur', `${durationMs}ms`);
  animate.setAttribute('fill', 'freeze');
  ele.appendChild(animate);
  ele.setAttribute('opacity', '0.0');
};

const patchSvgEle = (
  svg: SVGSVGElement,
  ele: SVGElement,
  excalidraElement: NonDeletedExcalidrawElement,
  currentMs: number,
  durationMs: number,
  options: AnimateOptions,
) => {
  const { type, roundness, width } = excalidraElement;
  if (type === 'line') {
    patchSvgLine(svg, ele, !!roundness, currentMs, durationMs, options);
  } else if (type === 'arrow') {
    patchSvgArrow(svg, ele, !!roundness, currentMs, durationMs, options);
  } else if (type === 'rectangle' || type === 'diamond') {
    patchSvgRectangle(svg, ele, currentMs, durationMs, options);
  } else if (type === 'ellipse') {
    patchSvgEllipse(svg, ele, currentMs, durationMs, options);
  } else if (type === 'text') {
    patchSvgText(svg, ele, width, currentMs, durationMs, options);
  } else if (excalidraElement.type === 'freedraw') {
    patchSvgFreedraw(
      svg,
      ele,
      excalidraElement,
      currentMs,
      durationMs,
      options,
    );
  } else if (type === 'image') {
    patchSvgImage(svg, ele, currentMs, durationMs);
  } else {
    console.error('unknown excalidraw element type', excalidraElement.type);
  }
};

const createGroups = (
  svg: SVGSVGElement,
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const groups: { [groupId: string]: (readonly [SVGElement, number])[] } = {};
  let index = 0;
  const childNodes = svg.childNodes as NodeListOf<SVGElement>;
  childNodes.forEach((ele) => {
    if (ele.tagName === 'g') {
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

const filterGroupNodes = (nodes: NodeListOf<SVGElement>) =>
  [...nodes].filter(
    (node) => node.tagName === 'g' || node.tagName === 'use' /* for images */,
  );

const extractNumberFromElement = (
  element: NonDeletedExcalidrawElement,
  key: string,
) => {
  const match = element.id.match(new RegExp(`${key}:(-?\\d+)`));
  return (match && Number(match[1])) || 0;
};

const sortSvgNodes = (
  nodes: SVGElement[],
  elements: readonly NonDeletedExcalidrawElement[],
) =>
  [...nodes].sort((a, b) => {
    const aIndex = nodes.indexOf(a);
    const bIndex = nodes.indexOf(b);
    const aOrder = extractNumberFromElement(elements[aIndex], 'animateOrder');
    const bOrder = extractNumberFromElement(elements[bIndex], 'animateOrder');
    return aOrder - bOrder;
  });

export const animateSvg = (
  svg: SVGSVGElement,
  elements: readonly NonDeletedExcalidrawElement[],
  options: AnimateOptions = {},
) => {
  const groups = createGroups(svg, elements);
  const finished = new Map();
  let current = options.startMs ?? 1000; // 1 sec margin
  const groupDur = 5000;
  const individualDur = 500;
  const groupNodes = filterGroupNodes(svg.childNodes as NodeListOf<SVGElement>);
  if (groupNodes.length !== elements.length) {
    throw new Error('element length mismatch');
  }
  const groupElement2Element = new Map(
    groupNodes.map((ele, index) => [ele, elements[index]]),
  );
  sortSvgNodes(groupNodes, elements).forEach((ele) => {
    const element = groupElement2Element.get(
      ele,
    ) as NonDeletedExcalidrawElement;
    const { groupIds } = element;
    if (!finished.has(ele)) {
      if (groupIds.length >= 1) {
        const groupId = groupIds[0];
        const group = groups[groupId];
        const dur =
          extractNumberFromElement(element, 'animateDuration') ||
          groupDur / (group.length + 1);
        patchSvgEle(svg, ele, element, current, dur, options);
        current += dur;
        finished.set(ele, true);
        group.forEach(([childEle, childIndex]) => {
          const dur =
            extractNumberFromElement(elements[childIndex], 'animateDuration') ||
            groupDur / (group.length + 1);
          if (!finished.has(childEle)) {
            patchSvgEle(
              svg,
              childEle,
              elements[childIndex],
              current,
              dur,
              options,
            );
            current += dur;
            finished.set(childEle, true);
          }
        });
        delete groups[groupId];
      } else {
        const dur =
          extractNumberFromElement(element, 'animateDuration') || individualDur;
        patchSvgEle(svg, ele, element, current, dur, options);
        current += dur;
        finished.set(ele, true);
      }
    }
  });
  const finishedMs = current + 1000; // 1 sec margin
  return { finishedMs };
};

export const getBeginTimeList = (svg: SVGSVGElement) => {
  const beginTimeList: number[] = [];
  const tmpTimeList: number[] = [];
  const findAnimate = (ele: SVGElement) => {
    if (ele.tagName === 'animate') {
      const match = /([0-9.]+)ms/.exec(ele.getAttribute('begin') || '');
      if (match) {
        tmpTimeList.push(Number(match[1]));
      }
    }
    (ele.childNodes as NodeListOf<SVGElement>).forEach((ele) => {
      findAnimate(ele);
    });
  };
  (svg.childNodes as NodeListOf<SVGElement>).forEach((ele) => {
    if (ele.tagName === 'g') {
      findAnimate(ele);
      if (tmpTimeList.length) {
        beginTimeList.push(Math.min(...tmpTimeList));
        tmpTimeList.splice(0);
      }
    } else if (ele.tagName === 'defs') {
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
