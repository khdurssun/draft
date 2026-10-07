import { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward, ChevronFirst, ChevronLast,
  Plus, Copy, Trash2, Eraser, ChevronUp, ChevronDown, ChevronUp as CaretUp, ChevronDown as CaretDown,
} from 'lucide-react';
import type { AnimationFrame } from '../animation/types';
import type { TKey } from '../i18n/translations';
import TimelineFrame from './TimelineFrame';

interface Props {
  isDark: boolean;
  panel: string;
  border: string;
  muted: string;
  btnBase: string;
  activeLayerId: string;
  frameOrder: string[];
  frameMeta: Map<string, AnimationFrame>;
  currentFrame: number;
  fps: number;
  isPlaying: boolean;
  onionPrev: number;
  onionNext: number;
  onionOpacity: number;
  canvasSize: { w: number; h: number };
  getFrameCanvas: (layerId: string, frameId: string) => HTMLCanvasElement | null;
  timelineVersion: number;
  t: (k: TKey) => string;
  onSelectFrame: (idx: number) => void;
  onPlayPause: () => void;
  onStop: () => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onAddFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onClearFrame: () => void;
  onSetFps: (n: number) => void;
  onSetOnionPrev: (n: number) => void;
  onSetOnionNext: (n: number) => void;
  onSetOnionOpacity: (n: number) => void;
}

const COLLAPSED_HEIGHT = 42;
const MAX_HEIGHT = 420;
const DEFAULT_EXPANDED_HEIGHT = 260;

/* ─── Числовое поле с кастомными стрелками ▲▼ ─── */
interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  fallback: number;
  onChange: (n: number) => void;
  isDark: boolean;
  width: string;
}

