import {
  ChevronRight,
  Layers as LayersIcon,
  Settings as SettingsIcon,
  Play as PlayIcon,
  ImagePlus,
} from 'lucide-react';
import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  activeMenu: 'file' | 'render' | null;
  showLayers?: boolean;
  panel: string;
  border: string;
  textSoft: string;
  hover: string;
  btnBase: string;
  t: (k: TKey) => string;

  /* Hover-подменю для Render */
  renderImageOpen: boolean;
  renderAnimOpen: boolean;

  /* Доступность форматов */
  mp4Supported: boolean;

  /* Actions */
  onToggleMenu: (menu: 'file' | 'render' | null) => void;
  onToggleLayers: () => void;
  onOpenSettings: () => void;
  onOpenNewProject: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onOpenImageLayer: () => void;
  onRenderImage: (fmt: 'png' | 'jpeg') => void;
  onRenderAnimation: (fmt: 'webm' | 'mp4' | 'gif') => void;
  onSetRenderImageOpen: (v: boolean) => void;
  onSetRenderAnimOpen: (v: boolean) => void;
}

export default function TopBar({
  isDark,
  activeMenu,
  showLayers = false,
  panel,
  border,
  textSoft,
  hover,
  btnBase,
  t,
  renderImageOpen,
  renderAnimOpen,
  mp4Supported,
  onToggleMenu,
  onToggleLayers,
  onOpenSettings,
  onOpenNewProject,
  onSaveProject,
  onOpenProject,
  onOpenImageLayer,
  onRenderImage,
  onRenderAnimation,
  onSetRenderImageOpen,
  onSetRenderAnimOpen,
}: Props) {
  return (
    <div
      className={`h-9 ${panel} border-b ${border} flex items-center text-xs z-[80] relative shrink-0 px-2 select-none`}
      data-menu
    >
      <div className="flex items-center gap-3">
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            onToggleMenu(activeMenu === 'file' ? null : 'file');
          }}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            activeMenu === 'file'
              ? isDark
                ? 'bg-zinc-800 text-zinc-100 font-medium'
                : 'bg-zinc-200 text-zinc-900 font-medium'
              : `${textSoft}${hover}`
          }`}
        >
          {t('file')}
        </button>

        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            onToggleMenu(activeMenu === 'render' ? null : 'render');
          }}
          className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
            activeMenu === 'render'
              ? isDark
                ? 'bg-zinc-800 text-zinc-100 font-medium'
                : 'bg-zinc-200 text-zinc-900 font-medium'
              : `${textSoft}${hover}`
          }`}
        >
          <PlayIcon className="w-3 h-3" strokeWidth={2} />
          {t('render')}
        </button>

        <span className="text-[11px] font-mono opacity-40 select-none">
          v0.7.2-alpha
        </span>
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <button
          onClick={onOpenImageLayer}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${btnBase}`}
          title="Import image"
        >
          <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        <button
          onClick={onToggleLayers}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
            showLayers
              ? isDark
                ? 'bg-zinc-800 text-zinc-100'
                : 'bg-zinc-200 text-zinc-900'
              : btnBase
          }`}
          title="Layers"
        >
          <LayersIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>

        <button
          onClick={onOpenSettings}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${btnBase}`}
          title="Settings"
        >
          <SettingsIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* ─── File menu ─── */}
      {activeMenu === 'file' && (
        <div
          className={`absolute top-full left-2 ${panel} border ${border} rounded-md shadow-lg py-1 z-[90] mt-1 w-52`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MenuItem label={t('newProject')} onClick={onOpenNewProject} isDark={isDark} />
          <MenuItem label={t('saveProject')} onClick={onSaveProject} isDark={isDark} />
          <MenuItem label={t('openProject')} onClick={onOpenProject} isDark={isDark} />
        </div>
      )}

      {/* ─── Render menu ─── */}
      {activeMenu === 'render' && (
        <div
          className={`absolute top-full left-20 ${panel} border ${border} rounded-md shadow-lg py-1 z-[90] mt-1 w-48`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerLeave={() => {
            onSetRenderImageOpen(false);
            onSetRenderAnimOpen(false);
          }}
        >
          {/* Image ▸ */}
          <div
            className="relative"
            onPointerEnter={() => {
              onSetRenderImageOpen(true);
              onSetRenderAnimOpen(false);
            }}
          >
            <MenuItem
              label={t('image')}
              right={<ChevronRight className="w-3 h-3 opacity-50" />}
              isDark={isDark}
            />
            {renderImageOpen && (
              <div
                className={`absolute left-full top-0 ${panel} border ${border} rounded-md shadow-lg py-1 w-40 -ml-1`}
                onPointerEnter={() => onSetRenderImageOpen(true)}
              >
                <MenuItem label="PNG" onClick={() => onRenderImage('png')} isDark={isDark} />
                <MenuItem label="JPEG" onClick={() => onRenderImage('jpeg')} isDark={isDark} />
              </div>
            )}
          </div>

          {/* Animation ▸ */}
          <div
            className="relative"
            onPointerEnter={() => {
              onSetRenderAnimOpen(true);
              onSetRenderImageOpen(false);
            }}
          >
            <MenuItem
              label={t('animation')}
              right={<ChevronRight className="w-3 h-3 opacity-50" />}
              isDark={isDark}
            />
            {renderAnimOpen && (
              <div
                className={`absolute left-full top-0 ${panel} border ${border} rounded-md shadow-lg py-1 w-40 -ml-1`}
                onPointerEnter={() => onSetRenderAnimOpen(true)}
              >
                <MenuItem label={t('webm')} onClick={() => onRenderAnimation('webm')} isDark={isDark} />
                {mp4Supported && (
                  <MenuItem label={t('mp4')} onClick={() => onRenderAnimation('mp4')} isDark={isDark} />
                )}
                <MenuItem label={t('gif')} onClick={() => onRenderAnimation('gif')} isDark={isDark} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  right,
  isDark,
}: {
  label: string;
  onClick?: () => void;
  right?: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
        isDark
          ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
          : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      <span className="truncate">{label}</span>
      {right}
    </button>
  );
}