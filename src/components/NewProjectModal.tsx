import { useState } from 'react';
import { X } from 'lucide-react';
import { PRESETS } from '../lib/constants';
import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  panel: string;
  border: string;
  muted: string;
  inputBg: string;
  textMain: string;
  btnBase: string;
  t: (k: TKey) => string;
  onClose: () => void;
  onConfirm: (w: number, h: number) => void;
}

export default function NewProjectModal({
  isDark, panel, border, muted, inputBg, textMain, btnBase, t,
  onClose, onConfirm,
}: Props) {
  const [selected, setSelected] = useState<string>('A4');
  const [w, setW] = useState(794);
  const [h, setH] = useState(1123);

  const activePresetBg = isDark
    ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
    : 'bg-zinc-200 border-zinc-300 text-zinc-900';

  const inactivePresetBg = isDark
    ? 'border-transparent hover:bg-zinc-800/50'
    : 'border-transparent hover:bg-zinc-100';

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <div
        className={`${panel} border ${border} rounded-lg shadow-2xl w-full max-w-md p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-inherit">
          <h2 className={`text-sm font-semibold uppercase tracking-wider ${textMain}`}>
            {t('newProject')}
          </h2>
          <button
            onClick={onClose}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${btnBase}`}
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* Пресеты */}
        <div className={`text-[11px] uppercase tracking-wider ${muted} font-semibold mb-2.5`}>
          {t('presets')}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {PRESETS.map((p) => {
            const active = selected === p.name;
            return (
              <button
                key={p.name}
                onClick={() => {
                  setSelected(p.name);
                  setW(p.w);
                  setH(p.h);
                }}
                className={`flex flex-col items-start p-3 rounded-md border transition-all text-left ${
                  active ? activePresetBg : inactivePresetBg
                }`}
              >
                <span className={`text-xs font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                  {p.name}
                </span>
                <span className={`text-[11px] font-mono ${muted} mt-1`}>
                  {p.w}×{p.h}
                </span>
              </button>
            );
          })}
        </div>

        {/* Пользовательский размер */}
        <div className={`text-[11px] uppercase tracking-wider ${muted} font-semibold mb-2.5`}>
          {t('custom')}
        </div>
        <div className="flex items-center gap-3 mb-6">
          <input
            type="number"
            value={w}
            onChange={(e) => {
              setW(Math.max(1, Number(e.target.value) || 0));
              setSelected('');
            }}
            className={`flex-1 ${inputBg} border ${border} rounded-md px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-zinc-500 transition-colors`}
          />
          <span className={`${muted} text-xs font-medium`}>×</span>
          <input
            type="number"
            value={h}
            onChange={(e) => {
              setH(Math.max(1, Number(e.target.value) || 0));
              setSelected('');
            }}
            className={`flex-1 ${inputBg} border ${border} rounded-md px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-zinc-500 transition-colors`}
          />
        </div>

        {/* Кнопки действий */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-inherit">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${btnBase}`}
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => onConfirm(w, h)}
            className="px-4 py-2 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            {t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}