import { useState } from 'react';
import { Plus, Trash2, Layers } from 'lucide-react';
import type { LayerMeta } from '../lib/types';
import type { TKey } from '../i18n/translations';
import LayerRow from './LayerRow';

interface Props {
  isDark: boolean;
  panel: string;
  border: string;
  hover: string;
  muted: string;
  btnBase: string;
  layers: LayerMeta[];
  activeLayerId: string;
  thumbsVersion: number;
  layerCanvases: Map<string, HTMLCanvasElement>;
  canvasSize: { w: number; h: number };
  t: (k: TKey) => string;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: () => void;
  onMoveLayerTo: (dragId: string, targetId: string, position: 'above' | 'below') => void;
}

export default function LayersPanel({
  isDark, panel, border, hover, muted, btnBase,
  layers, activeLayerId, thumbsVersion, layerCanvases, canvasSize, t,
  onSelect, onToggleVisible, onToggleLock, onAddLayer, onDeleteLayer, onMoveLayerTo,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const reversed = [...layers].reverse();

  return (
    <aside className="absolute top-11 right-2.5 z-30 w-56 select-none">
      <div className={`${panel} border ${border} rounded-md shadow-md overflow-hidden flex flex-col`}>
        {/* Шапка панели */}
        <div className={`flex items-center justify-between px-2.5 py-1.5 border-b ${border}`}>
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 opacity-50" strokeWidth={1.5} />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              {t('layers')}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={onAddLayer}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${btnBase}`}
              title="Add Layer"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={onDeleteLayer}
              disabled={layers.length <= 1}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-20 ${btnBase} hover:!text-red-400`}
              title="Delete Layer"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Список слоёв */}
        <div className="max-h-[50vh] overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
          {reversed.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              isActive={layer.id === activeLayerId}
              isDragOver={dragOverId === layer.id}
              thumbsVersion={thumbsVersion}
              layerCanvases={layerCanvases}
              canvasSize={canvasSize}
              isDark={isDark}
              muted={muted}
              hover={hover}
              t={t}
              onSelect={() => onSelect(layer.id)}
              onToggleVisible={() => onToggleVisible(layer.id)}
              onToggleLock={() => onToggleLock(layer.id)}
              onDragStart={() => setDragId(layer.id)}
              onDragOver={() => setDragOverId(layer.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              onDrop={(position) => {
                if (dragId && dragId !== layer.id) onMoveLayerTo(dragId, layer.id, position);
                setDragId(null);
                setDragOverId(null);
              }}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}