import type { ChangeEvent } from 'react';
import { useState, useMemo } from 'react';
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

  // Emoji palette state
  const [emojiAnnotation, setEmojiAnnotation] = useState('');
  const [emojiRotation, setEmojiRotation] = useState<number>(0);

  // generate emoji list (~850) - common emoji characters repeated/varied
  // curated emoji list covering common categories: emoticons, hearts, flags,
  // transport, tools, religions, professions, animals, food, sports, symbols,
  // tech, places, hand gestures and miscellaneous. Reduced redundant similar
  // smileys so each entry is useful in messaging contexts.
  const emojiList = useMemo(() => {
    const baseEmojis = [
      // Smileys & emotions (curated, no near-duplicates)
      '😀','😁','😂','🤣','😃','😄','😅','😊','😇','🙂','😉','😍','😘','😗','😙','😚',
      '😋','😜','🤪','😝','🤩','🤔','🤨','😐','😑','😶','😏','😒','🙄','😬','😌','😔',
      '😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','🤯','🤠','🥳','😎',
      '🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺',

      // Hearts & affectionate symbols (expanded)
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗',
      // additional heart variants
      '💖','💝','💘','💟','💌','💛‍🔥','💓‍🔥','💞‍🔥','💗‍🔥','💓‍💖',

      // Common flags (selection) - includes major countries and regions
      '🇺🇸','🇬🇧','🇨🇦','🇦🇺','🇮🇳','🇯🇵','🇨🇳','🇩🇪','🇫🇷','🇪🇸','🇮🇹','🇧🇷','🇲🇽','🇰🇷','🇷🇺',
      '🇿🇦','🇳🇱','🇸🇪','🇳🇴','🇫🇮','🇩🇰','🇪🇬','🇸🇦','🇹🇷','🇮🇱','🇵🇭','🇻🇳','🇹🇭','🇲🇾','🇸🇬',

      // Transportation & travel
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🛴','🚲','🛵','🏍️','🚨',
      '✈️','🛫','🛬','🛰️','🚀','🚁','⛵','🛶','🛳️','🚂','🚆','🚊','🚉','🚇','🚦','🛣️','🛤️',

      // Tools, construction, and hardware
      '🔧','🔨','🪛','🪚','🧰','🪓','🛠️','🔩','⚙️','🧲','🪜','💡','🔦','🧯','🧪','🧫','🧬','⚗️','🧹','🧺','🧻','🪥','🪒','🧴','🪑','🛋️',

      // Religious & spiritual symbols
      '✝️','☦️','☪️','🕉️','✡️','☸️','🛐','🕎','🕉','✝','☪',

      // Professions / jobs
      '👮‍♂️','👮‍♀️','👷‍♂️','👷‍♀️','💂‍♂️','💂‍♀️','🕵️‍♂️','🕵️‍♀️','👩‍⚕️','👨‍⚕️',
      '👩‍🏫','👨‍🏫','👩‍💻','👨‍💻','👩‍🍳','👨‍🍳','👩‍🔧','👨‍🔧','👩‍🚒','👨‍🚒','👩‍✈️','👨‍✈️','🎓','👩‍🌾','👨‍🌾','🧑‍⚖️','👩‍⚖️','👨‍⚖️','🧑‍🏭','👩‍🏭',

      // Animals & wildlife
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🐣','🦆','🦅','🦉','🦇','🐺','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🕷️','🦂','🦗','🐢','🐍','🦎','🦖','🦕',

      // Food & drink
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🥭','🍍','🥥','🥝','🍑','🍆','🥑','🥦','🥕','🌽','🥔','🍠','🥐','🍞','🥖','🧀','🍗','🍖','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🍤','🍙','🍚','🍘','🍢','🍡','🍧','🍨','🍦','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🧂','☕','🍵','🧃','🥤','🍺','🍻','🥂','🍷','🥃','🍸',

      // Sports & activities
      '⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥅','🏒','🏑','🥍','⛳','🏹','🎣','🥊','🥋','⛸️',

      // Music & arts
      '🎵','🎶','🎼','🎧','🎤','🎹','🎷','🎺','🎸','🥁','🎻','🎬','🎨','🎭','🎪','🎟️',

      // Weather & nature
      '🌞','🌝','🌛','🌜','⭐','🌟','☀️','🌤️','⛅','🌥️','🌦️','🌧️','⛈️','🌩️','🌨️','🌪️','🌫️','🌈','❄️','🔥','💧','🌊','🌸','🌼','🌻','🌺','🌱',

      // Symbols & arrows
      '✅','✔️','❌','❗','❓','⚠️','🔟','🔢','🔠','➡️','⬅️','⬆️','⬇️','↗️','↘️','↩️','↪️','🔁','🔂','🔀','♻️','🔄','💯','🔔','🔕','🔒','🔓','🔑',

      // Tech, office & communication
      '📱','📲','💻','🖥️','🖨️','⌨️','🖱️','🕹️','📷','📸','📹','🎥','📺','📻','📡','📞','☎️','📟','📠','🧾','📎','🖇️','📌','📍','📅','🗓️','🧭',

      // Places & buildings
      '🏠','🏡','🏢','🏬','🏣','🏥','🏦','🏨','🏪','🏫','⛪','🕌','🕍','🏯','🏰','🗼','🗽','🗺️',

      // Hands & gestures
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🙏','👏','🙌','🤝',

      // Misc / celebration / home
      '💼','🧳','🎁','🎈','🎉','🎊','🕯️','🧨','🧿','🔮','🧸','🛍️','🏷️','💡','🛒','🛎️','🧯'
    ];

    // Return the curated unique list. If requested later, we can expand
    // categories or add flag sets dynamically.
    return baseEmojis;
  }, []);

  const makeId = () => `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const insertEmoji = (emoji: string) => {
    // create a basic text element representing emoji
    const id = makeId();
    const angle = emojiRotation || 0;
    const element: any = {
      id,
      type: 'text',
      x: drawing.appState?.cursorX ?? 50,
      y: drawing.appState?.cursorY ?? 50,
      width: 100,
      height: 100,
      angle,
      strokeColor: '#000000',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      opacity: 100,
      text: (emojiAnnotation ? `${emoji} ${emojiAnnotation}` : emoji),
      fontSize: 48,
      fontFamily: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeStyle: 'solid',
      roughness: 0,
      seed: Math.floor(Math.random() * 1000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      groupIds: [],
    };
    try {
      api.updateScene({
        elements: [...drawing.elements, element],
        appState: drawing.appState,
        files: drawing.files,
      });
    } catch (err) {
      // fallback: try to append via updateScene with existing elements copy
      console.error('Failed to insert emoji element', err);
    }
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
        Animation
      </div>

      <div
        style={{
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
            value={
              (animateOrderSet.size === 1 &&
                animateOrderSet.values().next().value) ||
              ''
            }
            onChange={onChangeAnimateOrder}
            placeholder={animateOrderSet.size > 1 ? 'Mixed values' : '0'}
            style={{ width: 80, minWidth: 50 }}
            title="Set animation order"
          />
        </div>
      </div>

      <div
        style={{
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
            type="number"
            value={
              (animateDurationSet.size === 1 &&
                animateDurationSet.values().next().value) ||
              ''
            }
            onChange={onChangeAnimateDuration}
            placeholder="ms"
            style={{ width: 80, minWidth: 50 }}
            title="Set animation duration in milliseconds"
          />{' '}
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
          * Values are set to the app’s default settings unless you change them.
        </p>
      </div>

      {/* Emoji Palette Section */}
      <div
        style={{
          fontWeight: 'bold',
          margin: '8px 0 4px',
          borderBottom: '1px solid gray',
          paddingBottom: '5px',
        }}
      >
        Emoji Palette
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="app-input"
              placeholder="Annotation (optional)"
              value={emojiAnnotation}
              onChange={(e) => setEmojiAnnotation(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              className="app-input"
              type="number"
              value={emojiRotation}
              onChange={(e) => setEmojiRotation(Math.floor(Number(e.target.value) || 0))}
              title="Rotation in degrees"
              style={{ width: 80 }}
            />
          </div>

          <div
            style={{
              height: 240,
              overflowY: 'auto',
              border: '1px solid var(--input-border-color)',
              padding: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 40px)',
              gap: 8,
              alignContent: 'start',
            }}
            aria-label="Emoji palette"
          >
            {emojiList.map((em, i) => (
              <button
                key={i}
                type="button"
                onClick={() => insertEmoji(em)}
                title={`Insert ${em}`}
                style={{
                  width: 40,
                  height: 40,
                  fontSize: 20,
                  lineHeight: '40px',
                  textAlign: 'center',
                  background: 'transparent',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
