import type { ShapeAction, Point, FreehandStroke } from './types';
import { drawStrokeToCtx } from './brushes';

/** Строит массив точек контура фигуры — для обводки текущей кистью. */
function buildOutline(a: ShapeAction): Point[] {
  const shift = a.shiftKey && (a.tool === 'rectangle' || a.tool === 'circle' || a.tool === 'triangle' || a.tool === 'star');
  let dx = a.end.x - a.start.x;
  let dy = a.end.y - a.start.y;
  if (shift) {
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    dx = dx >= 0 ? m : -m;
    dy = dy >= 0 ? m : -m;
  }
  const x0 = a.start.x;
  const y0 = a.start.y;
  const x1 = x0 + dx;
  const y1 = y0 + dy;

  if (a.tool === 'line') {
    return [ { x: x0, y: y0 }, { x: x1, y: y1 } ];
  }

  if (a.tool === 'rectangle') {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y0 },
    ];
  }

  if (a.tool === 'circle') {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.max(1, Math.abs(dx) / 2);
    const ry = Math.max(1, Math.abs(dy) / 2);
    const N = 64;
    const pts: Point[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
    }
    return pts;
  }

  if (a.tool === 'triangle') {
    const xL = Math.min(x0, x1);
    const yT = Math.min(y0, y1);
    const w = Math.abs(dx);
    const h = Math.abs(dy);
    const cxm = xL + w / 2;
    return [
      { x: cxm, y: yT },
      { x: xL + w, y: yT + h },
      { x: xL, y: yT + h },
      { x: cxm, y: yT },
    ];
  }

  if (a.tool === 'star') {
    const xL = Math.min(x0, x1);
    const yT = Math.min(y0, y1);
    const w = Math.abs(dx);
    const h = Math.abs(dy);
    const cx = xL + w / 2;
    const cy = yT + h / 2;
    const outerRx = w / 2;
    const outerRy = h / 2;
    const innerRx = outerRx * 0.42;
    const innerRy = outerRy * 0.42;
    const spikes = 5;
    const pts: Point[] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const isOuter = i % 2 === 0;
      const rxi = isOuter ? outerRx : innerRx;
      const ryi = isOuter ? outerRy : innerRy;
      const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
      pts.push({ x: cx + Math.cos(angle) * rxi, y: cy + Math.sin(angle) * ryi });
    }
    pts.push(pts[0]);
    return pts;
  }

  return [];
}

export function drawShapeToCtx(ctx: CanvasRenderingContext2D, a: ShapeAction) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;

  // ── FILLED: как раньше — просто заливка цветом (кисть для заливки не применима)
  if (a.isFilled && a.tool !== 'line') {
    ctx.strokeStyle = a.color;
    ctx.fillStyle = a.color;
    let dx = a.end.x - a.start.x;
    let dy = a.end.y - a.start.y;
    if (a.shiftKey && (a.tool === 'rectangle' || a.tool === 'circle' || a.tool === 'triangle' || a.tool === 'star')) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      dx = dx >= 0 ? m : -m;
      dy = dy >= 0 ? m : -m;
    }
    const x0 = a.start.x;
    const y0 = a.start.y;
    const x1 = x0 + dx;
    const y1 = y0 + dy;

    if (a.tool === 'rectangle') {
      const x = Math.min(x0, x1);
      const y = Math.min(y0, y1);
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      ctx.fillRect(x, y, w, h);
      return;
    }
    if (a.tool === 'circle') {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const rx = Math.max(1, Math.abs(dx) / 2);
      const ry = Math.max(1, Math.abs(dy) / 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (a.tool === 'triangle' || a.tool === 'star') {
      const pts = buildOutline({ ...a, isFilled: false });
      if (pts.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
      return;
    }
    return;
  }

  // ── OUTLINE: обводка текущей кистью через drawStrokeToCtx
  const pts = buildOutline(a);
  if (pts.length < 2) return;

  const brush = a.brush ?? 'round';
  const stroke: FreehandStroke = {
    type: 'stroke',
    tool: 'pencil',
    brush,
    points: pts,
    pressures: undefined,
    color: a.color,
    size: a.size,
  };
  drawStrokeToCtx(ctx, stroke, false);
}