/**
 * Test helpers for e2e tests
 * Based on excalidraw-claymate's creationForTests.ts pattern
 */

export const STORAGE_KEY = 'excalidraw-app';
export const THEME_KEY = 'theme';

/**
 * Generate element ID with optional index
 */
export const getElementId = (index: number): string => {
  return `test-element-${index}`;
};

/**
 * Create a single rectangle element
 */
export const createRectangle = (
  id: string,
  x: number = 100,
  y: number = 100,
) => {
  return {
    type: 'rectangle',
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    id,
    fillStyle: 'hachure',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    angle: 0,
    x,
    y,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    width: 100,
    height: 80,
    seed: 1,
    groupIds: [],
    roundness: null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    index: null,
    frameId: null,
  };
};

/**
 * Create a text element
 */
export const createText = (
  id: string,
  text: string,
  x: number = 120,
  y: number = 130,
) => {
  return {
    type: 'text',
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    id,
    fillStyle: 'hachure',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    angle: 0,
    x,
    y,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    width: 60,
    height: 25,
    seed: 2,
    groupIds: [],
    roundness: null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    index: null,
    frameId: null,
    fontSize: 20,
    fontFamily: 1,
    text,
    lineHeight: 1.25 as never,
    textAlign: 'center',
    verticalAlign: 'middle',
    containerId: null,
    originalText: text,
    autoResize: true,
  };
};

/**
 * Create appState for testing
 * Based on claymate's creationForTests.ts
 */
export const createAppState = () => {
  return {
    contextMenu: null,
    showWelcomeScreen: false,
    isLoading: false,
    errorMessage: null,
    activeEmbeddable: null,
    newElement: null,
    resizingElement: null,
    multiElement: null,
    selectionElement: null,
    isBindingEnabled: true,
    startBoundElement: null,
    suggestedBindings: [],
    frameToHighlight: null,
    frameRendering: {
      enabled: false,
      name: false,
      outline: false,
      clip: false,
    },
    editingFrame: null,
    elementsToHighlight: null,
    editingTextElement: null,
    editingLinearElement: null,
    activeTool: {
      type: 'selection',
      locked: false,
      lastActiveTool: null,
      customType: null,
    },
    penMode: false,
    penDetected: false,
    exportBackground: true,
    exportEmbedScene: false,
    exportWithDarkMode: false,
    exportScale: 1,
    currentItemStrokeColor: '#000000',
    currentItemBackgroundColor: 'transparent',
    currentItemFillStyle: 'hachure',
    currentItemStrokeWidth: 1,
    currentItemStrokeStyle: 'solid',
    currentItemRoughness: 1,
    currentItemOpacity: 100,
    currentItemFontFamily: 1,
    currentItemFontSize: 20,
    currentItemTextAlign: 'left',
    currentItemStartArrowhead: null,
    currentItemEndArrowhead: 'arrow',
    currentHoveredFontFamily: null,
    currentItemRoundness: 'round',
    currentItemArrowType: 'sharp',
    viewBackgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    cursorButton: 'up',
    scrolledOutside: false,
    name: 'test-drawing',
    isResizing: false,
    isRotating: false,
    zoom: {
      value: 1 as never,
    },
    openMenu: null,
    openPopup: null,
    openSidebar: null,
    openDialog: null,
    defaultSidebarDockedPreference: false,
    lastPointerDownWith: 'mouse',
    selectedElementIds: {},
    hoveredElementIds: {},
    previousSelectedElementIds: {},
    selectedElementsAreBeingDragged: false,
    shouldCacheIgnoreZoom: false,
    toast: null,
    zenModeEnabled: false,
    theme: 'light',
    gridSize: 20,
    gridStep: 5,
    gridModeEnabled: false,
    viewModeEnabled: false,
    selectedGroupIds: {},
    editingGroupId: null,
    width: 800,
    height: 600,
    offsetTop: 0,
    offsetLeft: 0,
    fileHandle: null,
    collaborators: new Map(),
    stats: { open: false, panels: 0 },
    currentChartType: 'bar',
    pasteDialog: { shown: false, data: null },
    pendingImageElementId: null,
    showHyperlinkPopup: false,
    selectedLinearElement: null,
    snapLines: [],
    originSnapOffset: null,
    objectsSnapModeEnabled: false,
    userToFollow: null,
    followedBy: new Set(),
    isCropping: false,
    croppingElementId: null,
    searchMatches: [],
  };
};

/**
 * Drawing type for localStorage
 */
export type Drawing = {
  elements: ReturnType<typeof createRectangle | typeof createText>[];
  appState: ReturnType<typeof createAppState>;
  files: null;
};

/**
 * Create a Drawing with rectangle and text elements
 */
export const createDrawing = (text: string, primaryId: string): Drawing => {
  return {
    elements: [
      createRectangle(primaryId),
      createText(`${primaryId}-text`, text),
    ],
    appState: createAppState(),
    files: null,
  };
};

/**
 * Create a Drawing with multiple elements for animation testing
 */
export const createDrawingWithMultipleElements = (count: number): Drawing => {
  const elements: Drawing['elements'] = [];
  for (let i = 0; i < count; i++) {
    const x = 100 + i * 120;
    elements.push(createRectangle(getElementId(i), x, 100));
    elements.push(
      createText(`${getElementId(i)}-text`, `${i + 1}`, x + 20, 130),
    );
  }
  return {
    elements,
    appState: createAppState(),
    files: null,
  };
};

/**
 * Create multiple Drawings
 */
export const createDrawings = (numberOfDrawings: number): Drawing[] => {
  const drawings: Drawing[] = [];
  for (let i = 1; i <= numberOfDrawings; i++) {
    drawings.push(createDrawing(i.toString(), getElementId(i)));
  }
  return drawings;
};
