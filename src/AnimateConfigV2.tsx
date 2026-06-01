import { useEffect, useRef } from 'react';
import type {
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import type { Drawing } from './AnimateConfig';

const extractOrder = (id: string): number => {
  const match = id.match(/animateOrder:(-?\d+)/);
  return match ? Number(match[1]) : 0;
};

const extractDuration = (id: string): number | undefined => {
  const match = id.match(/animateDuration:(-?\d+)/);
  return match ? Number(match[1]) : undefined;
};

const setOrderInId = (id: string, order: number): string => {
  if (/animateOrder:(-?\d+)/.test(id)) {
    return id.replace(/animateOrder:(-?\d+)/, `animateOrder:${order}`);
  }
  return `${id}-animateOrder:${order}`;
};

const setDurationInId = (id: string, duration: number): string => {
  if (/animateDuration:(-?\d+)/.test(id)) {
    return id.replace(/animateDuration:(-?\d+)/, `animateDuration:${duration}`);
  }
  return `${id}-animateDuration:${duration}`;
};

const getBaseId = (id: string): string =>
  id.replace(/-animateOrder:-?\d+/g, '').replace(/-animateDuration:-?\d+/g, '');

const GROUP_COLORS = [
  '#f97316', '#3b82f6', '#22c55e', '#a855f7',
  '#eab308', '#ec4899', '#14b8a6', '#ef4444',
];

const getGroupColor = (groupId: string): string => {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) & 0xffffff;
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
};

const getElementLabel = (element: ExcalidrawElement): string => {
  if (element.type === 'text') {
    const text = (element as { text?: string }).text ?? '';
    const trimmed = text.replace(/\s+/g, ' ').trim();
    return trimmed.length > 22 ? trimmed.slice(0, 22) + '...' : trimmed || 'text';
  }
  const shortId = getBaseId(element.id).slice(0, 6);
  return `${element.type} [${shortId}]`;
};

// Returns the contiguous block bounds for the element at `index`.
// Elements sharing the same primary groupId that are adjacent form one block.
const getBlockContaining = (
  elems: ExcalidrawElement[],
  index: number,
): { start: number; end: number } => {
  const groupId = elems[index].groupIds?.[0];
  if (!groupId) return { start: index, end: index };
  let start = index;
  while (start > 0 && elems[start - 1].groupIds?.[0] === groupId) start--;
  let end = index;
  while (end < elems.length - 1 && elems[end + 1].groupIds?.[0] === groupId) end++;
  return { start, end };
};

type Props = {
  drawing: Drawing;
  api: ExcalidrawImperativeAPI;
};

