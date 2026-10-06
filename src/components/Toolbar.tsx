import { Pencil, Eraser, PaintBucket, Hand, Lasso, Pipette, ChevronRight } from 'lucide-react';
import { SHAPE_TOOLS } from '../lib/constants';
import type { Tool, ShapeTool, BrushType } from '../lib/types';
import type { TKey } from '../i18n/translations';
import PencilPopover from './PencilPopover';
import ShapePopover from './ShapePopover';
import EraserPopover from './EraserPopover';
import ColorPicker from './ColorPicker';

type Popover = 'pencil' | 'eraser' | 'shape' | 'color' | null;

interface Props {
  isDark: boolean;
  panel: string;
  border: string;
  hover: string;
  muted: string;
  textSoft: string;
  textMain: string;
  btnBase: string;
  inputBg: string;

  activeTool: Tool;
  activePopover: Popover;
  shapeMenuOpen: boolean;
  hoveredShape: ShapeTool | null;
  lastShapeTool: ShapeTool;
  pencilTab: 'size' | 'brush';

  pencilSize: number;
  eraserSize: number;
  shapeSize: number;
  isShapeFilled: boolean;
  brushType: BrushType;
  selectedColor: string;

  hsv: { h: number; s: number; v: number };
  hexInput: string;
  rgbInput: { r: string; g: string; b: string };

  satValRef: React.RefObject<HTMLCanvasElement | null>;
  hueRef: React.RefObject<HTMLCanvasElement | null>;

  t: (k: TKey) => string;

  onToolClick: (t: Tool) => void;
  onShapeMouseDown: () => void;
  onShapeHover: (s: ShapeTool) => void;
  setActivePopover: (p: Popover) => void;
  setPencilTab: (t: 'size' | 'brush') => void;
  setPencilSize: (n: number) => void;
  setEraserSize: (n: number) => void;
  setShapeSize: (n: number) => void;
  setIsShapeFilled: (v: boolean) => void;
  setBrushType: (b: BrushType) => void;
  updateFromHsv: (n: { h: number; s: number; v: number }) => void;
  handleHex: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRgb: (ch: 'r' | 'g' | 'b', v: string) => void;
  onShowPreview: (size: number) => void;
  onHidePreview: () => void;
}

