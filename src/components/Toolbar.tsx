import { useEffect, useRef, useState } from 'react';
import {
  Pencil, Eraser, PaintBucket, Hand, Lasso, Pipette, ChevronRight,
} from 'lucide-react';
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

const SAFE_MARGIN = 16;

const stopAll = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onWheel: (e: React.WheelEvent) => e.stopPropagation(),
  onContextMenu: (e: React.MouseEvent) => e.stopPropagation(),
};

export default function Toolbar({
  isDark, panel, border, hover, muted, textSoft, textMain, btnBase, inputBg,
  activeTool, activePopover, shapeMenuOpen, hoveredShape, lastShapeTool,
  pencilTab, pencilSize, eraserSize, shapeSize, isShapeFilled, brushType, selectedColor,
  hsv, hexInput, rgbInput, satValRef, hueRef, t,
  onToolClick, onShapeMouseDown, onShapeHover, setActivePopover, setPencilTab,
  setPencilSize, setEraserSize, setShapeSize, setIsShapeFilled, setBrushType,
  updateFromHsv, handleHex, handleRgb, onShowPreview, onHidePreview,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const verticalRef = useRef<HTMLDivElement>(null);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const verticalHeightRef = useRef(0);

  useEffect(() => {
    if (isHorizontal) return;
    const el = verticalRef.current;
    if (!el) return;
    const measure = () => {
      verticalHeightRef.current = el.getBoundingClientRect().height;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isHorizontal]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const measure = () => {
      const h = parent.clientHeight;
      const needed = verticalHeightRef.current || 400;
      const gap = (h - needed) / 2;
      setIsHorizontal(gap < SAFE_MARGIN);
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const isCurrentShapeTool =
    activeTool === 'line' || activeTool === 'rectangle' ||
    activeTool === 'circle' || activeTool === 'triangle';

  const currentShape: ShapeTool = isCurrentShapeTool
    ? (activeTool as ShapeTool)
    : lastShapeTool;

  const shapeToolDef = SHAPE_TOOLS.find(s => s.id === currentShape)!;
  const CurrentShapeIcon = shapeToolDef.Icon;

  const getBtnStyle = (isActive: boolean) => {
    if (isActive) {
      return isDark
        ? 'bg-white/10 text-white shadow-sm'
        : 'bg-zinc-900 text-white shadow-sm';
    }
    return `${btnBase} ${textSoft} hover:${textMain}`;
  };

  const Sep = ({ horizontal }: { horizontal?: boolean }) =>
    horizontal
      ? <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
      : <div className={`h-px w-6 mx-auto my-0.5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />;

  const BtnPencil = (
    <div className="relative">
      <button
        onClick={() => {
          if (activeTool === 'pencil' && activePopover === 'pencil') {
            setActivePopover(null);
          } else {
            onToolClick('pencil');
            setActivePopover('pencil');
          }
        }}
        onDoubleClick={() => { setActivePopover('pencil'); setPencilTab('size'); }}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'pencil')}`}
        title="Pencil"
      >
        <Pencil className="w-[17px] h-[17px]" strokeWidth={1.6} />
      </button>
      {activePopover === 'pencil' && (
        <PencilPopover
          isDark={isDark} border={border} muted={muted}
          size={pencilSize} brushType={brushType} tab={pencilTab}
          setSize={(v) => { setPencilSize(v); onShowPreview(v); }}
          setBrushType={setBrushType} setTab={setPencilTab}
          onHidePreview={onHidePreview} t={t}
        />
      )}
    </div>
  );

  const BtnShape = (
    <div className="relative">
      <button
        onPointerDown={onShapeMouseDown}
        className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${getBtnStyle(isCurrentShapeTool)}`}
        title={t(shapeToolDef.labelKey)}
      >
        <CurrentShapeIcon className="w-[17px] h-[17px]" strokeWidth={1.6} />
        <ChevronRight
          className={`absolute bottom-0.5 right-0.5 w-2 h-2 opacity-60 ${isHorizontal ? 'rotate-90' : ''}`}
          strokeWidth={2.5}
        />
      </button>
      {shapeMenuOpen && (
        <div className={`absolute ${
          isHorizontal ? 'top-full left-0 mt-1.5' : 'left-[68px] top-0'
        } ${panel} border ${border} rounded-xl p-1.5 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-0.5 min-w-[130px]`}>
          {SHAPE_TOOLS.map(({ id, labelKey, Icon }) => {
            const isHovered = hoveredShape === id;
            const isCurrent = activeTool === id;
            return (
              <div
                key={id}
                onPointerEnter={() => onShapeHover(id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 ${
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
          shapeSize={shapeSize} isShapeFilled={isShapeFilled} activeTool={activeTool}
          setShapeSize={setShapeSize} setIsShapeFilled={setIsShapeFilled} t={t}
        />
      )}
    </div>
  );

  const BtnEraser = (
    <div className="relative">
      <button
        onClick={() => {
          if (activeTool === 'eraser' && activePopover === 'eraser') {
            setActivePopover(null);
          } else {
            onToolClick('eraser');
            setActivePopover('eraser');
          }
        }}
        onDoubleClick={() => setActivePopover('eraser')}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'eraser')}`}
        title="Eraser"
      >
        <Eraser className="w-[17px] h-[17px]" strokeWidth={1.6} />
      </button>
      {activePopover === 'eraser' && (
        <EraserPopover
          isDark={isDark} border={border} muted={muted}
          eraserSize={eraserSize} setEraserSize={setEraserSize}
          onPreview={onShowPreview} onHidePreview={onHidePreview} t={t}
        />
      )}
    </div>
  );

  const BtnBucket = (
    <button
      onClick={() => onToolClick('bucket')}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'bucket')}`}
      title="Bucket"
    >
      <PaintBucket className="w-[17px] h-[17px]" strokeWidth={1.6} />
    </button>
  );

  const BtnLasso = (
    <button
      onClick={() => onToolClick('lasso')}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'lasso')}`}
      title="Lasso"
    >
      <Lasso className="w-[17px] h-[17px]" strokeWidth={1.6} />
    </button>
  );

  const BtnEyedropper = (
    <button
      onClick={() => onToolClick('eyedropper')}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'eyedropper')}`}
      title="Eyedropper"
    >
      <Pipette className="w-[17px] h-[17px]" strokeWidth={1.6} />
    </button>
  );

  const BtnColor = (
    <div className="relative">
      <button
        onClick={() => setActivePopover(activePopover === 'color' ? null : 'color')}
        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${
          activePopover === 'color'
            ? (isDark ? 'bg-white/10' : 'bg-zinc-100')
            : `${isDark ? 'hover:bg-white/8' : 'hover:bg-black/5'}`
        }`}
        title="Color"
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
          handleHex={handleHex} handleRgb={handleRgb}
          satValRef={satValRef} hueRef={hueRef}
        />
      )}
    </div>
  );

  const BtnHand = (
    <button
      onClick={() => onToolClick('hand')}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150 ${getBtnStyle(activeTool === 'hand')}`}
      title="Hand"
    >
      <Hand className="w-[17px] h-[17px]" strokeWidth={1.6} />
    </button>
  );

  return (
    <div ref={rootRef}>
      {isHorizontal ? (
        <div
          {...stopAll}
          className="absolute top-2 left-3 z-30 select-none"
        >
          <div className={`${panel} border ${border} rounded-2xl px-1.5 py-1 flex items-center gap-0.5 shadow-2xl backdrop-blur-xl`}>
            {BtnPencil}
            {BtnEraser}
            <Sep horizontal />
            {BtnShape}
            {BtnBucket}
            {BtnLasso}
            {BtnEyedropper}
            <Sep horizontal />
            {BtnColor}
            <Sep horizontal />
            {BtnHand}
          </div>
        </div>
      ) : (
        <div
          ref={verticalRef}
          {...stopAll}
          className="absolute top-1/2 -translate-y-1/2 left-3 z-30 select-none"
        >
          <div className={`${panel} border ${border} rounded-2xl p-1.5 flex flex-col gap-1 shadow-2xl backdrop-blur-xl`}>
            {BtnPencil}
            {BtnShape}
            {BtnEraser}
            {BtnBucket}
            {BtnEyedropper}
            {BtnLasso}
            {BtnColor}
            {BtnHand}
          </div>
        </div>
      )}
    </div>
  );
}