import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  border: string;
  muted: string;
  fillOpacity: number;
  setFillOpacity: (n: number) => void;
  t: (k: TKey) => string;
}

export default function BucketPopover({
  isDark, border, muted, fillOpacity, setFillOpacity, t,
}: Props) {
  return (
    <div className={`absolute left-[68px] top-0 ${isDark ? 'bg-[#0f0f10]' : 'bg-white'} border ${border} rounded-xl p-3 shadow-2xl w-52 z-50`}>
      <div className={`flex justify-between text-[11px] mb-2 ${muted}`}>
        <span>{t('opacity')}</span>
        <span className="font-mono tabular-nums">{Math.round(fillOpacity * 100)}%</span>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        value={Math.round(fillOpacity * 100)}
        onChange={(e) => setFillOpacity(Number(e.target.value) / 100)}
        className="slider-custom"
      />
    </div>
  );
}