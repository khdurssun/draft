import { useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock, Unlock, GripVertical } from 'lucide-react';
import type { LayerMeta } from '../lib/types';
import type { TKey } from '../i18n/translations';

interface Props {
  layer: LayerMeta;
  isActive: boolean;
  isDragOver: boolean;
  thumbsVersion: number;
  layerCanvases: Map<string, HTMLCanvasElement>;
  canvasSize: { w: number; h: number };
  isDark: boolean;
  muted: string;
  hover: string;
  t: (k: TKey) => string;
  onSelect: () => void;
  onToggleVisible: () => void;
  onToggleLock: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onDrop: (position: 'above' | 'below') => void;
}

export default function LayerRow({
  layer, isActive, isDragOver, thumbsVersion, layerCanvases, canvasSize,
  isDark, muted, hover,
  onSelect, onToggleVisible, onToggleLock, onDragStart, onDragOver, onDragEnd, onDrop,
}: Props) {
  const thumbRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const src = layerCanvases.get(layer.id);
    const ctx = thumb.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, thumb.width, thumb.height);
    const cell = 4;
    for (let y = 0; y < thumb.height; y += cell) {
      for (let x = 0; x < thumb.width; x += cell) {
        ctx.fillStyle = ((x / cell + y / cell) % 2 === 0)
          ? (isDark ? '#1a1a1c' : '#eaeaec')
          : (isDark ? '#232326' : '#f7f7f8');
        ctx.fillRect(x, y, cell, cell);
      }
    }
    if (src) {
      const { w, h } = canvasSize;
      const scale = Math.min(thumb.width / w, thumb.height / h);
      const dw = w * scale, dh = h * scale;
      ctx.drawImage(src, (thumb.width - dw) / 2, (thumb.height - dh) / 2, dw, dh);
    }
  }, [layer.id, thumbsVersion, isDark, layerCanvases, canvasSize]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', layer.id);
        onDragStart();
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(); }}
      onDrop={(e) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        onDrop(y < rect.height / 2 ? 'above' : 'below');
      }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group flex items-center gap-1.5 mx-1.5 my-0.5 px-1.5 py-1 rounded-md cursor-pointer transition-colors relative ${
        isActive
          ? (isDark ? 'bg-[#18181b] text-white' : 'bg-zinc-100 text-zinc-900')
          : hover
      } ${isDragOver ? 'ring-1 ring-blue-500/60' : ''}`}
    >
      <GripVertical className={`w-3 h-3 shrink-0 opacity-40 group-hover:opacity-70 cursor-grab ${muted}`} strokeWidth={2} />
      <canvas
        ref={thumbRef}
        width={32}
        height={32}
        className={`rounded shrink-0 border ${isDark ? 'border-[#27272a]' : 'border-zinc-200'}`}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${
          isActive ? 'text-zinc-300' : muted
        } hover:!text-blue-400`}
      >
        {layer.visible ? <Eye className="w-3 h-3" strokeWidth={1.8}/> : <EyeOff className="w-3 h-3" strokeWidth={1.8}/>}
      </button>
      <span className={`flex-1 text-[11px] truncate ${layer.locked ? 'opacity-50' : ''}`}>
        {layer.name}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all ${
          layer.locked ? 'text-amber-400' : `opacity-0 group-hover:opacity-100 ${muted}`
        }`}
      >
        {layer.locked ? <Lock className="w-2.5 h-2.5" strokeWidth={2.2}/> : <Unlock className="w-2.5 h-2.5" strokeWidth={2.2}/>}
      </button>
    </div>
  );
}