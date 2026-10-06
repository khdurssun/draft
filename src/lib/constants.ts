import { Pencil, Minus, Square, Circle, Triangle, PenTool, Sparkles, Zap, Wind, Droplet, Flame, Feather, Palette, Brush, CircleDot } from 'lucide-react';
import type { ShapeTool, BrushType } from './types';
import type { TKey } from '../i18n/translations';

export const SHAPE_TOOLS: { id: ShapeTool; labelKey: TKey; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: 'line', labelKey: 'line', Icon: Minus },
  { id: 'rectangle', labelKey: 'square', Icon: Square },
  { id: 'circle', labelKey: 'circle', Icon: Circle },
  { id: 'triangle', labelKey: 'triangle', Icon: Triangle },
];

export const BRUSHES: { id: BrushType; labelKey: TKey; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; group: 'basic'|'soft'|'textured'|'special' }[] = [
  { id: 'round', labelKey: 'bRound', Icon: Circle, group: 'basic' },
  { id: 'pencil', labelKey: 'bPencil', Icon: Pencil, group: 'basic' },
  { id: 'marker', labelKey: 'bMarker', Icon: PenTool, group: 'basic' },
  { id: 'airbrush', labelKey: 'bAirbrush', Icon: Wind, group: 'soft' },
  { id: 'glow', labelKey: 'bGlow', Icon: Sparkles, group: 'soft' },
  { id: 'watercolor', labelKey: 'bWatercolor', Icon: Droplet, group: 'soft' },
  { id: 'spray', labelKey: 'bSpray', Icon: Sparkles, group: 'textured' },
  { id: 'chalk', labelKey: 'bChalk', Icon: Feather, group: 'textured' },
  { id: 'charcoal', labelKey: 'bCharcoal', Icon: Flame, group: 'textured' },
  { id: 'crayon', labelKey: 'bCrayon', Icon: Palette, group: 'textured' },
  { id: 'neon', labelKey: 'bNeon', Icon: Zap, group: 'special' },
  { id: 'ink', labelKey: 'bInk', Icon: Brush, group: 'special' },
  { id: 'calligraphy', labelKey: 'bCalligraphy', Icon: PenTool, group: 'special' },
  { id: 'bristle', labelKey: 'bBristle', Icon: Brush, group: 'special' },
  { id: 'sparkle', labelKey: 'bSparkle', Icon: CircleDot, group: 'special' },
];

export const PRESETS = [
  { name: 'A4', w: 794, h: 1123 },
  { name: 'A3', w: 1123, h: 1587 },
  { name: 'Square', w: 1000, h: 1000 },
  { name: 'HD', w: 1920, h: 1080 },
  { name: 'Portrait', w: 1080, h: 1350 },
  { name: 'Story', w: 1080, h: 1920 },
];

export const uid = () => Math.random().toString(36).slice(2, 10);