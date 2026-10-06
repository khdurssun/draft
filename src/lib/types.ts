export type Tool = 'pencil' | 'line' | 'rectangle' | 'circle' | 'triangle' | 'eraser' | 'bucket' | 'hand' | 'lasso' | 'eyedropper';
export type ShapeTool = 'line' | 'rectangle' | 'circle' | 'triangle';
export type Theme = 'light' | 'dark';
export type Lang = 'en' | 'ru';

export type BrushType =
  // basic
  | 'round' | 'pencil' | 'marker' | 'ink' | 'calligraphy'
  // soft
  | 'airbrush' | 'glow' | 'watercolor' | 'neon'
  | 'mist' | 'smoke' | 'cloud' | 'aurora' | 'fog'
  // textured
  | 'spray' | 'chalk' | 'charcoal' | 'crayon' | 'bristle'
  | 'oil' | 'pastel' | 'sand' | 'rust' | 'concrete' | 'wood' | 'fabric'
  // special
  | 'sparkle' | 'stars' | 'confetti' | 'bubbles' | 'glitter'
  | 'frost' | 'splatter' | 'vine' | 'leaves'
  // grand
  | 'mosaic' | 'rings' | 'web' | 'flame' | 'galaxy';

export interface Point { x: number; y: number; }

export interface FreehandStroke {
  type: 'stroke';
  tool: 'pencil' | 'eraser';
  brush?: BrushType;
  points: Point[];
  pressures?: number[];
  color: string;
  size: number;
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
}
export interface FillAction { type: 'fill'; x: number; y: number; color: string; }
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

export interface HistoryEntry {
  layerId: string;
  frameId: string;       // ← НОВОЕ
  before: ImageData | null;
  after: ImageData | null;
  label: string;
}