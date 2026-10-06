import { useRef, useState } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward, ChevronFirst, ChevronLast,
  Plus, Copy, Trash2, Eraser, ChevronUp, ChevronDown, Layers,
} from 'lucide-react';
import type { LayerMeta } from '../lib/types';
import type { AnimationFrame } from '../animation/types';
import type { TKey } from '../i18n/translations';
import TimelineFrame from './TimelineFrame';

interface Props {
  isDark: boolean;
  panel: string;
  border: string;
  muted: string;
  btnBase: string;
  layers: LayerMeta[];
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
  onSelectLayer: (id: string) => void;
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

export default function Timeline({
  isDark, panel, border, muted, btnBase,
  layers, activeLayerId, frameOrder,
  currentFrame, fps, isPlaying,
  onionPrev, onionNext, onionOpacity,
  canvasSize, getFrameCanvas, timelineVersion, t,
  onSelectFrame, onSelectLayer,
  onPlayPause, onStop, onFirst, onPrev, onNext, onLast,
  onAddFrame, onDuplicateFrame, onDeleteFrame, onClearFrame,
  onSetFps, onSetOnionPrev, onSetOnionNext, onSetOnionOpacity,
}: Props) {
  const [height, setHeight] = useState<number>(COLLAPSED_HEIGHT);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const isExpanded = height > COLLAPSED_HEIGHT + 8;

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

  const iconBtn = `w-8 h-8 rounded-md flex items-center justify-center transition-colors ${btnBase}`;
  const inputBg = isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-zinc-300 text-zinc-900';
  const reversedLayers = [...layers].reverse();

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
        {/* Воспроизведение */}
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
            title={isPlaying ? t('pause') : t('play')}
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

        {/* Счётчик и FPS */}
        <div className="flex items-center gap-3">
          <div className={`text-xs font-mono font-medium tabular-nums px-2.5 py-1 rounded-md ${
            isDark ? 'bg-zinc-800/80 text-zinc-200' : 'bg-zinc-100 text-zinc-800'
          }`}>
            {currentFrame + 1} / {frameOrder.length}
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>{t('fps')}</span>
            <input
              type="number"
              min={1}
              max={60}
              value={fps}
              onChange={(e) => onSetFps(Math.max(1, Math.min(60, Number(e.target.value) || 12)))}
              className={`w-12 px-1.5 py-1 rounded-md border text-xs font-mono text-center focus:outline-none focus:border-zinc-500 ${inputBg}`}
            />
          </div>
        </div>

        <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

        {/* Действия с кадрами */}
        <div className="flex items-center gap-1">
          <button onClick={onAddFrame} className={iconBtn} title={t('newFrame')}>
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
            title={t('deleteFrame')}
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

        {/* Onion Skin */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>
            {t('onionSkin')}
          </span>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-medium uppercase ${muted}`}>{t('onionPrev')}</span>
            <input
              type="number"
              min={0}
              max={5}
              value={onionPrev}
              onChange={(e) => onSetOnionPrev(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
              className={`w-10 px-1 py-1 rounded-md border text-xs font-mono text-center focus:outline-none focus:border-zinc-500 ${inputBg}`}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-medium uppercase ${muted}`}>{t('onionNext')}</span>
            <input
              type="number"
              min={0}
              max={5}
              value={onionNext}
              onChange={(e) => onSetOnionNext(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
              className={`w-10 px-1 py-1 rounded-md border text-xs font-mono text-center focus:outline-none focus:border-zinc-500 ${inputBg}`}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-medium uppercase ${muted}`}>{t('onionOpacity')}</span>
            <input
              type="number"
              min={5}
              max={80}
              value={Math.round(onionOpacity * 100)}
              onChange={(e) => onSetOnionOpacity(Math.max(5, Math.min(80, Number(e.target.value) || 30)) / 100)}
              className={`w-12 px-1 py-1 rounded-md border text-xs font-mono text-center focus:outline-none focus:border-zinc-500 ${inputBg}`}
            />
            <span className={`text-xs ${muted}`}>%</span>
          </div>
        </div>

        <div className={`w-px h-5 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

        {/* Разворот / Сворачивание */}
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

      {/* Сетка развёрнутого таймлайна */}
      {isExpanded && (
        <div className="flex-1 overflow-auto border-t border-inherit">
          {layers.length === 0 ? (
            /* Пустое состояние при отсутствии слоёв */
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <Layers className={`w-8 h-8 mb-2 ${muted} opacity-40`} strokeWidth={1.5} />
              <p className={`text-xs font-medium ${muted}`}>Нет доступных слоёв</p>
            </div>
          ) : (
            <div className="min-w-max">
              {/* Шапка кадров */}
              <div
                className="flex items-center sticky top-0 z-10 border-b border-inherit"
                style={{ background: isDark ? '#0f0f10' : '#ffffff' }}
              >
                <div className={`w-36 shrink-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${muted} border-r ${border}`}>
                  {t('layers')}
                </div>
                {frameOrder.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-12 shrink-0 text-center text-xs font-mono font-medium tabular-nums py-1.5 border-r ${border} ${
                      idx === currentFrame
                        ? (isDark ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'bg-blue-100 text-blue-700 font-semibold')
                        : muted
                    }`}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>

              {/* Строки слоёв */}
              {reversedLayers.map((layer) => {
                const isActiveLayer = layer.id === activeLayerId;
                return (
                  <div key={layer.id} className="flex items-center">
                    <button
                      onClick={() => onSelectLayer(layer.id)}
                      className={`w-36 shrink-0 px-3 py-2 text-xs font-medium text-left truncate border-r border-b ${border} transition-colors ${
                        isActiveLayer
                          ? (isDark ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-200 text-zinc-900')
                          : (isDark ? 'text-zinc-400 hover:bg-zinc-800/50' : 'text-zinc-600 hover:bg-zinc-100')
                      } ${layer.locked ? 'opacity-50' : ''}`}
                      title={layer.name}
                    >
                      {layer.visible ? '' : '· '}{layer.name}
                    </button>
                    <div className="flex border-b border-inherit">
                      {frameOrder.map((fid, idx) => (
                        <div
                          key={fid}
                          className={`w-12 shrink-0 flex items-center justify-center py-1.5 border-r ${border} ${
                            isDark ? 'bg-zinc-900/30' : 'bg-zinc-50/50'
                          }`}
                        >
                          <TimelineFrame
                            layerId={layer.id}
                            frameId={fid}
                            index={idx}
                            isActive={idx === currentFrame}
                            isCurrentLayer={isActiveLayer}
                            getFrameCanvas={getFrameCanvas}
                            canvasSize={canvasSize}
                            isDark={isDark}
                            onClick={() => onSelectFrame(idx)}
                            version={timelineVersion}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}