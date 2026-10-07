export type Tool = 'pencil' | 'line' | 'rectangle' | 'circle' | 'triangle' | 'star' | 'eraser' | 'bucket' | 'hand' | 'lasso' | 'eyedropper';
export type ShapeTool = 'line' | 'rectangle' | 'circle' | 'triangle' | 'star';
export type Theme = 'light' | 'dark';
export type Lang = 'en' | 'ru';

export type BrushType =
  | 'round' | 'pencil' | 'marker' | 'ink' | 'calligraphy'
  | 'airbrush' | 'glow' | 'watercolor' | 'neon'
  | 'mist' | 'smoke' | 'cloud' | 'aurora' | 'fog'
  | 'spray' | 'chalk' | 'charcoal' | 'crayon' | 'bristle'
  | 'oil' | 'pastel' | 'sand' | 'rust' | 'concrete' | 'wood' | 'fabric'
  | 'sparkle' | 'stars' | 'confetti' | 'bubbles' | 'glitter'
  | 'frost' | 'splatter' | 'vine' | 'leaves'
  | 'mosaic' | 'rings' | 'web' | 'flame' | 'galaxy'
  | 'square';

export type EraserShape = 'round' | 'square';

export interface Point { x: number; y: number; }

export interface FreehandStroke {
  type: 'stroke';
  tool: 'pencil' | 'eraser';
  brush?: BrushType;
  points: Point[];
  pressures?: number[];
  color: string;
  size: number;
  opacity?: number;
}
export interface ShapeAction {
  type: 'shape';
  tool: ShapeTool;
  start: Point;
  end: Point;
  color: string;
  size: number;
  isFilled: boolean;
  shiftKey?: boolean;
  brush?: BrushType;
}
export interface FillAction {
  type: 'fill';
  x: number;
  y: number;
  color: string;
  opacity?: number;
}
export interface LassoAction {
  type: 'lasso';
  polygon: Point[];
  buffer: HTMLCanvasElement | null;
  bboxX: number;
  bboxY: number;
  offset: Point;
  deleteOnly?: boolean;
}
export type CanvasAction = FreehandStroke | ShapeAction | FillAction | LassoAction;

export interface LayerMeta {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface HistoryRegion {
  data: ImageData;
  x: number;
  y: number;
}

export interface HistoryEntry {
  layerId: string;
  frameId: string;
  before: HistoryRegion | null;
  after: HistoryRegion | null;
  label: string;
}

/* ─────────────────────────────────────────────────────────────────
 * .draft file format
 * ─────────────────────────────────────────────────────────────────
 * JSON-контейнер. Все canvas-ы сериализуются как base64 PNG.
 */
export interface DraftLayerData {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface DraftFrameMeta {
  id: string;
  duration: number;
}

export interface DraftProjectData {
  format: 'zuno-draft';
  version: 1;
  savedAt: string;
  canvasSize: { w: number; h: number };
  canvasBg: string;
  /** Порядок кадров. */
  frameOrder: string[];
  /** Метаданные кадров. */
  frameMeta: DraftFrameMeta[];
  /** Слои (порядок от нижнего к верхнему). */
  layers: DraftLayerData[];
  /** Активный слой. */
  activeLayerId: string;
  /** Индекс активного кадра. */
  currentFrame: number;
  /** FPS для воспроизведения. */
  fps: number;
  /** Настройки onion skin. */
  onion: { prev: number; next: number; opacity: number };
  /** Canvas-ы: layerId → frameId → base64 data URL. */
  canvases: Record<string, Record<string, string>>;
}