function NumberField({ value, min, max, fallback, onChange, isDark, width }: NumberFieldProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : fallback));

  const baseInput = [
    `${width} h-7 pl-1.5 pr-5 rounded-md border text-xs font-mono tabular-nums text-center`,
    'outline-none transition-colors',
    'appearance-none',
    '[&::-webkit-outer-spin-button]:appearance-none',
    '[&::-webkit-inner-spin-button]:appearance-none',
    '[&::-moz-appearance]:textfield',
    isDark
      ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-zinc-500'
      : 'bg-white border-zinc-300 text-zinc-900 focus:border-zinc-500',
  ].join(' ');

  const arrowBtn = [
    'flex items-center justify-center w-4 h-[13px] transition-colors',
    isDark
      ? 'text-zinc-500 hover:text-zinc-100 active:text-blue-400'
      : 'text-zinc-400 hover:text-zinc-900 active:text-blue-500',
  ].join(' ');

  return (
    <div className="relative inline-flex items-center">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className={baseInput}
      />
      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex flex-col">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(clamp(value + 1))}
          className={arrowBtn}
          aria-label="increment"
        >
          <CaretUp className="w-2.5 h-2.5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(clamp(value - 1))}
          className={arrowBtn}
          aria-label="decrement"
        >
          <CaretDown className="w-2.5 h-2.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

export default function Timeline({
  isDark, panel, border, muted, btnBase,
  activeLayerId, frameOrder,
  currentFrame, fps, isPlaying,
  onionPrev, onionNext, onionOpacity,
  canvasSize, getFrameCanvas, timelineVersion, t,
  onSelectFrame,
  onPlayPause, onStop, onFirst, onPrev, onNext, onLast,
  onAddFrame, onDuplicateFrame, onDeleteFrame, onClearFrame,
  onSetFps, onSetOnionPrev, onSetOnionNext, onSetOnionOpacity,
}: Props) {
  const [height, setHeight] = useState<number>(COLLAPSED_HEIGHT);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const frameRefsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevFrameCountRef = useRef<number>(frameOrder.length);
  const isExpanded = height > COLLAPSED_HEIGHT + 8;

  /* ─── Автоскролл ─── */
  useEffect(() => {
    if (!isExpanded) return;
    const grew = frameOrder.length > prevFrameCountRef.current;
    prevFrameCountRef.current = frameOrder.length;

    if (grew) {
      addButtonRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'end',
      });
    } else {
      const el = frameRefsRef.current.get(currentFrame);
      el?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [currentFrame, frameOrder.length, isExpanded]);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startH: height };
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    let next = dragRef.current.startH + dy;
    if (next < COLLAPSED_HEIGHT + 20) next = COLLAPSED_HEIGHT;
    if (next > MAX_HEIGHT) next = MAX_HEIGHT;
    setHeight(next);
  };
  const onHandlePointerUp = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (dragRef.current) {
      const moved = Math.abs(e.clientY - dragRef.current.startY);
      if (moved < 4) {
        setHeight(prev => prev <= COLLAPSED_HEIGHT ? DEFAULT_EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
      } else if (height > COLLAPSED_HEIGHT && height < COLLAPSED_HEIGHT + 60) {
        setHeight(COLLAPSED_HEIGHT);
      } else if (height >= COLLAPSED_HEIGHT + 60 && height < 100) {
        setHeight(DEFAULT_EXPANDED_HEIGHT);
      }
    }
    dragRef.current = null;
  };
  const onHandleDoubleClick = () => {
    setHeight(prev => prev <= COLLAPSED_HEIGHT ? DEFAULT_EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
  };

  const onStripWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    if (!el) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };

  const iconBtn = `w-8 h-8 rounded-md flex items-center justify-center transition-colors ${btnBase}`;

  const stripBg = isDark ? 'bg-[#0a0a0b]' : 'bg-zinc-50';
  const labelColor = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const counterBg = isDark ? 'bg-zinc-800/60 text-zinc-300' : 'bg-white text-zinc-700';

  return (
    <div
      className={`${panel} border-t ${border} flex flex-col shrink-0 relative select-none`}
      style={{
        height,
        transition: dragRef.current ? 'none' : 'height 0.18s ease',
      }}
    >
      {/* Drag-handle */}
      <div
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        onDoubleClick={onHandleDoubleClick}
        className={`h-2 w-full cursor-ns-resize select-none group relative ${
          isDark ? 'hover:bg-zinc-800/80' : 'hover:bg-zinc-100'
        }`}
        title="Drag to resize · Double-click to toggle"
      >
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 rounded-full transition-colors ${
          isDark ? 'bg-zinc-700 group-hover:bg-zinc-500' : 'bg-zinc-300 group-hover:bg-zinc-400'
        }`} />
      </div>

      {/* Шапка управления */}
      <div className={`h-[42px] flex items-center justify-between px-3 border-t ${border} gap-4`}>
        <div className="flex items-center gap-1">
          <button onClick={onFirst} className={iconBtn} title={t('firstFrame')}>
            <ChevronFirst className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <button onClick={onPrev} className={iconBtn} title={t('prevFrame')}>
            <SkipBack className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <button
            onClick={onPlayPause}
            className={`w-9 h-8 rounded-md flex items-center justify-center transition-colors ${
              isPlaying
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : (isDark ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300')
            }`}
            title={`${isPlaying ? t('pause') : t('play')} · Space`}
          >
            {isPlaying
              ? <Pause className="w-4 h-4" strokeWidth={2} />
              : <Play className="w-4 h-4" strokeWidth={2} />}
          </button>
          <button onClick={onStop} className={iconBtn} title={t('stop')}>
            <Square className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button onClick={onNext} className={iconBtn} title={t('nextFrame')}>
            <SkipForward className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <button onClick={onLast} className={iconBtn} title={t('lastFrame')}>
            <ChevronLast className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

        <div className="flex items-center gap-3">
          <div className={`text-xs font-mono font-medium tabular-nums px-2.5 py-1 rounded-md ${
            isDark ? 'bg-zinc-800/80 text-zinc-200' : 'bg-zinc-100 text-zinc-800'
          }`}>
            {currentFrame + 1} / {frameOrder.length}
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>{t('fps')}</span>
            <NumberField
              value={fps}
              min={1}
              max={60}
              fallback={12}
              onChange={onSetFps}
              isDark={isDark}
              width="w-14"
            />
          </div>
        </div>

        <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

        <div className="flex items-center gap-1">
          <button onClick={onAddFrame} className={iconBtn} title={`${t('newFrame')} · Ctrl+M`}>
            <Plus className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <button onClick={onDuplicateFrame} className={iconBtn} title={t('duplicateFrame')}>
            <Copy className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <button onClick={onClearFrame} className={iconBtn} title={t('clearFrame')}>
            <Eraser className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <button
            onClick={onDeleteFrame}
            disabled={frameOrder.length <= 1}
            className={`${iconBtn} disabled:opacity-30 hover:!text-red-400`}
            title={`${t('deleteFrame')} · Ctrl+Del`}
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>
            {t('onionSkin')}
          </span>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-medium uppercase ${muted}`}>{t('onionPrev')}</span>
            <NumberField
              value={onionPrev}
              min={0}
              max={5}
              fallback={0}
              onChange={onSetOnionPrev}
              isDark={isDark}
              width="w-12"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-medium uppercase ${muted}`}>{t('onionNext')}</span>
            <NumberField
              value={onionNext}
              min={0}
              max={5}
              fallback={0}
              onChange={onSetOnionNext}
              isDark={isDark}
              width="w-12"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-medium uppercase ${muted}`}>{t('onionOpacity')}</span>
            <NumberField
              value={Math.round(onionOpacity * 100)}
              min={5}
              max={80}
              fallback={30}
              onChange={(n) => onSetOnionOpacity(n / 100)}
              isDark={isDark}
              width="w-14"
            />
            <span className={`text-xs ${muted}`}>%</span>
          </div>
        </div>

        <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

        <button
          onClick={() => setHeight(prev => prev <= COLLAPSED_HEIGHT ? DEFAULT_EXPANDED_HEIGHT : COLLAPSED_HEIGHT)}
          className={iconBtn}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded
            ? <ChevronDown className="w-4 h-4" strokeWidth={1.8} />
            : <ChevronUp className="w-4 h-4" strokeWidth={1.8} />}
        </button>
      </div>

      {/* Лента кадров */}
      {isExpanded && (
        <div className={`flex-1 border-t ${border} ${stripBg} flex flex-col overflow-hidden`}>
          <div className={`flex items-center justify-between px-3 py-1.5 border-b ${border}`}>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${labelColor}`}>
                {t('frames')}
              </span>
              <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${counterBg}`}>
                {currentFrame + 1} / {frameOrder.length}
              </span>
            </div>
            <span className={`text-[10px] ${labelColor}`}>{t('scrollHint')}</span>
          </div>

          <div
            ref={stripRef}
            onWheel={onStripWheel}
            className="flex-1 overflow-x-auto overflow-y-hidden scroll-thin"
          >
            <div className="h-full flex items-start gap-2 px-3 py-3 min-w-max">
              {frameOrder.map((fid, idx) => {
                const isActive = idx === currentFrame;
                return (
                  <div
                    key={fid}
                    ref={(el) => {
                      if (el) frameRefsRef.current.set(idx, el);
                      else frameRefsRef.current.delete(idx);
                    }}
                    className="shrink-0"
                  >
                    <button
                      onClick={() => onSelectFrame(idx)}
                      className={`group flex flex-col items-center gap-1 rounded-md p-1 transition-colors ${
                        isActive
                          ? (isDark ? 'bg-blue-500/10' : 'bg-blue-50')
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                      title={`${t('frame')} ${idx + 1}`}
                    >
                      <TimelineFrame
                        layerId={activeLayerId}
                        frameId={fid}
                        index={idx}
                        isActive={isActive}
                        isCurrentLayer={true}
                        getFrameCanvas={getFrameCanvas}
                        canvasSize={canvasSize}
                        isDark={isDark}
                        onClick={() => onSelectFrame(idx)}
                        version={timelineVersion}
                      />
                      <span className={`text-[10px] font-mono tabular-nums leading-none ${
                        isActive
                          ? (isDark ? 'text-blue-300' : 'text-blue-700')
                          : muted
                      }`}>
                        {idx + 1}
                      </span>
                    </button>
                  </div>
                );
              })}

              <button
                ref={addButtonRef}
                onClick={onAddFrame}
                title={`${t('newFrame')} · Ctrl+M`}
                className={`shrink-0 flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-md border-2 border-dashed transition-colors ${
                  isDark
                    ? 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    : 'border-zinc-300 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 hover:bg-black/5'
                }`}
              >
                <Plus className="w-5 h-5" strokeWidth={1.8} />
                <span className="text-[9px] font-medium uppercase tracking-wider">{t('newFrameHint')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}