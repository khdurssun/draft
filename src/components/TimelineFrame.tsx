import { useEffect, useRef } from 'react';

interface Props {
  layerId: string;
  frameId: string;
  index: number;
  isActive: boolean;
  isCurrentLayer: boolean;
  getFrameCanvas: (layerId: string, frameId: string) => HTMLCanvasElement | null;
  canvasSize: { w: number; h: number };
  isDark: boolean;
  onClick: () => void;
  version: number;
}

export default function TimelineFrame({
  layerId, frameId, index, isActive, isCurrentLayer,
  getFrameCanvas, canvasSize, isDark, onClick, version,
}: Props) {
  const thumbRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const ctx = thumb.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, thumb.width, thumb.height);
    // шахматный фон
    const cell = 3;
    for (let y = 0; y < thumb.height; y += cell) {
      for (let x = 0; x < thumb.width; x += cell) {
        ctx.fillStyle = ((x / cell + y / cell) % 2 === 0)
          ? (isDark ? '#1a1a1c' : '#eaeaec')
          : (isDark ? '#232326' : '#f7f7f8');
        ctx.fillRect(x, y, cell, cell);
      }
    }
    const src = getFrameCanvas(layerId, frameId);
    if (src) {
      const { w, h } = canvasSize;
      const scale = Math.min(thumb.width / w, thumb.height / h);
      const dw = w * scale, dh = h * scale;
      ctx.drawImage(src, (thumb.width - dw) / 2, (thumb.height - dh) / 2, dw, dh);
    }
  }, [layerId, frameId, version, isDark, canvasSize, getFrameCanvas]);

  const activeRing = isActive ? 'ring-2 ring-blue-500' : '';
  const currentLayerMark = isCurrentLayer ? 'opacity-100' : 'opacity-50';

    return (
    <button
      onClick={onClick}
      className={`relative shrink-0 w-16 h-16 rounded border transition-all ${activeRing} ${currentLayerMark} ${
        isDark ? 'border-[#27272a] hover:border-zinc-500' : 'border-zinc-200 hover:border-zinc-400'
      }`}
      title={`#${index + 1}`}
    >
      <canvas
        ref={thumbRef}
        width={64}
        height={64}
        className="w-full h-full rounded"
      />
    </button>
  );
}