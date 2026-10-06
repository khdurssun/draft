import {
  Play, Pause, Square, SkipBack, SkipForward, ChevronFirst, ChevronLast,
  Plus, Copy, Trash2, Eraser,
} from 'lucide-react';
import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  muted: string;
  border: string;
  btnBase: string;
  isPlaying: boolean;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  onionEnabled: boolean;
  onionPrev: number;
  onionNext: number;
  onionOpacity: number;
  t: (k: TKey) => string;
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
  onToggleOnion: () => void;
  onSetOnionPrev: (n: number) => void;
  onSetOnionNext: (n: number) => void;
  onSetOnionOpacity: (n: number) => void;
}

export default function AnimationControls({
  isDark, muted, border, btnBase,
  isPlaying, currentFrame, totalFrames, fps,
  onionEnabled, onionPrev, onionNext, onionOpacity,
  t,
  onPlayPause, onStop, onFirst, onPrev, onNext, onLast,
  onAddFrame, onDuplicateFrame, onDeleteFrame, onClearFrame,
  onSetFps, onToggleOnion, onSetOnionPrev, onSetOnionNext, onSetOnionOpacity,
}: Props) {
  const iconBtn = `w-7 h-7 rounded flex items-center justify-center transition-colors ${btnBase}`;

  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 border-b ${border} flex-wrap`}>
      {/* Playback */}
      <div className="flex items-center gap-0.5">
        <button onClick={onFirst} className={iconBtn} title={t('firstFrame')}>
          <ChevronFirst className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        <button onClick={onPrev} className={iconBtn} title={t('prevFrame')}>
          <SkipBack className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        <button
          onClick={onPlayPause}
          className={`w-8 h-7 rounded flex items-center justify-center transition-colors ${
            isPlaying
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : (isDark ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300')
          }`}
          title={isPlaying ? t('pause') : t('play')}
        >
          {isPlaying
            ? <Pause className="w-3.5 h-3.5" strokeWidth={2} />
            : <Play className="w-3.5 h-3.5" strokeWidth={2} />}
        </button>
        <button onClick={onStop} className={iconBtn} title={t('stop')}>
          <Square className="w-3 h-3" strokeWidth={2} />
        </button>
        <button onClick={onNext} className={iconBtn} title={t('nextFrame')}>
          <SkipForward className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        <button onClick={onLast} className={iconBtn} title={t('lastFrame')}>
          <ChevronLast className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Счётчик кадров */}
      <div className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded ${isDark ? 'bg-zinc-800/60 text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>
        {currentFrame + 1} / {totalFrames}
      </div>

      {/* FPS */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] uppercase tracking-wider ${muted}`}>{t('fps')}</span>
        <input
          type="number"
          min={1}
          max={60}
          value={fps}
          onChange={(e) => onSetFps(Math.max(1, Math.min(60, Number(e.target.value) || 12)))}
          className={`w-12 px-1.5 py-0.5 rounded border text-[11px] font-mono text-center ${
            isDark ? 'bg-[#0a0a0b] border-[#1f1f22] text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
          }`}
        />
      </div>

      <div className={`w-px h-4 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

      {/* Frame actions */}
      <div className="flex items-center gap-0.5">
        <button onClick={onAddFrame} className={iconBtn} title={t('newFrame')}>
          <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        <button onClick={onDuplicateFrame} className={iconBtn} title={t('duplicateFrame')}>
          <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        <button
          onClick={onClearFrame}
          className={iconBtn}
          title={t('clearFrame')}
        >
          <Eraser className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        <button
          onClick={onDeleteFrame}
          disabled={totalFrames <= 1}
          className={`${iconBtn} disabled:opacity-30 hover:!text-red-400`}
          title={t('deleteFrame')}
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      </div>

      <div className={`w-px h-4 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

      {/* Onion skin */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleOnion}
          className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium transition-colors ${
            onionEnabled
              ? 'bg-blue-600 text-white'
              : (isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200')
          }`}
        >
          {t('onionSkin')}
        </button>
        {onionEnabled && (
          <>
            <div className="flex items-center gap-1">
              <span className={`text-[9px] uppercase tracking-wider ${muted}`}>{t('onionPrev')}</span>
              <input
                type="number"
                min={1}
                max={5}
                value={onionPrev}
                onChange={(e) => onSetOnionPrev(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                className={`w-9 px-1 py-0.5 rounded border text-[10px] font-mono text-center ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f22] text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
                }`}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-[9px] uppercase tracking-wider ${muted}`}>{t('onionNext')}</span>
              <input
                type="number"
                min={1}
                max={5}
                value={onionNext}
                onChange={(e) => onSetOnionNext(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                className={`w-9 px-1 py-0.5 rounded border text-[10px] font-mono text-center ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f22] text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
                }`}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-[9px] uppercase tracking-wider ${muted}`}>{t('onionOpacity')}</span>
              <input
                type="number"
                min={5}
                max={80}
                value={Math.round(onionOpacity * 100)}
                onChange={(e) => onSetOnionOpacity(Math.max(5, Math.min(80, Number(e.target.value) || 30)) / 100)}
                className={`w-11 px-1 py-0.5 rounded border text-[10px] font-mono text-center ${
                  isDark ? 'bg-[#0a0a0b] border-[#1f1f22] text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
                }`}
              />
              <span className={`text-[9px] ${muted}`}>%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}