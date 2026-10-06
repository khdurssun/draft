import type { FreehandStroke, BrushType } from './types';
import { interpolatePoints } from './geometry';

export function drawStrokeToCtx(
  ctx: CanvasRenderingContext2D,
  action: FreehandStroke,
  isEraser: boolean
) {
  let pts = action.points;
  let prs = action.pressures || [];
  const bs = action.size;
  const brush: BrushType = action.brush || 'round';

  if (!['spray','sparkle','chalk','charcoal','crayon','bristle'].includes(brush)) {
    const step = Math.max(1, bs * 0.15);
    const r = interpolatePoints(pts, prs, step);
    pts = r.pts; prs = r.prs;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

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

  switch (brush) {
    case 'round': {
      if (pts.length === 1) {
        const pr = prs[0] ?? 0.5;
        const w = isEraser ? bs : bs * (0.35 + pr * 0.65);
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, w/2, 0, Math.PI*2); ctx.fill();
        return;
      }
      for (let i = 1; i < pts.length; i++) {
        const pr = ((prs[i-1] ?? 0.5) + (prs[i] ?? 0.5)) / 2;
        const w = isEraser ? bs : Math.max(0.6, bs * (0.35 + pr * 0.65));
        ctx.beginPath(); ctx.lineWidth = w;
        ctx.moveTo(pts[i-1].x, pts[i-1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      return;
    }
    case 'pencil': {
      if (pts.length === 1) {
        const pr = prs[0] ?? 0.5;
        const w = Math.max(0.5, bs * (0.15 + pr * 0.5));
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, w/2, 0, Math.PI*2); ctx.fill();
        return;
      }
      for (let i = 1; i < pts.length; i++) {
        const pr = ((prs[i-1] ?? 0.5) + (prs[i] ?? 0.5)) / 2;
        const w = Math.max(0.4, bs * (0.15 + pr * 0.5));
        ctx.beginPath(); ctx.lineWidth = w;
        ctx.moveTo(pts[i-1].x, pts[i-1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      return;
    }
    case 'marker': {
      ctx.lineWidth = bs;
      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, bs/2, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      return;
    }
    case 'airbrush': {
      ctx.save(); ctx.globalAlpha = 0.08;
      const r = bs * 0.9;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const rr = r * (0.7 + pr * 0.5);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, rr);
        g.addColorStop(0, action.color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, rr, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore(); return;
    }
    case 'glow': {
      ctx.save(); ctx.globalAlpha = 0.35;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const rr = bs * (0.9 + pr * 0.6);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, rr);
        g.addColorStop(0, action.color); g.addColorStop(0.6, action.color + '80');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, rr, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff';
      for (let i = 1; i < pts.length; i++) {
        const pr = ((prs[i-1] ?? 0.5) + (prs[i] ?? 0.5)) / 2;
        ctx.lineWidth = Math.max(1, bs * 0.4 * (0.5 + pr));
        ctx.beginPath(); ctx.moveTo(pts[i-1].x, pts[i-1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      ctx.restore(); return;
    }
    case 'watercolor': {
      ctx.save(); ctx.globalAlpha = 0.18;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const rr = bs * (0.7 + pr * 0.6);
        const g = ctx.createRadialGradient(pts[i].x, pts[i].y, 0, pts[i].x, pts[i].y, rr);
        g.addColorStop(0, action.color); g.addColorStop(0.7, action.color + '40');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, rr, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore(); return;
    }
    case 'spray': {
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const rad = bs * (0.5 + pr * 0.7);
        const cnt = Math.max(4, Math.floor(rad * rad * 0.06));
        for (let j = 0; j < cnt; j++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * rad;
          const sz = Math.random() * 1.6 + 0.4;
          ctx.fillRect(pts[i].x + Math.cos(a)*r, pts[i].y + Math.sin(a)*r, sz, sz);
        }
      }
      return;
    }
    case 'chalk': {
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const r = rad * (0.6 + pr * 0.7);
        const cnt = Math.max(3, Math.floor(r * r * 0.9));
        for (let j = 0; j < cnt; j++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * r;
          const sz = Math.random() * 2 + 0.6;
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.globalAlpha = 1; return;
    }
    case 'charcoal': {
      const rad = bs / 2; ctx.globalAlpha = 0.7;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const r = rad * (0.7 + pr * 0.6);
        const cnt = Math.max(4, Math.floor(r * r * 0.6));
        for (let j = 0; j < cnt; j++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * r;
          const sz = Math.random() * 2.5 + 0.5;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.globalAlpha = 1; return;
    }
    case 'crayon': {
      ctx.save(); ctx.globalAlpha = 0.85;
      const rad = bs / 2;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const r = rad * (0.7 + pr * 0.6);
        for (let j = 0; j < 12; j++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * r;
          const sz = Math.random() * 2 + 0.8;
          ctx.fillRect(pts[i].x + Math.cos(a)*rr, pts[i].y + Math.sin(a)*rr, sz, sz);
        }
      }
      ctx.restore(); return;
    }
    case 'neon': {
      ctx.save();
      ctx.shadowColor = action.color; ctx.shadowBlur = bs * 3;
      ctx.strokeStyle = action.color; ctx.fillStyle = action.color;
      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, bs/2, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.lineWidth = bs;
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      ctx.shadowBlur = bs * 0.8;
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
      if (pts.length === 1) {
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, Math.max(0.5, bs/4), 0, Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.lineWidth = Math.max(0.6, bs * 0.35);
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      ctx.restore(); return;
    }
    case 'ink': {
      if (pts.length === 1) {
        const pr = prs[0] ?? 0.5; const w = bs * (0.4 + pr * 0.6);
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, w/2, 0, Math.PI*2); ctx.fill();
        return;
      }
      for (let i = 1; i < pts.length; i++) {
        const pr = ((prs[i-1] ?? 0.5) + (prs[i] ?? 0.5)) / 2;
        const w = Math.max(0.8, bs * (0.35 + pr * 0.75));
        ctx.beginPath(); ctx.lineWidth = w;
        ctx.moveTo(pts[i-1].x, pts[i-1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
      return;
    }
    case 'calligraphy': {
      const angle = Math.PI/4, half = bs/2;
      const cx = Math.cos(angle)*half, cy = Math.sin(angle)*half;
      ctx.lineCap = 'butt';
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const scale = 0.5 + pr * 0.8;
        const nx = cx*scale, ny = cy*scale;
        ctx.beginPath();
        ctx.moveTo(pts[i].x - nx, pts[i].y - ny);
        ctx.lineTo(pts[i].x + nx, pts[i].y + ny);
        ctx.lineWidth = Math.max(1, bs * 0.18 * scale);
        ctx.strokeStyle = action.color; ctx.stroke();
      }
      return;
    }
    case 'bristle': {
      const hairs = 12;
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const r = bs * 0.5 * (0.6 + pr * 0.6);
        for (let h = 0; h < hairs; h++) {
          const ang = (h / hairs) * Math.PI * 2;
          const rr = r * (0.5 + Math.random() * 0.5);
          ctx.globalAlpha = 0.3 + Math.random() * 0.5;
          ctx.beginPath(); ctx.lineWidth = Math.max(0.6, bs * 0.08);
          ctx.moveTo(pts[i].x + Math.cos(ang)*rr*0.2, pts[i].y + Math.sin(ang)*rr*0.2);
          ctx.lineTo(pts[i].x + Math.cos(ang)*rr, pts[i].y + Math.sin(ang)*rr);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1; return;
    }
    case 'sparkle': {
      for (let i = 0; i < pts.length; i++) {
        const pr = prs[i] ?? 0.5; const r = bs * (0.6 + pr * 0.8);
        const cnt = Math.max(3, Math.floor(r * 0.5));
        for (let j = 0; j < cnt; j++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.random() * r;
          const x = pts[i].x + Math.cos(a)*rr;
          const y = pts[i].y + Math.sin(a)*rr;
          const sz = Math.random() * 2 + 1;
          ctx.save();
          ctx.globalAlpha = 0.4 + Math.random() * 0.6;
          ctx.fillStyle = action.color;
          ctx.beginPath();
          ctx.moveTo(x, y-sz);
          ctx.lineTo(x+sz*0.3, y-sz*0.3);
          ctx.lineTo(x+sz, y);
          ctx.lineTo(x+sz*0.3, y+sz*0.3);
          ctx.lineTo(x, y+sz);
          ctx.lineTo(x-sz*0.3, y+sz*0.3);
          ctx.lineTo(x-sz, y);
          ctx.lineTo(x-sz*0.3, y-sz*0.3);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      return;
    }
  }
}