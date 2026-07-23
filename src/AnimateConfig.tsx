import type { ChangeEvent } from 'react';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { parseDurationToMs } from './useLoadSvg';

export type Drawing = {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles | null;
};

type OptionKey =
  | 'pointerImg'
  | 'pointerWidth'
  | 'pointerHeight'
  | 'defaultDuration'
  | 'totalDuration';

const loadAnimateOptions = (): Record<OptionKey, string | undefined> => {
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(hash);
  return {
    pointerImg: searchParams.get('pointerImg') || undefined,
    pointerWidth: searchParams.get('pointerWidth') || undefined,
    pointerHeight: searchParams.get('pointerHeight') || undefined,
    defaultDuration: searchParams.get('defaultDuration') || undefined,
    totalDuration: searchParams.get('totalDuration') || undefined,
  };
};

const saveAnimateOption = (name: OptionKey, value: string) => {
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(hash);
  if (value.trim()) {
    searchParams.set(name, value.trim());
  } else {
    searchParams.delete(name);
  }
  window.location.hash = searchParams.toString();
};

const extractNumberFromId = (id: string, key: string) => {
  const match = id.match(new RegExp(`${key}:(-?\\d+)`));
  return match === null ? undefined : Number(match[1]) || 0;
};

const applyNumberInId = (
  drawing: Drawing,
  ids: string[],
  key: string,
  value: number,
): Drawing => {
  const selectedElementIds = { ...drawing.appState.selectedElementIds };
  const elements = drawing.elements.map((element) => {
    const { id } = element;
    if (!ids.includes(id)) {
      return element;
    }
    let newId: string;
    const match = id.match(new RegExp(`${key}:(-?\\d+)`));
    if (match) {
      newId = id.replace(new RegExp(`${key}:(-?\\d+)`), `${key}:${value}`);
    } else {
      newId = id + `-${key}:${value}`;
    }
    if (id === newId) {
      return element;
    }
    selectedElementIds[newId] = selectedElementIds[id];
    delete selectedElementIds[id];
    return { ...element, id: newId };
  });
  return {
    elements,
    appState: {
      ...drawing.appState,
      selectedElementIds,
    },
    files: drawing.files,
  };
};

