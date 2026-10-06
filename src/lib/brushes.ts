import type { FreehandStroke, BrushType } from './types';
import { interpolatePoints } from './geometry';

const TAU = Math.PI * 2;
const rnd = (a = 1) => Math.random() * a;

function withAlpha(color: string, a: number): string {
  if (color.startsWith('#')) {
    const h = color.slice(1);
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (color.startsWith('rgb')) {
    return color.replace(/rgba?\(([^)]+)\)/, (_, p) => {
      const [r, g, b] = p.split(',').map((s: string) => s.trim());
      return `rgba(${r},${g},${b},${a})`;
    });
  }
  return color;
}

function smoothPath(pts: { x: number; y: number }[], tension = 0.5) {
  if (pts.length < 3) return pts;
  const out: { x: number; y: number }[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    for (let t = 0.1; t < 1; t += 0.1) {
      const mt = 1 - t;
      const x = mt*mt*mt*p1.x + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*p2.x;
      const y = mt*mt*mt*p1.y + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*p2.y;
      out.push({ x, y });
    }
    out.push(p2);
  }
  return out;
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, sz: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - sz);
  ctx.lineTo(x + sz * 0.3, y - sz * 0.3);
  ctx.lineTo(x + sz, y);
  ctx.lineTo(x + sz * 0.3, y + sz * 0.3);
  ctx.lineTo(x, y + sz);
  ctx.lineTo(x - sz * 0.3, y + sz * 0.3);
  ctx.lineTo(x - sz, y);
  ctx.lineTo(x - sz * 0.3, y - sz * 0.3);
  ctx.closePath();
  ctx.fill();
}