export default function Toolbar({
  isDark, panel, border, hover, muted, textSoft, textMain, btnBase, inputBg,
  activeTool, activePopover, shapeMenuOpen, hoveredShape, lastShapeTool,
  pencilTab, pencilSize, eraserSize, shapeSize, isShapeFilled, brushType, selectedColor,
  hsv, hexInput, rgbInput, satValRef, hueRef, t,
  onToolClick, onShapeMouseDown, onShapeHover, setActivePopover, setPencilTab,
  setPencilSize, setEraserSize, setShapeSize, setIsShapeFilled, setBrushType,
  updateFromHsv, handleHex, handleRgb, onShowPreview, onHidePreview,
}: Props) {
  const isCurrentShapeTool =
    activeTool === 'line' ||
    activeTool === 'rectangle' ||
    activeTool === 'circle' ||
    activeTool === 'triangle';

  const currentShape: ShapeTool = isCurrentShapeTool
    ? (activeTool as ShapeTool)
    : lastShapeTool;

  const shapeToolDef = SHAPE_TOOLS.find(s => s.id === currentShape)!;
  const CurrentShapeIcon = shapeToolDef.Icon;

  // Чистые, статичные стили для кнопок без эффектов масштабирования
  const getBtnStyle = (isActive: boolean) => {
    if (isActive) {
      return isDark
        ? 'bg-white/10 text-white shadow-sm'
        : 'bg-zinc-900 text-white shadow-sm';
    }
    return `${btnBase} ${textSoft} hover:${textMain} hover:bg-black/5 dark:hover:bg-white/5`;
  };

  return (
    <aside className="absolute top-1/2 -translate-y-1/2 left-4 z-30 select-none">
      <div className={`${panel} border ${border} rounded-2xl p-1.5 flex flex-col gap-1 shadow-2xl backdrop-blur-xl transition-colors duration-200`}>
        
        {/* Pencil */}
        <div className="relative">
          <button
            onClick={() => onToolClick('pencil')}
            onDoubleClick={() => { setActivePopover('pencil'); setPencilTab('size'); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'pencil')}`}
            title="Pencil"
          >
            <Pencil className="w-[18px] h-[18px]" strokeWidth={1.6} />
          </button>
          {activePopover === 'pencil' && (
            <PencilPopover
              isDark={isDark} border={border} muted={muted}
              size={pencilSize}
              brushType={brushType}
              tab={pencilTab}
              setSize={(v) => { setPencilSize(v); onShowPreview(v); }}
              setBrushType={setBrushType}
              setTab={setPencilTab}
              onHidePreview={onHidePreview}
              t={t}
            />
          )}
        </div>

        {/* Shape */}
        <div className="relative">
          <button
            onPointerDown={onShapeMouseDown}
            className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 ${getBtnStyle(isCurrentShapeTool)}`}
            title={t(shapeToolDef.labelKey)}
          >
            <CurrentShapeIcon className="w-[18px] h-[18px]" strokeWidth={1.6} />
            <ChevronRight
              className="absolute bottom-1 right-1 w-2.5 h-2.5 opacity-60"
              strokeWidth={2.5}
            />
          </button>
          {shapeMenuOpen && (
            <div className={`absolute left-13 top-0 ${panel} border ${border} rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl z-40 flex flex-col gap-0.5 min-w-[130px]`}>
              {SHAPE_TOOLS.map(({ id, labelKey, Icon }) => {
                const isHovered = hoveredShape === id;
                const isCurrent = activeTool === id;
                return (
                  <div
                    key={id}
                    onPointerEnter={() => onShapeHover(id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors duration-150 ${
                      isHovered || isCurrent
                        ? (isDark ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-900')
                        : `${textSoft}${hover}`
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.6} />
                    <span>{t(labelKey)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {activePopover === 'shape' && isCurrentShapeTool && !shapeMenuOpen && (
            <ShapePopover
              isDark={isDark} border={border} muted={muted}
              shapeSize={shapeSize}
              isShapeFilled={isShapeFilled}
              activeTool={activeTool}
              setShapeSize={setShapeSize}
              setIsShapeFilled={setIsShapeFilled}
              t={t}
            />
          )}
        </div>

        {/* Eraser */}
        <div className="relative">
          <button
            onClick={() => onToolClick('eraser')}
            onDoubleClick={() => setActivePopover('eraser')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'eraser')}`}
            title="Eraser"
          >
            <Eraser className="w-[18px] h-[18px]" strokeWidth={1.6} />
          </button>
          {activePopover === 'eraser' && (
            <EraserPopover
              isDark={isDark} border={border} muted={muted}
              eraserSize={eraserSize}
              setEraserSize={setEraserSize}
              onPreview={onShowPreview}
              onHidePreview={onHidePreview}
              t={t}
            />
          )}
        </div>

        {/* Bucket */}
        <button
          onClick={() => onToolClick('bucket')}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'bucket')}`}
          title="Bucket Fill"
        >
          <PaintBucket className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>

        {/* Eyedropper */}
        <button
          onClick={() => onToolClick('eyedropper')}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'eyedropper')}`}
          title="Eyedropper"
        >
          <Pipette className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>

        {/* Lasso */}
        <button
          onClick={() => onToolClick('lasso')}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'lasso')}`}
          title="Lasso Selection"
        >
          <Lasso className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>

        {/* Color */}
        <div className="relative my-0.5">
          <button
            onClick={() => {
              setActivePopover(activePopover === 'color' ? null : 'color');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 ${
              activePopover === 'color' ? (isDark ? 'bg-white/10' : 'bg-zinc-100') : btnBase
            }`}
            title="Color Picker"
          >
            <div className="w-5 h-5 rounded-full ring-2 ring-white/20 shadow-inner" style={{ backgroundColor: selectedColor }} />
          </button>
          {activePopover === 'color' && (
            <ColorPicker
              isDark={isDark} border={border} muted={muted}
              inputBg={inputBg} textMain={textMain}
              hsv={hsv} hexInput={hexInput} rgbInput={rgbInput}
              selectedColor={selectedColor}
              updateFromHsv={updateFromHsv}
              handleHex={handleHex}
              handleRgb={handleRgb}
              satValRef={satValRef}
              hueRef={hueRef}
            />
          )}
        </div>

        {/* Hand */}
        <button
          onClick={() => onToolClick('hand')}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'hand')}`}
          title="Pan / Hand"
        >
          <Hand className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>

      </div>
    </aside>
  );
}