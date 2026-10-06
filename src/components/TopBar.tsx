import {
  ChevronRight,
  Layers as LayersIcon,
  Settings as SettingsIcon,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { TKey } from '../i18n/translations';

interface Props {
  isDark: boolean;
  isFullscreen: boolean;
  activeMenu: 'file' | null;
  exportOpen: boolean;
  showLayers?: boolean;
  panel: string;
  border: string;
  textSoft: string;
  hover: string;
  btnBase: string;
  t: (k: TKey) => string;
  onToggleMenu: () => void;
  onToggleFullscreen: () => void;
  onToggleLayers: () => void;
  onOpenSettings: () => void;
  onOpenNewProject: () => void;
  onOpenImage: () => void;
  onSetExportOpen: (v: boolean) => void;
  onExport: (fmt: 'png' | 'jpeg', onlyActive?: boolean) => void;
}

export default function TopBar({
  isDark,
  isFullscreen,
  activeMenu,
  exportOpen,
  showLayers = false,
  panel,
  border,
  textSoft,
  hover,
  btnBase,
  t,
  onToggleMenu,
  onToggleFullscreen,
  onToggleLayers,
  onOpenSettings,
  onOpenNewProject,
  onOpenImage,
  onSetExportOpen,
  onExport,
}: Props) {
  return (
    <div
      className={`h-9 ${panel} border-b ${border} flex items-center text-xs z-[80] relative shrink-0 px-2 select-none`}
      data-menu
    >
      {/* Меню Файл + Версия */}
      <div className="flex items-center gap-3">
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            onToggleMenu();
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

        <span className="text-[11px] font-mono opacity-40 select-none">
          v0.5.1-alpha
        </span>
      </div>

      {/* Кнопки управления справа */}
      <div className="ml-auto flex items-center gap-0.5">
        <button
          onClick={onToggleFullscreen}
          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${btnBase}`}
          title={isFullscreen ? 'Minimize' : 'Maximize'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
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

      {/* Выпадающее меню "Файл" */}
      {activeMenu === 'file' && (
        <div
          className={`absolute top-full left-2 ${panel} border ${border} rounded-md shadow-lg py-1 z-[90] mt-1 w-48`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MenuItem
            label={t('newProject')}
            onClick={onOpenNewProject}
            isDark={isDark}
          />

          <MenuItem
            label={t('openImage')}
            onClick={onOpenImage}
            isDark={isDark}
          />

          <div
            className={`h-px my-1 ${
              isDark ? 'bg-zinc-800' : 'bg-zinc-200'
            }`}
          />

          <div
            className="relative"
            onPointerEnter={() => onSetExportOpen(true)}
            onPointerLeave={() => onSetExportOpen(false)}
          >
            <MenuItem
              label={t('export')}
              right={
                <ChevronRight className="w-3 h-3 opacity-50" />
              }
              isDark={isDark}
            />

            {exportOpen && (
              <div
                className={`absolute left-full top-0 ${panel} border ${border} rounded-md shadow-lg py-1 w-44 -ml-1`}
                onPointerEnter={() => onSetExportOpen(true)}
              >
                <MenuItem
                  label="PNG"
                  onClick={() => onExport('png')}
                  isDark={isDark}
                />

                <MenuItem
                  label="JPEG"
                  onClick={() => onExport('jpeg')}
                  isDark={isDark}
                />

                <div
                  className={`h-px my-1 ${
                    isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                  }`}
                />

                <MenuItem
                  label={`${t('exportLayer')} (PNG)`}
                  onClick={() => onExport('png', true)}
                  isDark={isDark}
                />
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