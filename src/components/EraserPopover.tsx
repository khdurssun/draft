import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  border: string;
  muted: string;
  eraserSize: number;
  setEraserSize: (n: number) => void;
  onPreview: (size: number) => void;
  onHidePreview: () => void;
  t: (k: TKey) => string;
}

export default function EraserPopover({
  isDark, border, muted, eraserSize, setEraserSize, onPreview, onHidePreview, t,
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
    </div>
  );
}