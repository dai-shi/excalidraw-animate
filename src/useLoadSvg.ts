import { useCallback, useEffect, useState } from 'react';

import {
  exportToSvg,
  restoreElements,
  loadLibraryFromBlob,
  getNonDeletedElements,
} from '@excalidraw/excalidraw';

import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import { loadScene } from './vendor/loadScene';
import { animateSvg } from './animate';

const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * Excalidraw's exportToSvg creates <div> inside <foreignObject> using
 * createElementNS(SVG_NS, "div") — i.e. the SVG namespace. Browsers
 * require XHTML namespace for HTML elements inside <foreignObject> to
 * actually render them. This function rebuilds those elements properly
 * and ensures the iframe src is populated from the parent <a> href.
 */
const fixForeignObjects = (svg: SVGSVGElement) => {
  const foreignObjects = svg.querySelectorAll('foreignObject');
  foreignObjects.forEach((fo) => {
    // Get dimensions from the foreignObject
    const width = fo.style.width || fo.getAttribute('width') || '100%';
    const height = fo.style.height || fo.getAttribute('height') || '100%';

    // Find the embed URL from the parent <a> tag
    const parentAnchor = fo.closest('a');
    const embedUrl = parentAnchor?.getAttribute('href') || '';

    // Check if the existing content is broken (SVG-namespaced div)
    const existingDiv = fo.querySelector('div');
    const existingIframe = fo.querySelector('iframe');

    // If there's already a working iframe with a src, skip
    if (
      existingIframe &&
      existingIframe.namespaceURI === XHTML_NS &&
      existingIframe.src
    ) {
      return;
    }

    // Clear the foreignObject
    while (fo.firstChild) {
      fo.removeChild(fo.firstChild);
    }

    // Set proper width/height as attributes (not just style)
    const widthNum = parseInt(width, 10);
    const heightNum = parseInt(height, 10);
    if (widthNum) fo.setAttribute('width', String(widthNum));
    if (heightNum) fo.setAttribute('height', String(heightNum));

    // Create proper XHTML-namespaced elements
    const div = document.createElementNS(XHTML_NS, 'div');
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.overflow = 'hidden';

    if (embedUrl) {
      const iframe = document.createElementNS(XHTML_NS, 'iframe') as HTMLIFrameElement;
      iframe.src = embedUrl;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-popups allow-presentation',
      );
      iframe.setAttribute('loading', 'lazy');
      div.appendChild(iframe);
    }

    fo.appendChild(div);
  });
};

const THEME_FILTER = 'invert(93%) hue-rotate(180deg)';
const IMAGE_CORRECTION = 'invert(100%) hue-rotate(180deg) saturate(1.25)';

export const applyThemeToSvg = (
  svg: SVGSVGElement,
  theme: 'light' | 'dark',
): SVGSVGElement => {
  if (theme !== 'dark') return svg;

  const cloned = svg.cloneNode(true) as SVGSVGElement;

  // Global filter (sourced from Excalidraw's THEME_FILTER in
  // packages/common/src/constants.ts; planned to mirror CSS --theme-filter)
  cloned.style.filter = THEME_FILTER;

  // Apply image-only correction (approx. of Excalidraw's Canvas IMAGE_INVERT_FILTER
  // in packages/element/src/renderElement.ts)
  cloned.querySelectorAll<SVGImageElement>('image').forEach((img) => {
    const href =
      img.getAttribute('href') || img.getAttribute('xlink:href') || '';

    // skip SVGs
    if (/^data:image\/svg\+xml/i.test(href) || /\.svg(?:$|\?)/i.test(href)) {
      return;
    }

    // append correction filter
    const current = img.style.filter?.trim() || '';
    if (!current.includes(IMAGE_CORRECTION)) {
      img.style.filter = current
        ? `${current} ${IMAGE_CORRECTION}`
        : IMAGE_CORRECTION;
    }
  });

  return cloned;
};

const importLibraryFromUrl = async (url: string) => {
  try {
    const request = await fetch(url);
    const blob = await request.blob();
    const libraryItems = await loadLibraryFromBlob(blob);
    return libraryItems.map((libraryItem: any) => ({
      elements: getNonDeletedElements(restoreElements(libraryItem.elements, null)),
      files: libraryItem.files || {},
    }));
  } catch {
    window.alert('Unable to load library');
    return [];
  }
};

