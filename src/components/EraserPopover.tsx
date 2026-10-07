import { Circle, Square } from 'lucide-react';
import type { EraserShape } from '../lib/types';
import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  border: string;
  muted: string;
  eraserSize: number;
  eraserShape: EraserShape;
  setEraserSize: (n: number) => void;
  setEraserShape: (s: EraserShape) => void;
  onPreview: (size: number) => void;
  onHidePreview: () => void;
  t: (k: TKey) => string;
}

export default function EraserPopover({
  isDark, border, muted, eraserSize, eraserShape,
  setEraserSize, setEraserShape, onPreview, onHidePreview, t,
}: Props) {
  return (
    <div className={`absolute left-[68px] top-0 ${isDark ? 'bg-[#0f0f10]' : 'bg-white'} border ${border} rounded-xl p-3 shadow-2xl w-52 z-50`}>
      <div className={`flex justify-between text-[11px] mb-2 ${muted}`}>
        <span>{t('size')}</span>
        <span className="font-mono tabular-nums">{eraserSize}px</span>
      </div>
      <input
        type="range"
        min={4}
        max={120}
        value={eraserSize}
        onChange={(e) => {
          const v = Number(e.target.value);
          setEraserSize(v);
          onPreview(v);
        }}
        onPointerUp={onHidePreview}
        onPointerCancel={onHidePreview}
        className="slider-custom"
      />

      <div className={`flex justify-between text-[11px] mt-3 mb-2 ${muted}`}>
        <span>{t('eraserShape')}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEraserShape('round')}
          className={`flex-1 h-8 rounded-md flex items-center justify-center gap-1.5 text-[11px] transition-colors ${
            eraserShape === 'round'
              ? 'bg-blue-600 text-white'
              : (isDark ? 'bg-[#18181b] text-zinc-300 hover:bg-[#1f1f22]' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200')
          }`}
        >
          <Circle className="w-3.5 h-3.5" strokeWidth={1.8} />
          {t('eraserRound')}
        </button>
        <button
          onClick={() => setEraserShape('square')}
          className={`flex-1 h-8 rounded-md flex items-center justify-center gap-1.5 text-[11px] transition-colors ${
            eraserShape === 'square'
              ? 'bg-blue-600 text-white'
              : (isDark ? 'bg-[#18181b] text-zinc-300 hover:bg-[#1f1f22]' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200')
          }`}
        >
          <Square className="w-3.5 h-3.5" strokeWidth={1.8} />
          {t('eraserSquare')}
        </button>
      </div>
    </div>
  );
}