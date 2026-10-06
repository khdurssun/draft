export type Tool = 'pencil' | 'line' | 'rectangle' | 'circle' | 'triangle' | 'eraser' | 'bucket' | 'hand' | 'lasso' | 'eyedropper';
export type ShapeTool = 'line' | 'rectangle' | 'circle' | 'triangle';
export type Theme = 'light' | 'dark';
export type Lang = 'en' | 'ru';
export type BrushType =
  | 'round' | 'pencil' | 'marker'
  | 'airbrush' | 'glow' | 'watercolor'
  | 'spray' | 'chalk' | 'charcoal' | 'crayon'
  | 'neon' | 'ink' | 'calligraphy' | 'bristle' | 'sparkle';

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
  before: ImageData | null;
  after: ImageData | null;
  label: string;
}