export const AnimateConfigV2 = ({ drawing, api }: Props) => {
  const allElements = drawing.elements.filter((el) => !el.isDeleted);

  const sorted = [...allElements].sort((a, b) => {
    const diff = extractOrder(a.id) - extractOrder(b.id);
    if (diff !== 0) return diff;
    return drawing.elements.indexOf(a) - drawing.elements.indexOf(b);
  });

  const selectedIds = drawing.appState.selectedElementIds ?? {};

  const rowRefMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  useEffect(() => {
    const firstSelected = sortedRef.current.find((el) => selectedIds[el.id]);
    if (firstSelected) {
      const node = rowRefMap.current.get(firstSelected.id);
      if (node) {
        node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing.appState.selectedElementIds]);

  const applyNewOrder = (newOrder: ExcalidrawElement[]) => {
    const idToNewOrder = new Map<string, number>();
    newOrder.forEach((el, i) => idToNewOrder.set(el.id, i));

    const oldToNew = new Map<string, string>();
    const elements = drawing.elements.map((el) => {
      if (el.isDeleted) return el;
      const newIdx = idToNewOrder.get(el.id);
      if (newIdx === undefined) return el;
      const newId = setOrderInId(el.id, newIdx);
      if (newId !== el.id) oldToNew.set(el.id, newId);
      return newId !== el.id ? { ...el, id: newId } : el;
    });

    const updatedSelectedIds = { ...drawing.appState.selectedElementIds };
    oldToNew.forEach((newId, oldId) => {
      if (updatedSelectedIds[oldId]) {
        updatedSelectedIds[newId] = updatedSelectedIds[oldId];
        delete updatedSelectedIds[oldId];
      }
    });

    api.updateScene({
      elements,
      appState: { ...drawing.appState, selectedElementIds: updatedSelectedIds },
      files: drawing.files,
    });
  };

  // Moves the entire block containing `fromIndex` up or down one block.
  const moveBlock = (fromIndex: number, direction: 'up' | 'down') => {
    const block = getBlockContaining(sorted, fromIndex);

    if (direction === 'up') {
      if (block.start === 0) return;
      const above = getBlockContaining(sorted, block.start - 1);
      const newOrder = [...sorted];
      const moved = newOrder.splice(block.start, block.end - block.start + 1);
      newOrder.splice(above.start, 0, ...moved);
      applyNewOrder(newOrder);
    } else {
      if (block.end >= sorted.length - 1) return;
      const below = getBlockContaining(sorted, block.end + 1);
      const blockSize = block.end - block.start + 1;
      const newOrder = [...sorted];
      const moved = newOrder.splice(block.start, blockSize);
      // After removing the block, below.end shifts left by blockSize
      newOrder.splice(below.end - blockSize + 1, 0, ...moved);
      applyNewOrder(newOrder);
    }
  };

  const selectElement = (element: ExcalidrawElement) => {
    const primaryGroupId = element.groupIds?.[0];
    const newSelectedIds: Record<string, true> = {};

    if (primaryGroupId) {
      drawing.elements.forEach((el) => {
        if (!el.isDeleted && el.groupIds?.includes(primaryGroupId)) {
          newSelectedIds[el.id] = true;
        }
      });
    } else {
      newSelectedIds[element.id] = true;
    }

    api.updateScene({
      appState: { ...drawing.appState, selectedElementIds: newSelectedIds },
    });
  };

  const setDuration = (elementId: string, duration: number) => {
    const oldToNew = new Map<string, string>();
    const elements = drawing.elements.map((el) => {
      if (el.id !== elementId) return el;
      const newId = setDurationInId(el.id, duration);
      if (newId !== el.id) oldToNew.set(el.id, newId);
      return newId !== el.id ? { ...el, id: newId } : el;
    });

    const updatedSelectedIds = { ...drawing.appState.selectedElementIds };
    oldToNew.forEach((newId, oldId) => {
      if (updatedSelectedIds[oldId]) {
        updatedSelectedIds[newId] = updatedSelectedIds[oldId];
        delete updatedSelectedIds[oldId];
      }
    });

    api.updateScene({
      elements,
      appState: { ...drawing.appState, selectedElementIds: updatedSelectedIds },
      files: drawing.files,
    });
  };

  if (sorted.length === 0) {
    return (
      <div style={{ color: 'gray', fontSize: 13 }}>No elements on canvas.</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: 13 }}>
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: 6,
          borderBottom: '1px solid gray',
          paddingBottom: 5,
          flexShrink: 0,
        }}
      >
        Animation Order
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sorted.map((element, i) => {
          const duration = extractDuration(element.id);
          const isSelected = !!selectedIds[element.id];
          const primaryGroupId = element.groupIds?.[0];
          const groupColor = primaryGroupId ? getGroupColor(primaryGroupId) : undefined;
          const block = getBlockContaining(sorted, i);
          return (
            <div
              key={element.id}
              ref={(node) => {
                if (node) rowRefMap.current.set(element.id, node);
                else rowRefMap.current.delete(element.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 4px',
                paddingLeft: groupColor ? 2 : 4,
                borderRadius: 4,
                borderLeft: groupColor ? `3px solid ${groupColor}` : '3px solid transparent',
                backgroundColor: isSelected ? 'rgba(100, 130, 255, 0.18)' : 'transparent',
              }}
            >
              <span
                style={{
                  width: 18,
                  textAlign: 'right',
                  color: 'gray',
                  flexShrink: 0,
                  fontSize: 11,
                }}
              >
                {i + 1}.
              </span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  fontWeight: isSelected ? 'bold' : 'normal',
                  cursor: 'pointer',
                }}
                title={getElementLabel(element)}
                onClick={() => selectElement(element)}
              >
                {getElementLabel(element)}
              </span>
              <button
                className="app-button"
                style={{ padding: '1px 5px', fontSize: 11, flexShrink: 0 }}
                disabled={block.start === 0}
                title="Move up"
                onClick={() => moveBlock(i, 'up')}
              >
                ^
              </button>
              <button
                className="app-button"
                style={{ padding: '1px 5px', fontSize: 11, flexShrink: 0 }}
                disabled={block.end === sorted.length - 1}
                title="Move down"
                onClick={() => moveBlock(i, 'down')}
              >
                v
              </button>
              <input
                className="app-input"
                type="number"
                defaultValue={duration ?? ''}
                placeholder="ms"
                style={{ width: 52, minWidth: 52, flexShrink: 0, fontSize: 11 }}
                title="Duration in milliseconds"
                onBlur={(e) => {
                  const val = Math.floor(Number(e.currentTarget.value));
                  if (Number.isFinite(val) && val > 0) {
                    setDuration(element.id, val);
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
