import type { ShapeAction } from './types';

export function drawShapeToCtx(ctx: CanvasRenderingContext2D, a: ShapeAction) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let dx = a.end.x - a.start.x;
  let dy = a.end.y - a.start.y;
  if (a.shiftKey && (a.tool === 'rectangle' || a.tool === 'circle' || a.tool === 'triangle')) {
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    dx = dx >= 0 ? m : -m;
    dy = dy >= 0 ? m : -m;
  }
  if (a.tool === 'line') {
    ctx.moveTo(a.start.x, a.start.y);
    ctx.lineTo(a.start.x + dx, a.start.y + dy);
    ctx.stroke();
  } else if (a.tool === 'rectangle') {
    const x = dx < 0 ? a.start.x + dx : a.start.x;
    const y = dy < 0 ? a.start.y + dy : a.start.y;
    const w = Math.abs(dx), h = Math.abs(dy);
    if (a.isFilled) ctx.fillRect(x, y, w, h); else ctx.strokeRect(x, y, w, h);
  } else if (a.tool === 'circle') {
    const rx = Math.abs(dx)/2, ry = Math.abs(dy)/2;
    const cx = a.start.x + dx/2, cy = a.start.y + dy/2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI*2);
    if (a.isFilled) ctx.fill(); else ctx.stroke();
  } else if (a.tool === 'triangle') {
    const x = dx < 0 ? a.start.x + dx : a.start.x;
    const y = dy < 0 ? a.start.y + dy : a.start.y;
    const w = Math.abs(dx), h = Math.abs(dy);
    ctx.beginPath();
    ctx.moveTo(x + w/2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    if (a.isFilled) ctx.fill(); else ctx.stroke();
  }
}