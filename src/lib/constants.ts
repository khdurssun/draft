import {
  Pencil, Minus, Square, Circle, Triangle, PenTool, Sparkles, Zap, Wind, Droplet,
  Flame, Feather, Palette, Brush, CircleDot,
  Pen, Cloud, Waves, Snowflake, Star, PartyPopper, Gem, Flower2, Leaf, Grid3x3,
  Layers, Sun, Circle as CircleIcon,
} from 'lucide-react';
import type { ShapeTool, BrushType } from './types';
import type { TKey } from '../i18n/translations';

export const SHAPE_TOOLS: { id: ShapeTool; labelKey: TKey; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: 'line',      labelKey: 'line',      Icon: Minus },
  { id: 'rectangle', labelKey: 'square',    Icon: Square },
  { id: 'circle',    labelKey: 'circle',    Icon: Circle },
  { id: 'triangle',  labelKey: 'triangle',  Icon: Triangle },
  { id: 'star',      labelKey: 'star',      Icon: Star },
];

export type BrushGroup = 'basic' | 'soft' | 'textured' | 'special' | 'grand';

export const BRUSHES: {
  id: BrushType;
  labelKey: TKey;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  group: BrushGroup;
}[] = [
  /* ───── basic ───── */
  { id: 'round',       labelKey: 'bRound',       Icon: Circle,     group: 'basic' },
  { id: 'pencil',      labelKey: 'bPencil',      Icon: Pencil,     group: 'basic' },
  { id: 'marker',      labelKey: 'bMarker',      Icon: PenTool,    group: 'basic' },
  { id: 'ink',         labelKey: 'bInk',         Icon: Pen,        group: 'basic' },
  { id: 'calligraphy', labelKey: 'bCalligraphy', Icon: Feather,    group: 'basic' },

  /* ───── soft ───── */
  { id: 'airbrush',   labelKey: 'bAirbrush',   Icon: Wind,      group: 'soft' },
  { id: 'glow',       labelKey: 'bGlow',       Icon: Sparkles,  group: 'soft' },
  { id: 'watercolor', labelKey: 'bWatercolor', Icon: Droplet,   group: 'soft' },
  { id: 'neon',       labelKey: 'bNeon',       Icon: Zap,       group: 'soft' },
  { id: 'mist',       labelKey: 'bMist',       Icon: Cloud,     group: 'soft' },
  { id: 'smoke',      labelKey: 'bSmoke',      Icon: Wind,      group: 'soft' },
  { id: 'cloud',      labelKey: 'bCloud',      Icon: Cloud,     group: 'soft' },
  { id: 'aurora',     labelKey: 'bAurora',     Icon: Waves,     group: 'soft' },
  { id: 'fog',        labelKey: 'bFog',        Icon: Wind,      group: 'soft' },

  /* ───── textured ───── */
  { id: 'spray',    labelKey: 'bSpray',    Icon: Sparkles,  group: 'textured' },
  { id: 'chalk',    labelKey: 'bChalk',    Icon: Feather,   group: 'textured' },
  { id: 'charcoal', labelKey: 'bCharcoal', Icon: Flame,     group: 'textured' },
  { id: 'crayon',   labelKey: 'bCrayon',   Icon: Palette,   group: 'textured' },
  { id: 'bristle',  labelKey: 'bBristle',  Icon: Brush,     group: 'textured' },
  { id: 'oil',      labelKey: 'bOil',      Icon: Palette,   group: 'textured' },
  { id: 'pastel',   labelKey: 'bPastel',   Icon: Palette,   group: 'textured' },
  { id: 'sand',     labelKey: 'bSand',     Icon: Layers,    group: 'textured' },
  { id: 'rust',     labelKey: 'bRust',     Icon: Layers,    group: 'textured' },
  { id: 'concrete', labelKey: 'bConcrete', Icon: Grid3x3,   group: 'textured' },
  { id: 'wood',     labelKey: 'bWood',     Icon: Layers,    group: 'textured' },
  { id: 'fabric',   labelKey: 'bFabric',   Icon: Grid3x3,   group: 'textured' },

  /* ───── special ───── */
  { id: 'sparkle',  labelKey: 'bSparkle',  Icon: CircleDot,   group: 'special' },
  { id: 'stars',    labelKey: 'bStars',    Icon: Star,        group: 'special' },
  { id: 'confetti', labelKey: 'bConfetti', Icon: PartyPopper, group: 'special' },
  { id: 'bubbles',  labelKey: 'bBubbles',  Icon: CircleIcon,  group: 'special' },
  { id: 'glitter',  labelKey: 'bGlitter',  Icon: Gem,         group: 'special' },
  { id: 'frost',    labelKey: 'bFrost',    Icon: Snowflake,   group: 'special' },
  { id: 'splatter', labelKey: 'bSplatter', Icon: Droplet,     group: 'special' },
  { id: 'vine',     labelKey: 'bVine',     Icon: Flower2,     group: 'special' },
  { id: 'leaves',   labelKey: 'bLeaves',   Icon: Leaf,        group: 'special' },

  /* ───── grand ───── */
  { id: 'mosaic', labelKey: 'bMosaic', Icon: Grid3x3,   group: 'grand' },
  { id: 'rings',  labelKey: 'bRings',  Icon: CircleDot, group: 'grand' },
  { id: 'web',    labelKey: 'bWeb',    Icon: Grid3x3,   group: 'grand' },
  { id: 'flame',  labelKey: 'bFlame',  Icon: Flame,     group: 'grand' },
  { id: 'galaxy', labelKey: 'bGalaxy', Icon: Sun,       group: 'grand' },
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