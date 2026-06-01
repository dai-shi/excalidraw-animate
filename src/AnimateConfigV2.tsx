import { useEffect, useRef, useState } from 'react';
import type {
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

import type { Drawing } from './AnimateConfig';

const extractOrder = (id: string): number | undefined => {
  const match = id.match(/animateOrder:(-?\d+)/);
  return match ? Number(match[1]) : undefined;
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

const getDefaultDuration = (
  element: ExcalidrawElement,
  allElements: ExcalidrawElement[],
): number => {
  const primaryGroupId = element.groupIds?.[0];
  if (!primaryGroupId) return 500;
  const groupSize = allElements.filter(
    (el) => !el.isDeleted && el.groupIds?.[0] === primaryGroupId,
  ).length;
  return Math.round(5000 / (groupSize + 1));
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

// Groups contiguous elements sharing the same primary groupId into blocks.
const computeBlocks = (elems: ExcalidrawElement[]): { start: number; end: number }[] => {
  const blocks: { start: number; end: number }[] = [];
  let i = 0;
  while (i < elems.length) {
    const groupId = elems[i].groupIds?.[0] ?? null;
    if (groupId) {
      let j = i;
      while (j < elems.length && elems[j].groupIds?.[0] === groupId) j++;
      blocks.push({ start: i, end: j - 1 });
      i = j;
    } else {
      blocks.push({ start: i, end: i });
      i++;
    }
  }
  return blocks;
};

type Props = {
  drawing: Drawing;
  api: ExcalidrawImperativeAPI;
};

export const AnimateConfigV2 = ({ drawing, api }: Props) => {
  const allElements = drawing.elements.filter((el) => !el.isDeleted);

  const sorted = [...allElements].sort((a, b) => {
    const aOrder = extractOrder(a.id) ?? Infinity;
    const bOrder = extractOrder(b.id) ?? Infinity;
    const diff = aOrder - bOrder;
    if (diff !== 0) return diff;
    return drawing.elements.indexOf(a) - drawing.elements.indexOf(b);
  });

  const blocks = computeBlocks(sorted);

  const selectedIds = drawing.appState.selectedElementIds ?? {};

  const rowRefMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  // dragBlockIdx: index in `blocks` of the block being dragged
  // dropBlockIdx: insert dragged block BEFORE this block index (0..blocks.length)
  const [dragBlockIdx, setDragBlockIdx] = useState<number | null>(null);
  const [dropBlockIdx, setDropBlockIdx] = useState<number | null>(null);

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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, blockIdx: number) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragBlockIdx(blockIdx);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, rowIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const blockIdx = blocks.findIndex((b) => rowIdx >= b.start && rowIdx <= b.end);
    const rect = e.currentTarget.getBoundingClientRect();
    const target = e.clientY < rect.top + rect.height / 2 ? blockIdx : blockIdx + 1;
    setDropBlockIdx(target);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragBlockIdx === null || dropBlockIdx === null) {
      setDragBlockIdx(null);
      setDropBlockIdx(null);
      return;
    }
    // No-op: dropping adjacent to itself
    if (dropBlockIdx === dragBlockIdx || dropBlockIdx === dragBlockIdx + 1) {
      setDragBlockIdx(null);
      setDropBlockIdx(null);
      return;
    }

    const draggedElems = sorted.slice(blocks[dragBlockIdx].start, blocks[dragBlockIdx].end + 1);
    const newOrder: ExcalidrawElement[] = [];
    let inserted = false;

    blocks.forEach((block, bi) => {
      if (bi === dropBlockIdx && !inserted) {
        newOrder.push(...draggedElems);
        inserted = true;
      }
      if (bi !== dragBlockIdx) {
        newOrder.push(...sorted.slice(block.start, block.end + 1));
      }
    });

    if (!inserted) {
      newOrder.push(...draggedElems);
    }

    applyNewOrder(newOrder);
    setDragBlockIdx(null);
    setDropBlockIdx(null);
  };

  const handleDragEnd = () => {
    setDragBlockIdx(null);
    setDropBlockIdx(null);
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
      <div
        style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropBlockIdx(null);
          }
        }}
      >
        {sorted.map((element, i) => {
          const duration = extractDuration(element.id);
          const isSelected = !!selectedIds[element.id];
          const primaryGroupId = element.groupIds?.[0];
          const groupColor = primaryGroupId ? getGroupColor(primaryGroupId) : undefined;
          const blockIdx = blocks.findIndex((b) => i >= b.start && i <= b.end);
          const isDragged = dragBlockIdx !== null && blockIdx === dragBlockIdx;
          const showIndicatorBefore =
            dropBlockIdx !== null &&
            dropBlockIdx < blocks.length &&
            blocks[dropBlockIdx].start === i;
          const showIndicatorAfter =
            dropBlockIdx === blocks.length && i === sorted.length - 1;

          return (
            <div
              key={element.id}
              ref={(node) => {
                if (node) rowRefMap.current.set(element.id, node);
                else rowRefMap.current.delete(element.id);
              }}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 4px',
                paddingLeft: groupColor ? 2 : 4,
                borderRadius: 4,
                borderLeft: groupColor ? `3px solid ${groupColor}` : '3px solid transparent',
                borderTop: showIndicatorBefore ? '2px solid #4a90e2' : '2px solid transparent',
                borderBottom: showIndicatorAfter ? '2px solid #4a90e2' : '2px solid transparent',
                backgroundColor: isSelected ? 'rgba(100, 130, 255, 0.18)' : 'transparent',
                opacity: isDragged ? 0.4 : 1,
              }}
            >
              <div
                className="drag-handle"
                draggable
                onDragStart={(e) => handleDragStart(e, blockIdx)}
              />
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
              <input
                className="app-input"
                type="number"
                defaultValue={duration ?? getDefaultDuration(element, allElements)}
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