export const parseDurationToMs = (val: string | null | undefined): number | undefined => {
  if (!val || typeof val !== 'string') return undefined;
  const trimmed = val.trim().toLowerCase();
  if (!trimmed) return undefined;

  const minMatch = trimmed.match(/^([\d.]+)\s*(m|min|mins|minute|minutes)$/);
  if (minMatch) {
    const mins = parseFloat(minMatch[1]);
    return Number.isFinite(mins) && mins > 0 ? Math.round(mins * 60 * 1000) : undefined;
  }

  const secMatch = trimmed.match(/^([\d.]+)\s*(s|sec|secs|second|seconds)$/);
  if (secMatch) {
    const secs = parseFloat(secMatch[1]);
    return Number.isFinite(secs) && secs > 0 ? Math.round(secs * 1000) : undefined;
  }

  const msMatch = trimmed.match(/^([\d.]+)\s*ms$/);
  if (msMatch) {
    const ms = parseFloat(msMatch[1]);
    return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : undefined;
  }

  const num = parseFloat(trimmed);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num <= 120 ? Math.round(num * 1000) : Math.round(num);
};

export const useLoadSvg = (
  initialData:
    | { elements: ExcalidrawElement[]; appState: AppState; files: BinaryFiles }
    | undefined,
  theme: 'light' | 'dark',
) => {
  const [loading, setLoading] = useState(true);
  const [loadedSvgList, setLoadedSvgList] = useState<
    {
      svg: SVGSVGElement;
      finishedMs: number;
    }[]
  >([]);

  const loadDataList = useCallback(
    async (
      dataList: {
        elements: readonly ExcalidrawElement[];
        appState: Parameters<typeof exportToSvg>[0]['appState'];
        files: BinaryFiles;
      }[],
      inSequence?: boolean,
    ) => {
      const hash = window.location.hash.slice(1);
      const searchParams = new URLSearchParams(hash);
      const options = {
        startMs: undefined as number | undefined,
        pointerImg: searchParams.get('pointerImg') || undefined,
        pointerWidth: searchParams.get('pointerWidth') || undefined,
        pointerHeight: searchParams.get('pointerHeight') || undefined,
        defaultDuration: parseDurationToMs(searchParams.get('defaultDuration')),
        totalDuration: parseDurationToMs(searchParams.get('totalDuration')),
      };
      const svgList = await Promise.all(
        dataList.map(async (data) => {
          const elements = getNonDeletedElements(data.elements).filter((el) => {
            if (el.type !== 'image') return true;
            const fileId = (el as { fileId?: string | null }).fileId;
            return fileId == null || (data.files && data.files[fileId] != null);
          });
          const svg = await exportToSvg({
            elements,
            files: data.files,
            appState: data.appState,
            exportPadding: 30,
            renderEmbeddables: true,
          });
          fixForeignObjects(svg);
          const themedSvg = applyThemeToSvg(svg, theme);
          const result = animateSvg(themedSvg, elements, options);
          if (inSequence) {
            options.startMs = result.finishedMs;
          }
          return { svg: themedSvg, finishedMs: result.finishedMs };
        }),
      );
      setLoadedSvgList(svgList);
      return svgList;
    },
    [theme],
  );

  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash.slice(1);
        const searchParams = new URLSearchParams(hash);
        const matchIdKey = /([a-zA-Z0-9_-]+),?([a-zA-Z0-9_-]*)/.exec(
          searchParams.get('json') || '',
        );
        if (matchIdKey) {
          const [, id, key] = matchIdKey;
          const data = await loadScene(id, key, null);
          const [{ svg, finishedMs }] = await loadDataList([data]);
          if (searchParams.get('autoplay') === 'no') {
            svg.setCurrentTime(finishedMs);
          }
        }
        const matchLibrary = /(.*\.excalidrawlib)/.exec(
          searchParams.get('library') || '',
        );
        if (matchLibrary) {
          const [, url] = matchLibrary;
          const dataList = await importLibraryFromUrl(url);
          const svgList = await loadDataList(
            dataList.map(
              ({ elements, files }: { elements: any; files: any }) => ({
                elements,
                appState: {},
                files: files || {},
              }),
            ),
            searchParams.has('sequence'),
          );
          if (searchParams.get('autoplay') === 'no') {
            svgList.forEach(({ svg, finishedMs }) => {
              svg.setCurrentTime(finishedMs);
            });
          }
        }
        if (!matchIdKey && !matchLibrary && initialData) {
          await loadDataList([initialData]);
        }
      } catch (e) {
        console.error('Failed to load SVG:', e);
        throw e;
      } finally {
        setLoading(false);
      }
    })();
  }, [loadDataList, initialData]);

  return { loading, loadedSvgList, loadDataList };
};
