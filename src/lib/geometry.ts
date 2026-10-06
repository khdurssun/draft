import type { Point } from './types';

export function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const inter = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-9) + xi);
    if (inter) inside = !inside;
  }
  return inside;
}

export function tracePolygon(ctx: CanvasRenderingContext2D, poly: Point[], offset: Point = { x: 0, y: 0 }) {
  if (poly.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(poly[0].x + offset.x, poly[0].y + offset.y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x + offset.x, poly[i].y + offset.y);
  ctx.closePath();
}

export function interpolatePoints(pts: Point[], prs: number[], step: number) {
  if (pts.length < 2) return { pts, prs };
  const outP: Point[] = [pts[0]];
  const outR: number[] = [prs[0] ?? 0.5];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i-1], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist > step) {
      const n = Math.floor(dist / step);
      const pa = prs[i-1] ?? 0.5, pb = prs[i] ?? 0.5;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        outP.push({ x: a.x + dx * t, y: a.y + dy * t });
        outR.push(pa + (pb - pa) * t);
      }
    }
    outP.push(b);
    outR.push(prs[i] ?? 0.5);
  }
  return { pts: outP, prs: outR };
}