export const AnimateConfig = ({
  drawing,
  api,
}: {
  drawing: Drawing;
  api: ExcalidrawImperativeAPI;
}) => {
  const defaultAnimateOptions = loadAnimateOptions();
  const selectedIds = Object.keys(
    drawing.appState.selectedElementIds ?? {},
  ).filter(
    (id) =>
      drawing.appState.selectedElementIds[id] &&
      drawing.elements.some((element) => element.id === id),
  );

  const animateOrderSet = new Set<number | undefined>();
  selectedIds.forEach((id) => {
    animateOrderSet.add(extractNumberFromId(id, 'animateOrder'));
  });
  const onChangeAnimateOrder = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Math.floor(Number(e.target.value));
    if (Number.isFinite(value)) {
      api.updateScene(
        applyNumberInId(drawing, selectedIds, 'animateOrder', value),
      );
    }
  };
  const animateOrderDisabled = !animateOrderSet.size;

  const animateDurationSet = new Set<number | undefined>();
  selectedIds.forEach((id) => {
    animateDurationSet.add(extractNumberFromId(id, 'animateDuration'));
  });
  const onChangeAnimateDuration = (e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const parsedMs = parseDurationToMs(rawVal);
    if (parsedMs != null) {
      api.updateScene(
        applyNumberInId(drawing, selectedIds, 'animateDuration', parsedMs),
      );
    }
  };
  const animateDurationDisabled = !animateDurationSet.size;

  const onChangeTotalDuration = (e: ChangeEvent<HTMLInputElement>) => {
    saveAnimateOption('totalDuration', e.target.value);
  };

  const onChangeDefaultDuration = (e: ChangeEvent<HTMLInputElement>) => {
    saveAnimateOption('defaultDuration', e.target.value);
  };

  const onChangeAnimatePointerText = (e: ChangeEvent<HTMLInputElement>) => {
    saveAnimateOption('pointerImg', e.target.value);
  };

  const onChangeAnimatePointerFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveAnimateOption('pointerImg', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const onChangeAnimatePointerWidth = (e: ChangeEvent<HTMLInputElement>) => {
    saveAnimateOption('pointerWidth', e.target.value);
  };

  return (
    <div
      className="animate-config"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontSize: 14,
      }}
    >
      {/* Animation Section */}
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: 4,
          borderBottom: '1px solid gray',
          paddingBottom: '5px',
        }}
      >
        Animation Timing
      </div>

      {/* Total Scene Duration (Mins / Secs) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ fontWeight: 500 }}>Total Scene Duration:</div>
        <input
          className="app-input"
          defaultValue={defaultAnimateOptions.totalDuration || ''}
          onChange={onChangeTotalDuration}
          placeholder="e.g. 10s, 1.5m, 45s"
          style={{ width: '100%' }}
          title="Set total duration for the entire animation (e.g. 10s = 10 seconds, 1.5m = 1.5 minutes)"
        />
        <span style={{ fontSize: '11px', color: 'gray' }}>
          Duration for all elements combined (e.g. 10s, 1.5m)
        </span>
      </div>

      {/* Default Element Duration */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginTop: 4,
        }}
      >
        <div style={{ fontWeight: 500 }}>Default Element Duration:</div>
        <input
          className="app-input"
          defaultValue={defaultAnimateOptions.defaultDuration || ''}
          onChange={onChangeDefaultDuration}
          placeholder="e.g. 1s, 500ms, 2s"
          style={{ width: '100%' }}
          title="Default duration per element (e.g. 1s = 1 second)"
        />
        <span style={{ fontSize: '11px', color: 'gray' }}>
          Base time to animate each element
        </span>
      </div>

      {/* Selected Element Controls */}
      <div
        style={{
          fontWeight: 'bold',
          margin: '8px 0 4px',
          borderBottom: '1px solid gray',
          paddingBottom: '5px',
        }}
      >
        Selected Elements ({selectedIds.length})
      </div>

      <div
        style={{
          opacity: animateOrderDisabled ? 0.3 : 1.0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div>Order: </div>
        <div>
          <input
            className="app-input"
            type="number"
            disabled={animateOrderDisabled}
            value={
              animateOrderSet.size === 1 ? ([...animateOrderSet][0] ?? 0) : ''
            }
            onChange={onChangeAnimateOrder}
            placeholder={animateOrderSet.size > 1 ? 'Mixed' : undefined}
            style={{ width: 90, minWidth: 60 }}
            title="Set animation order for selected elements"
          />
        </div>
      </div>

      <div
        style={{
          opacity: animateDurationDisabled ? 0.3 : 1.0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div>Duration: </div>
        <div>
          <input
            className="app-input"
            disabled={animateDurationDisabled}
            value={
              animateDurationSet.size === 1
                ? ([...animateDurationSet][0] != null
                    ? `${[...animateDurationSet][0]}ms`
                    : '')
                : ''
            }
            onChange={onChangeAnimateDuration}
            placeholder={animateDurationSet.size > 1 ? 'Mixed' : 'e.g. 2s'}
            style={{ width: 90, minWidth: 60 }}
            title="Set duration for selected elements (e.g. 2s, 500ms)"
          />
        </div>
      </div>

      {/* Pointer Section */}
      <div
        style={{
          fontWeight: 'bold',
          margin: '8px 0 4px',
          borderBottom: '1px solid gray',
          paddingBottom: '5px',
        }}
      >
        Pointer
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <label
          htmlFor="pointerFile"
          className="app-button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
          }}
          title="Upload an image file for the pointer"
        >
          File...
        </label>
        <input
          className="app-input"
          defaultValue={defaultAnimateOptions.pointerImg || ''}
          onChange={onChangeAnimatePointerText}
          placeholder="Enter URL or choose a File..."
          title="Enter an image URL or choose a file for the pointer"
        />
        <input
          id="pointerFile"
          type="file"
          accept="image/*"
          onChange={onChangeAnimatePointerFile}
          style={{ display: 'none' }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        Width:{' '}
        <input
          className="app-input"
          defaultValue={defaultAnimateOptions.pointerWidth || ''}
          onChange={onChangeAnimatePointerWidth}
          placeholder="px"
          style={{ width: 80, minWidth: 50 }}
          title="Enter pointer width in pixels"
        />{' '}
      </div>

      <div>
        <p style={{ fontWeight: 'lighter', color: 'gray', fontSize: '12px' }}>
          * Supports seconds (s), minutes (m), or milliseconds (ms).
        </p>
      </div>
    </div>
  );
};
