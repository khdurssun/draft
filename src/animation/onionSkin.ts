import type { LayerMeta } from '../lib/types';
import type { OnionSkinSettings } from './types';

interface DrawParams {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  currentFrame: number;
  frameOrder: string[];
  layers: LayerMeta[];
  getFrameCanvas: (layerId: string, frameId: string) => HTMLCanvasElement | null;
  settings: OnionSkinSettings;
}

export function drawOnionSkin({
  ctx, w, h, currentFrame, frameOrder, layers, getFrameCanvas, settings,
}: DrawParams) {
  if (!settings.enabled) return;
  const total = frameOrder.length;
  if (total <= 1) return;

  const drawAt = (
    idx: number,
    alpha: number,
    tint: 'none' | 'gray' | 'blue',
  ) => {
    if (idx < 0 || idx >= total) return;
    const fid = frameOrder[idx];
    const temp = document.createElement('canvas');
    temp.width = w;
    temp.height = h;
    const tctx = temp.getContext('2d');
    if (!tctx) return;

    for (const layer of layers) {
      if (!layer.visible) continue;
      const c = getFrameCanvas(layer.id, fid);
      if (!c) continue;
      tctx.drawImage(c, 0, 0);
    }

    if (tint !== 'none') {
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = tint === 'gray' ? '#808080' : '#4488ff';
      tctx.fillRect(0, 0, w, h);
      tctx.globalCompositeOperation = 'source-over';
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
  };

  // Предыдущие кадры — серые фантомы
  for (let i = settings.prev; i >= 1; i--) {
    const alpha = settings.opacity * (1 - (i - 1) / (settings.prev + 1));
    drawAt(currentFrame - i, alpha, 'gray');
  }
  // Следующие кадры — синие фантомы
  for (let i = settings.next; i >= 1; i--) {
    const alpha = settings.opacity * (1 - (i - 1) / (settings.next + 1));
    drawAt(currentFrame + i, alpha, 'blue');
  }
}