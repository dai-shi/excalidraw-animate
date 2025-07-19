import type { ChangeEvent } from 'react';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type Drawing = {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles | null;
};

const loadAnimateOptions = (): {
  pointerImg: string | undefined;
  pointerWidth: string | undefined;
  pointerHeight: string | undefined;
} => {
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(hash);
  return {
    pointerImg: searchParams.get('pointerImg') || undefined,
    pointerWidth: searchParams.get('pointerWidth') || undefined,
    pointerHeight: searchParams.get('pointerHeight') || undefined,
  };
};

const saveAnimateOption = (
  name: 'pointerImg' | 'pointerWidth' | 'pointerHeight',
  value: string,
) => {
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(hash);
  searchParams.set(name, value);
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
    const value = Math.floor(Number(e.target.value));
    if (Number.isFinite(value)) {
      api.updateScene(
        applyNumberInId(drawing, selectedIds, 'animateDuration', value),
      );
    }
  };
  const animateDurationDisabled = !animateDurationSet.size;

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
    <div>
      <div style={{ opacity: animateOrderDisabled ? 0.3 : 1.0 }}>
        Animate order:{' '}
        {animateOrderSet.size > 1 ? (
          <>(mixed)</>
        ) : (
          <input
            disabled={animateOrderDisabled}
            value={
              (animateOrderSet.size === 1 &&
                animateOrderSet.values().next().value) ||
              0
            }
            onChange={onChangeAnimateOrder}
            type="number"
            style={{ width: 40 }}
          />
        )}
      </div>
      <div style={{ opacity: animateDurationDisabled ? 0.3 : 1.0 }}>
        Animate duration (ms):{' '}
        {animateDurationSet.size > 1 ? (
          <>(mixed)</>
        ) : (
          <input
            disabled={animateDurationDisabled}
            value={
              (animateDurationSet.size === 1 &&
                animateDurationSet.values().next().value) ||
              ''
            }
            onChange={onChangeAnimateDuration}
            placeholder="Default"
            style={{ width: 50 }}
          />
        )}
      </div>
      <div>
        Animate pointer:{' '}
        <input
          defaultValue={defaultAnimateOptions.pointerImg || ''}
          onChange={onChangeAnimatePointerText}
          placeholder="URL..."
          style={{ width: 50 }}
        />{' '}
        <label>
          <input
            type="file"
            accept="image/*"
            onChange={onChangeAnimatePointerFile}
            style={{ width: 0 }}
          />
          File
        </label>
      </div>
      <div>
        (Pointer width:{' '}
        <input
          defaultValue={defaultAnimateOptions.pointerWidth || ''}
          onChange={onChangeAnimatePointerWidth}
          placeholder="Num..."
          style={{ width: 50 }}
        />
        )
      </div>
    </div>
  );
};
