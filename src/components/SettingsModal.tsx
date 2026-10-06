import { X } from 'lucide-react';
import type { TKey } from '../i18n/translations';
import type { Theme, Lang } from '../lib/types';

interface Props {
  isDark: boolean;
  panel: string;
  border: string;
  muted: string;
  textMain: string;
  btnBase: string;
  theme: Theme;
  lang: Lang;
  canvasBg: string;
  viewportBg: string;
  resolvedViewportBg: string;
  t: (k: TKey) => string;
  onClose: () => void;
  setTheme: (v: Theme) => void;
  setLang: (v: Lang) => void;
  setCanvasBg: (v: string) => void;
  setViewportBg: (v: string) => void;
}

export default function SettingsModal({
  isDark, panel, border, muted, textMain, btnBase,
  theme, lang, canvasBg, viewportBg, resolvedViewportBg, t,
  onClose, setTheme, setLang, setCanvasBg, setViewportBg,
}: Props) {
  const activeBtnBg = isDark ? 'bg-zinc-800 text-zinc-100 font-medium' : 'bg-zinc-200 text-zinc-900 font-medium';

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
            {t('settings')}
          </h2>
          <button
            onClick={onClose}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${btnBase}`}
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        {/* Список настроек */}
        <div className="flex flex-col gap-5">
          <Row label={t('canvasColor')} desc={t('canvasDesc')} isDark={isDark} muted={muted}>
            <input
              type="color"
              value={canvasBg}
              onChange={(e) => setCanvasBg(e.target.value)}
              className={`w-9 h-8 rounded-md border ${border} bg-transparent cursor-pointer shrink-0`}
            />
          </Row>

          <Row label={t('viewportColor')} desc={t('viewportDesc')} isDark={isDark} muted={muted}>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setViewportBg('auto')}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  viewportBg === 'auto' ? activeBtnBg : btnBase
                }`}
              >
                {t('auto')}
              </button>
              <input
                type="color"
                value={viewportBg === 'auto' ? resolvedViewportBg : viewportBg}
                onChange={(e) => setViewportBg(e.target.value)}
                className={`w-9 h-8 rounded-md border ${border} bg-transparent cursor-pointer`}
              />
            </div>
          </Row>

          <div className={`h-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

          <Row label={t('theme')} isDark={isDark} muted={muted}>
            <div className="flex items-center gap-1 bg-zinc-500/10 p-1 rounded-md">
              <button
                onClick={() => setTheme('light')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  theme === 'light' ? activeBtnBg : btnBase
                }`}
              >
                {t('light')}
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  theme === 'dark' ? activeBtnBg : btnBase
                }`}
              >
                {t('dark')}
              </button>
            </div>
          </Row>

          <Row label={t('language')} isDark={isDark} muted={muted}>
            <div className="flex items-center gap-1 bg-zinc-500/10 p-1 rounded-md">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  lang === 'en' ? activeBtnBg : btnBase
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('ru')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  lang === 'ru' ? activeBtnBg : btnBase
                }`}
              >
                RU
              </button>
            </div>
          </Row>
        </div>
      </div>
    </div>
  );
}

function Row({ label, desc, children, isDark, muted }: {
  label: string; desc?: string; children: React.ReactNode; isDark: boolean; muted: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col min-w-0">
        <span className={`text-xs font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
          {label}
        </span>
        {desc && <span className={`text-[11px] ${muted} leading-relaxed`}>{desc}</span>}
      </div>
      {children}
    </div>
  );
}