import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  border: string;
  muted: string;
  pencilSize: number;
  isShapeFilled: boolean;
  activeTool: string;
  setPencilSize: (n: number) => void;
  setIsShapeFilled: (v: boolean) => void;
  t: (k: TKey) => string;
}

export default function ShapePopover({
  isDark, border, muted, pencilSize, isShapeFilled, activeTool,
  setPencilSize, setIsShapeFilled, t,
}: Props) {
  const canFill =
    activeTool === 'rectangle' ||
    activeTool === 'circle' ||
    activeTool === 'triangle' ||
    activeTool === 'star';

  return (
    <div className={`absolute top-full left-0 mt-1.5 ${isDark ? 'bg-[#0f0f10]' : 'bg-white'} border ${border} rounded-xl p-3 shadow-2xl w-52 z-50`}>
      <div className={`flex justify-between text-[11px] mb-2 ${muted}`}>
        <span>{t('size')}</span>
        <span className="font-mono tabular-nums">{pencilSize}px</span>
      </div>
      <input
        type="range"
        min={1}
        max={120}
        value={pencilSize}
        onChange={(e) => setPencilSize(Number(e.target.value))}
        className="slider-custom"
      />
      {canFill && (
        <button
          onClick={() => setIsShapeFilled(!isShapeFilled)}
          className={`mt-3 w-full px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
            isShapeFilled
              ? 'bg-blue-600 text-white'
              : (isDark ? 'bg-[#18181b] text-zinc-300' : 'bg-zinc-100 text-zinc-700')
          }`}
        >
          {isShapeFilled ? t('filled') : t('outline')}
        </button>
      )}
    </div>
  );
}