export function drawStrokeToCtx(
  ctx: CanvasRenderingContext2D,
  action: FreehandStroke,
  isEraser: boolean
) {
  let pts = action.points;
  let prs = action.pressures || [];
  const bs = action.size;
  const brush: BrushType = action.brush || 'round';

  const NO_INTERP: BrushType[] = [
    'spray', 'sparkle', 'chalk', 'charcoal', 'crayon', 'bristle',
    'oil', 'stars', 'confetti', 'bubbles', 'glitter', 'frost',
    'splatter', 'vine', 'leaves', 'mosaic', 'rings', 'web', 'flame',
    'galaxy',
  ];
  if (!NO_INTERP.includes(brush)) {
    const step = Math.max(1, bs * 0.15);
    const r = interpolatePoints(pts, prs, step);
    pts = r.pts; prs = r.prs;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 1;

  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
  }
  if (pts.length === 0) { ctx.globalCompositeOperation = 'source-over'; return; }

  const color = action.color;

  switch (brush) {

    /* ═══ BASIC ═══ */

    case 'round': {
      if (pts.length === 1) {
        const pr = prs[0] ?? 0.5;
        const w = isEraser ? bs : bs * (0.35 + pr * 0.65);
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, w/2, 0, TAU); ctx.fill();
        return;
      }
      for (let i = 1; i < pts.length; i++) {
        const pr = ((prs[i-1] ?? 0.5) + (prs[i] ?? 0.5)) / 2;
        const w = isEraser ? bs : Math.max(0.6, bs * (0.35 + pr * 0.65));
        ctx.beginPath(); ctx.lineWidth = w;
        ctx.moveTo(pts[i-1].x, pts[i-1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      return;
    }

    case 'pencil': {
      ctx.save();
      const layers = 3;
      for (let layer = 0; layer < layers; layer++) {
        const jitter = layer * 0.4;
        ctx.globalAlpha = 0.3 + layer * 0.22;
        for (let i = 1; i < pts.length; i++) {
          const pr = ((prs[i-1] ?? 0.5) + (prs[i] ?? 0.5)) / 2;
          const w = Math.max(0.35, bs * (0.12 + pr * 0.45));
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(pts[i-1].x + rnd(jitter) - jitter/2, pts[i-1].y + rnd(jitter) - jitter/2);
          ctx.lineTo(pts[i].x + rnd(jitter) - jitter/2, pts[i].y + rnd(jitter) - jitter/2);
          ctx.stroke();
        }
      }
      if (pts.length === 1) {
        const pr = prs[0] ?? 0.5;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, Math.max(0.4, bs * (0.15 + pr * 0.4)) / 2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    case 'marker': {
      ctx.save();
      ctx.lineWidth = bs;
      ctx.globalAlpha = 0.95;
      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, bs/2, 0, TAU); ctx.fill();
      } else {
        const sm = smoothPath(pts, 0.6);
        ctx.beginPath();
        ctx.moveTo(sm[0].x, sm[0].y);
        for (let i = 1; i < sm.length; i++) ctx.lineTo(sm[i].x, sm[i].y);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    case 'ink': {
      if (pts.length === 1) {
        const pr = prs[0] ?? 0.5;
        const w = bs * (0.4 + pr * 0.6);
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, w/2, 0, TAU); ctx.fill();
        return;
      }
      const sm = smoothPath(pts, 0.55);
      for (let i = 1; i < sm.length; i++) {
        const t = i / sm.length;
        const taper = Math.sin(t * Math.PI) ** 0.35;
        const pr = ((prs[i-1] ?? 0.5) + (prs[i] ?? 0.5)) / 2;
        const w = Math.max(0.5, bs * (0.35 + pr * 0.75) * taper);
        ctx.beginPath(); ctx.lineWidth = w;
        ctx.moveTo(sm[i-1].x, sm[i-1].y);
        ctx.lineTo(sm[i].x, sm[i].y);
        ctx.stroke();
      }
      return;
    }

    case 'calligraphy': {
      ctx.save();
      const baseAngle = Math.PI / 4;
      ctx.lineCap = 'butt';
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const scale = 0.5 + pr * 0.9;
        let dirX = 1, dirY = 0;
        if (i > 0) {
          const dx = pts[i].x - pts[i-1].x;
          const dy = pts[i].y - pts[i-1].y;
          const len = Math.hypot(dx, dy) || 1;
          dirX = dx / len; dirY = dy / len;
        }
        const angle = baseAngle + Math.atan2(dirY, dirX) * 0.15;
        const half = (bs / 2) * scale;
        const cx = Math.cos(angle) * half;
        const cy = Math.sin(angle) * half;
        ctx.beginPath();
        ctx.moveTo(pts[i].x - cx, pts[i].y - cy);
        ctx.lineTo(pts[i].x + cx, pts[i].y + cy);
        ctx.lineWidth = Math.max(1, bs * 0.18 * scale);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    /* ═══ SOFT ═══ */

    case 'airbrush': {
      ctx.save();
      ctx.globalAlpha = 0.06;
      const r = bs * 0.95;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const rr = r * (0.6 + pr * 0.6);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, rr);
        g.addColorStop(0, color);
        g.addColorStop(0.6, withAlpha(color, 0.35));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, rr, 0, TAU); ctx.fill();
      }
      ctx.restore();
      return;
    }

    case 'glow': {
      ctx.save();
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const rr = bs * (0.9 + pr * 0.7);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, rr);
        g.addColorStop(0, color);
        g.addColorStop(0.55, withAlpha(color, 0.55));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, rr, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#fff';
      for (let i = 1; i < pts.length; i++) {
        const pr = ((prs[i-1] ?? 0.5) + (prs[i] ?? 0.5)) / 2;
        ctx.lineWidth = Math.max(1, bs * 0.4 * (0.5 + pr));
        ctx.beginPath();
        ctx.moveTo(pts[i-1].x, pts[i-1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    case 'watercolor': {
      ctx.save();
      const layers = 3;
      for (let l = 0; l < layers; l++) {
        ctx.globalAlpha = 0.11 + l * 0.03;
        for (let i = 0; i < pts.length; i++) {
          const pr = prs[i] ?? 0.5;
          const rr = bs * (0.65 + pr * 0.7);
          const ox = rnd(bs * 0.3) - bs * 0.15;
          const oy = rnd(bs * 0.3) - bs * 0.15;
          const g = ctx.createRadialGradient(
            pts[i].x + ox, pts[i].y + oy, 0,
            pts[i].x + ox, pts[i].y + oy, rr
          );
          g.addColorStop(0, color);
          g.addColorStop(0.65, withAlpha(color, 0.4));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(pts[i].x + ox, pts[i].y + oy, rr, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    case 'neon': {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = bs * 3.5;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, bs/2, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.lineWidth = bs;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      ctx.shadowBlur = bs * 1.5;
      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, Math.max(0.5, bs/3), 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.lineWidth = Math.max(0.7, bs * 0.5);
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      ctx.shadowBlur = bs * 0.6;
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, Math.max(0.4, bs/5), 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.lineWidth = Math.max(0.5, bs * 0.22);
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    case 'mist': {
      ctx.save();
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const rr = bs * (1.4 + pr * 1.2);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, rr);
        g.addColorStop(0, withAlpha(color, 0.7));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, rr, 0, TAU); ctx.fill();
      }
      ctx.restore();
      return;
    }

    case 'smoke': {
      ctx.save();
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const rr = bs * (1.0 + pr * 0.9);
        const wob = Math.sin(i * 0.35) * bs * 0.5;
        const g = ctx.createRadialGradient(
          pts[i].x + wob, pts[i].y - wob, 0,
          pts[i].x + wob, pts[i].y - wob, rr
        );
        g.addColorStop(0, withAlpha(color, 0.55));
        g.addColorStop(0.7, withAlpha(color, 0.2));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pts[i].x + wob, pts[i].y - wob, rr, 0, TAU); ctx.fill();
      }
      ctx.restore();
      return;
    }

    case 'cloud': {
      ctx.save();
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const base = bs * (1.1 + pr * 0.8);
        for (let b = 0; b < 5; b++) {
          const a = rnd(TAU);
          const r = rnd(base * 0.7);
          const x = pts[i].x + Math.cos(a) * r;
          const y = pts[i].y + Math.sin(a) * r;
          const rr = base * (0.45 + rnd(0.4));
          const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
          g.addColorStop(0, withAlpha(color, 0.8));
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    case 'aurora': {
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const rr = bs * (0.9 + pr * 0.9);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, rr);
        g.addColorStop(0, withAlpha(color, 0.8));
        g.addColorStop(0.5, `hsla(${(i * 12) % 360},100%,65%,0.35)`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, rr, 0, TAU); ctx.fill();
      }
      ctx.restore();
      return;
    }

    case 'fog': {
      ctx.save();
      ctx.globalAlpha = 0.07;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const rr = bs * (1.8 + pr * 1.6);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, rr);
        g.addColorStop(0, withAlpha(color, 0.4));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, rr, 0, TAU); ctx.fill();
      }
      ctx.restore();
      return;
    }

    /* ═══ TEXTURED ═══ */

    case 'spray': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const rad = bs * (0.5 + pr * 0.7);
        const cnt = Math.max(4, Math.floor(rad * rad * 0.06));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const r = Math.sqrt(Math.random()) * rad;
          const sz = rnd(1.6) + 0.4;
          ctx.fillRect(pts[i].x + Math.cos(a)*r, pts[i].y + Math.sin(a)*r, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'chalk': {
      ctx.save();
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.6 + pr * 0.7);
        const cnt = Math.max(3, Math.floor(r * r * 0.9));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.sqrt(Math.random()) * r;
          const sz = rnd(2) + 0.6;
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'charcoal': {
      ctx.save();
      const rad = bs / 2;
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.7 + pr * 0.6);
        const cnt = Math.max(4, Math.floor(r * r * 0.6));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.sqrt(Math.random()) * r;
          const sz = rnd(2.5) + 0.5;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'crayon': {
      ctx.save();
      ctx.globalAlpha = 0.85;
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.7 + pr * 0.6);
        for (let j = 0; j < 14; j++) {
          const a = rnd(TAU);
          const rr = Math.sqrt(Math.random()) * r;
          const sz = rnd(2) + 0.8;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'bristle': {
      ctx.save();
      const hairs = 14;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * 0.5 * (0.6 + pr * 0.6);
        let dirX = 1, dirY = 0;
        if (i > 0) {
          const dx = pts[i].x - pts[i-1].x;
          const dy = pts[i].y - pts[i-1].y;
          const len = Math.hypot(dx, dy) || 1;
          dirX = dx / len; dirY = dy / len;
        }
        const perpX = -dirY, perpY = dirX;
        for (let h = 0; h < hairs; h++) {
          const t = (h / (hairs - 1)) * 2 - 1;
          const offX = perpX * t * r;
          const offY = perpY * t * r;
          const lenHair = r * (0.9 + Math.random() * 0.6);
          ctx.globalAlpha = 0.3 + Math.random() * 0.5;
          ctx.beginPath();
          ctx.lineWidth = Math.max(0.6, bs * 0.08);
          ctx.moveTo(pts[i].x + offX * 0.2, pts[i].y + offY * 0.2);
          ctx.lineTo(pts[i].x + offX + dirX * lenHair, pts[i].y + offY + dirY * lenHair);
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    case 'oil': {
      ctx.save();
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.8 + pr * 0.5);
        for (let j = 0; j < 18; j++) {
          const a = rnd(TAU);
          const rr = Math.sqrt(Math.random()) * r * 0.7;
          const x = pts[i].x + Math.cos(a) * rr;
          const y = pts[i].y + Math.sin(a) * rr;
          const w = bs * 0.25 + rnd(bs * 0.18);
          const h = bs * 0.12 + rnd(bs * 0.1);
          const rot = rnd(TAU);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.globalAlpha = 0.4 + Math.random() * 0.5;
          ctx.fillRect(-w/2, -h/2, w, h);
          ctx.restore();
        }
      }
      ctx.restore();
      return;
    }

    case 'pastel': {
      ctx.save();
      ctx.globalAlpha = 0.35;
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.7 + pr * 0.5);
        for (let j = 0; j < 22; j++) {
          const a = rnd(TAU);
          const rr = Math.sqrt(Math.random()) * r;
          const sz = rnd(1.8) + 0.6;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'sand': {
      ctx.save();
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.6 + pr * 0.6);
        const cnt = Math.max(6, Math.floor(r * r * 0.8));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.sqrt(Math.random()) * r;
          const sz = rnd(1.2) + 0.4;
          ctx.globalAlpha = 0.6 + Math.random() * 0.4;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'rust': {
      ctx.save();
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.8 + pr * 0.7);
        const cnt = Math.max(5, Math.floor(r * r * 0.5));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.sqrt(Math.random()) * r;
          const sz = rnd(3) + 0.8;
          ctx.globalAlpha = 0.3 + Math.random() * 0.6;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'concrete': {
      ctx.save();
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.9 + pr * 0.5);
        const cnt = Math.max(8, Math.floor(r * r * 0.7));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.sqrt(Math.random()) * r;
          const sz = rnd(1.8) + 0.5;
          ctx.globalAlpha = 0.25 + Math.random() * 0.5;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'wood': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = (bs / 2) * (0.7 + pr * 0.6);
        for (let j = 0; j < 8; j++) {
          const t = (j / 7) * 2 - 1;
          const yOff = t * r;
          const w = bs * (0.4 + rnd(0.4));
          ctx.globalAlpha = 0.25 + Math.random() * 0.4;
          ctx.fillRect(pts[i].x - w/2, pts[i].y + yOff, w, Math.max(1, bs * 0.05));
        }
      }
      ctx.restore();
      return;
    }

    case 'fabric': {
      ctx.save();
      ctx.globalAlpha = 0.45;
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.7 + pr * 0.5);
        const step = Math.max(2, r * 0.25);
        for (let x = -r; x <= r; x += step) {
          for (let y = -r; y <= r; y += step) {
            if ((x + y) % (step * 2) !== 0) continue;
            ctx.fillRect(pts[i].x + x, pts[i].y + y, step * 0.6, step * 0.6);
          }
        }
      }
      ctx.restore();
      return;
    }

    /* ═══ SPECIAL ═══ */

    case 'sparkle': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.6 + pr * 0.8);
        const cnt = Math.max(3, Math.floor(r * 0.5));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.random() * r;
          const x = pts[i].x + Math.cos(a)*rr;
          const y = pts[i].y + Math.sin(a)*rr;
          const sz = rnd(2) + 1;
          ctx.save();
          ctx.globalAlpha = 0.4 + Math.random() * 0.6;
          ctx.fillStyle = color;
          drawStar(ctx, x, y, sz);
          ctx.restore();
        }
      }
      ctx.restore();
      return;
    }

    case 'stars': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.5 + pr * 0.6);
        const cnt = Math.max(2, Math.floor(r * 0.35));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.random() * r;
          const x = pts[i].x + Math.cos(a)*rr;
          const y = pts[i].y + Math.sin(a)*rr;
          const sz = rnd(2.5) + 1.2;
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.fillStyle = color;
          drawStar(ctx, x, y, sz);
          ctx.restore();
        }
      }
      ctx.restore();
      return;
    }

    case 'confetti': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.6 + pr * 0.7);
        const cnt = Math.max(4, Math.floor(r * 0.6));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.random() * r;
          const x = pts[i].x + Math.cos(a)*rr;
          const y = pts[i].y + Math.sin(a)*rr;
          const w = rnd(3) + 1.5;
          const h = rnd(2) + 1;
          ctx.save();
          ctx.globalAlpha = 0.7 + Math.random() * 0.3;
          ctx.translate(x, y);
          ctx.rotate(rnd(TAU));
          ctx.fillStyle = color;
          ctx.fillRect(-w/2, -h/2, w, h);
          ctx.restore();
        }
      }
      ctx.restore();
      return;
    }

    case 'bubbles': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.5 + pr * 0.7);
        const cnt = Math.max(1, Math.floor(r * 0.2));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.random() * r;
          const x = pts[i].x + Math.cos(a)*rr;
          const y = pts[i].y + Math.sin(a)*rr;
          const rad = rnd(bs * 0.25) + bs * 0.08;
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = withAlpha(color, 0.9);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    case 'glitter': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.6 + pr * 0.8);
        const cnt = Math.max(6, Math.floor(r * 0.8));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.random() * r;
          const x = pts[i].x + Math.cos(a)*rr;
          const y = pts[i].y + Math.sin(a)*rr;
          const sz = rnd(1.4) + 0.4;
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.fillStyle = Math.random() > 0.5 ? color : '#fff';
          ctx.fillRect(x, y, sz, sz);
          ctx.restore();
        }
      }
      ctx.restore();
      return;
    }

    case 'frost': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.5 + pr * 0.7);
        for (let j = 0; j < 5; j++) {
          const a = (j / 5) * TAU + rnd(0.3);
          const len = r * (0.5 + Math.random() * 0.7);
          ctx.globalAlpha = 0.4 + Math.random() * 0.4;
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(0.5, bs * 0.06);
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i].x + Math.cos(a) * len, pts[i].y + Math.sin(a) * len);
          ctx.stroke();
          const bx = pts[i].x + Math.cos(a) * len * 0.6;
          const by = pts[i].y + Math.sin(a) * len * 0.6;
          for (const s of [-0.5, 0.5]) {
            const a2 = a + s;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(a2) * len * 0.3, by + Math.sin(a2) * len * 0.3);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
      return;
    }

    case 'splatter': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.6 + pr * 1.1);
        const cnt = Math.max(3, Math.floor(r * 0.4));
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const rr = Math.pow(Math.random(), 0.6) * r;
          const x = pts[i].x + Math.cos(a)*rr;
          const y = pts[i].y + Math.sin(a)*rr;
          const rad = rnd(bs * 0.2) + bs * 0.05;
          ctx.save();
          ctx.globalAlpha = 0.6 + Math.random() * 0.4;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(x, y, rad, rad * (0.6 + Math.random() * 0.8), rnd(TAU), 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
      return;
    }

    case 'vine': {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, bs * 0.15);
      for (let i = 1; i < pts.length; i++) {
        ctx.beginPath();
        ctx.moveTo(pts[i-1].x, pts[i-1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      for (let i = 0; i < pts.length; i += 3) {
        const pr = prs[i] ?? 0.5;
        const size = bs * (0.4 + pr * 0.6);
        const a = rnd(TAU);
        const x = pts[i].x;
        const y = pts[i].y;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.5, size * 0.25, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    case 'leaves': {
      ctx.save();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const size = bs * (0.5 + pr * 0.8);
        const cnt = 2;
        for (let j = 0; j < cnt; j++) {
          const a = rnd(TAU);
          const x = pts[i].x + (Math.random() - 0.5) * size;
          const y = pts[i].y + (Math.random() - 0.5) * size;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a);
          ctx.globalAlpha = 0.7 + Math.random() * 0.3;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.4);
          ctx.quadraticCurveTo(size * 0.4, 0, 0, size * 0.4);
          ctx.quadraticCurveTo(-size * 0.4, 0, 0, -size * 0.4);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
      return;
    }

    /* ═══ GRAND ═══ */

    case 'mosaic': {
      ctx.save();
      const tile = Math.max(4, bs * 0.5);
      const seen = new Set<string>();
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const rad = tile * (1 + pr);
        for (let dx = -rad; dx <= rad; dx += tile) {
          for (let dy = -rad; dy <= rad; dy += tile) {
            if (dx * dx + dy * dy > rad * rad) continue;
            const gx = Math.round((pts[i].x + dx) / tile) * tile;
            const gy = Math.round((pts[i].y + dy) / tile) * tile;
            const key = `${gx},${gy}`;
            if (seen.has(key)) continue;
            seen.add(key);
            ctx.save();
            ctx.globalAlpha = 0.55 + Math.random() * 0.45;
            ctx.translate(gx, gy);
            ctx.rotate((Math.floor(Math.random() * 4) * Math.PI) / 2);
            ctx.fillStyle = color;
            ctx.fillRect(-tile * 0.45, -tile * 0.45, tile * 0.9, tile * 0.9);
            ctx.restore();
          }
        }
      }
      ctx.restore();
      return;
    }

    case 'rings': {
      ctx.save();
      ctx.strokeStyle = color;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const base = bs * (0.3 + pr * 0.6);
        for (let k = 0; k < 4; k++) {
          const rad = base * (0.4 + k * 0.4);
          ctx.globalAlpha = 0.5 - k * 0.09;
          ctx.lineWidth = Math.max(0.7, bs * 0.08);
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, rad, 0, TAU); ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    case 'web': {
      ctx.save();
      ctx.strokeStyle = color;
      const rad = bs * 0.6;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = rad * (0.6 + pr * 0.8);
        const spokes = 6;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = Math.max(0.5, bs * 0.05);
        for (let s = 0; s < spokes; s++) {
          const a = (s / spokes) * TAU;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[i].x + Math.cos(a) * r, pts[i].y + Math.sin(a) * r);
          ctx.stroke();
        }
        for (let ring = 1; ring <= 3; ring++) {
          const rr = (ring / 3) * r;
          ctx.beginPath();
          for (let s = 0; s <= spokes; s++) {
            const a = (s / spokes) * TAU;
            const x = pts[i].x + Math.cos(a) * rr;
            const y = pts[i].y + Math.sin(a) * rr;
            if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }

    case 'flame': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.7 + pr * 0.7);
        const g1 = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, r);
        g1.addColorStop(0, withAlpha(color, 0.9));
        g1.addColorStop(0.5, withAlpha(color, 0.4));
        g1.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g1;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(255,220,150,0.7)';
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, r * 0.35, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        for (let j = 0; j < 4; j++) {
          const a = rnd(TAU);
          const rr = Math.random() * r * 1.4;
          const x = pts[i].x + Math.cos(a) * rr;
          const y = pts[i].y + Math.sin(a) * rr;
          const sz = rnd(1.6) + 0.4;
          ctx.fillStyle = Math.random() > 0.5 ? '#ffd27a' : color;
          ctx.fillRect(x, y, sz, sz);
        }
      }
      ctx.restore();
      return;
    }

    case 'galaxy': {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5;
        const r = bs * (0.9 + pr * 1.1);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, r);
        g.addColorStop(0, withAlpha(color, 0.7));
        g.addColorStop(0.4, withAlpha(color, 0.25));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, r, 0, TAU); ctx.fill();
        const stars = Math.max(3, Math.floor(r * 0.4));
        for (let s = 0; s < stars; s++) {
          const a = rnd(TAU);
          const rr = Math.random() * r;
          const x = pts[i].x + Math.cos(a) * rr;
          const y = pts[i].y + Math.sin(a) * rr;
          const sz = rnd(1.6) + 0.3;
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.fillStyle = Math.random() > 0.6 ? '#fff' : color;
          drawStar(ctx, x, y, sz);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      return;
    }
  }
}