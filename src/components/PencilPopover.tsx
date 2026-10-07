import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BRUSHES, type BrushGroup } from '../lib/constants';
import type { BrushType } from '../lib/types';
import { drawStrokeToCtx } from '../lib/brushes';
import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  border: string;
  muted: string;
  size: number;
  brushType: BrushType;
  tab: 'size' | 'brush';
  opacity: number;
  setSize: (n: number) => void;
  setBrushType: (b: BrushType) => void;
  setTab: (t: 'size' | 'brush') => void;
  setOpacity: (n: number) => void;
  onHidePreview: () => void;
  t: (k: TKey) => string;
}

const GROUPS: { key: BrushGroup; label: string }[] = [
  { key: 'basic',    label: 'Basic' },
  { key: 'soft',     label: 'Soft' },
  { key: 'textured', label: 'Textured' },
  { key: 'special',  label: 'Special' },
  { key: 'grand',    label: 'Grand' },
];

/** Маленький canvas-превью кисти: рисует короткий мазок синусоидой. */
function BrushPreview({ brush, isDark }: { brush: BrushType; isDark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    const W = c.width;
    const H = c.height;
    const pad = 6;
    const color = isDark ? '#d4d4d8' : '#3f3f46';

    // Синусоида из 6 точек — короткий «мазок».
    const points = [
      { x: pad,        y: H / 2 },
      { x: W * 0.22,   y: H / 2 - 3 },
      { x: W * 0.42,   y: H / 2 + 3 },
      { x: W * 0.62,   y: H / 2 - 2 },
      { x: W * 0.82,   y: H / 2 + 2 },
      { x: W - pad,    y: H / 2 },
    ];
    const pressures = [0.7, 0.75, 0.8, 0.75, 0.7, 0.7];

    try {
      drawStrokeToCtx(ctx, {
        type: 'stroke',
        tool: 'pencil',
        brush,
        points,
        pressures,
        color,
        size: 9,
      }, false);
    } catch {}
  }, [brush, isDark]);

  return (
    <canvas
      ref={ref}
      width={96}
      height={24}
      className="block rounded"
      style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
    />
  );
}

export default function PencilPopover({
  isDark, border, muted, size, brushType, tab, opacity,
  setSize, setBrushType, setTab, setOpacity, onHidePreview, t,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>('basic');

  return (
    <div className="absolute left-[68px] top-0 z-50 flex items-start gap-1.5">
      <div className={`${isDark ? 'bg-[#0f0f10]' : 'bg-white'} border ${border} rounded-xl p-2 shadow-2xl w-52`}>
        <div className="flex items-center gap-0.5 mb-2.5 px-0.5">
          <button
            onClick={() => setTab('size')}
            className={`flex-1 px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-medium transition-colors ${
              tab === 'size' ? (isDark ? 'bg-[#18181b] text-zinc-100' : 'bg-zinc-100 text-zinc-900') : muted
            }`}
          >
            {t('size')}
          </button>
          <button
            onClick={() => setTab('brush')}
            className={`flex-1 px-2 py-1 rounded-md text-[10px] uppercase tracking-wider font-medium transition-colors ${
              tab === 'brush' ? (isDark ? 'bg-[#18181b] text-zinc-100' : 'bg-zinc-100 text-zinc-900') : muted
            }`}
          >
            {t('brushes')}
          </button>
        </div>

        {tab === 'size' && (
          <>
            <div className={`flex justify-between text-[11px] mb-2 ${muted}`}>
              <span>{t('size')}</span>
              <span className="font-mono tabular-nums">{size}px</span>
            </div>
            <input
              type="range"
              min={1}
              max={120}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              onPointerUp={onHidePreview}
              onPointerCancel={onHidePreview}
              className="slider-custom"
            />

            <div className={`flex justify-between text-[11px] mt-3 mb-2 ${muted}`}>
              <span>{t('opacity')}</span>
              <span className="font-mono tabular-nums">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="slider-custom"
            />
          </>
        )}

        {tab === 'brush' && (
          <div className="text-[11px] opacity-60 px-0.5">→</div>
        )}
      </div>

      {tab === 'brush' && (
        <div className={`${isDark ? 'bg-[#0f0f10]' : 'bg-white'} border ${border} rounded-xl shadow-2xl w-[250px] max-h-[420px] overflow-y-auto scroll-thin`}>
          {GROUPS.map(g => (
            <div key={g.key} className={`border-b last:border-b-0 ${isDark ? 'border-[#1f1f22]' : 'border-zinc-100'}`}>
              <button
                onClick={() => setExpanded(expanded === g.key ? null : g.key)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-medium ${muted}`}
              >
                <span>{g.label}</span>
                <ChevronRight
                  className={`w-3 h-3 transition-transform ${expanded === g.key ? 'rotate-90' : ''}`}
                  strokeWidth={2}
                />
              </button>
              {expanded === g.key && (
                <div className="pb-1">
                  {BRUSHES.filter(b => b.group === g.key).map(({ id, labelKey, Icon }) => {
                    const active = brushType === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setBrushType(id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-[11px] transition-colors ${
                          active
                            ? (isDark ? 'bg-[#18181b] text-white' : 'bg-zinc-100 text-zinc-900')
                            : (isDark ? 'text-zinc-400 hover:bg-[#18181b]/60 hover:text-zinc-200' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800')
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
                        <span className="truncate w-20">{t(labelKey as TKey)}</span>
                        <BrushPreview brush={id} isDark={isDark} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}