import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pencil, Eraser, PaintBucket, Hand, Lasso,
  Minus, Square, Circle, Triangle, ChevronRight
} from 'lucide-react';

import draftLogo from './assets/draft-logo.png';

type Tool = 'pencil' | 'line' | 'rectangle' | 'circle' | 'triangle' | 'eraser' | 'bucket' | 'hand' | 'lasso';
type ShapeTool = 'line' | 'rectangle' | 'circle' | 'triangle';
type Theme = 'light' | 'dark';

interface Point { x: number; y: number; }

interface FreehandStroke {
  type: 'stroke';
  tool: 'pencil' | 'eraser';
  points: Point[];
  pressures?: number[];
  color: string;
  size: number;
}

interface ShapeAction {
  type: 'shape';
  tool: ShapeTool;
  start: Point;
  end: Point;
  color: string;
  size: number;
  isFilled: boolean;
  shiftKey?: boolean;
}

interface FillAction {
  type: 'fill';
  x: number;
  y: number;
  color: string;
}

interface LassoAction {
  type: 'lasso';
  polygon: Point[];
  buffer: HTMLCanvasElement | null;
  bboxX: number;
  bboxY: number;
  offset: Point;
  deleteOnly?: boolean;
}

type CanvasAction = FreehandStroke | ShapeAction | FillAction | LassoAction;

const SHAPE_TOOLS: { id: ShapeTool; label: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: 'line', label: 'Line', Icon: Minus },
  { id: 'rectangle', label: 'Square', Icon: Square },
  { id: 'circle', label: 'Circle', Icon: Circle },
  { id: 'triangle', label: 'Triangle', Icon: Triangle },
];

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  if (h.length === 3) return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) };
  if (h.length === 6) return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  return null;
};

const rgbToHex = (r: number, g: number, b: number) => {
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
};

const rgbToHsv = (r: number, g: number, b: number) => {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const d = max - min;
  let h = 0;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  if (d !== 0) {
    if (max === r) h = ((g-b)/d + (g<b?6:0));
    else if (max === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h /= 6;
  }
  return { h: h*360, s: s*100, v: v*100 };
};

const hsvToRgb = (h: number, s: number, v: number) => {
  h = ((h%360)+360)%360 / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;
  const i = Math.floor(h*6);
  const f = h*6 - i;
  const p = v*(1-s);
  const q = v*(1-f*s);
  const t = v*(1-(1-f)*s);
  let r=0,g=0,b=0;
  switch (i%6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
};

function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, fillColor: string, W: number, H: number) {
  sx = Math.round(sx); sy = Math.round(sy);
  if (sx < 0 || sx >= W || sy < 0 || sy >= H) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const target = hexToRgb(fillColor);
  if (!target) return;
  const sp = (sy * W + sx) * 4;
  const sR = d[sp], sG = d[sp+1], sB = d[sp+2], sA = d[sp+3];
  if (sR === target.r && sG === target.g && sB === target.b && sA === 255) return;
  const TOL = 32;
  const match = (pos: number) =>
    Math.abs(d[pos]-sR) <= TOL && Math.abs(d[pos+1]-sG) <= TOL &&
    Math.abs(d[pos+2]-sB) <= TOL && Math.abs(d[pos+3]-sA) <= TOL;
  const stack: number[] = [sx, sy];
  const visited = new Uint8Array(W * H);
  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    let cx = x;
    while (cx >= 0 && !visited[cx + y*W] && match((y*W + cx)*4)) cx--;
    cx++;
    let spanAbove = false, spanBelow = false;
    while (cx < W && !visited[cx + y*W] && match((y*W + cx)*4)) {
      const p = (y*W + cx) * 4;
      d[p] = target.r; d[p+1] = target.g; d[p+2] = target.b; d[p+3] = 255;
      visited[cx + y*W] = 1;
      if (y > 0) {
        const ai = cx + (y-1)*W;
        const ok = !visited[ai] && match(ai*4);
        if (ok && !spanAbove) { stack.push(cx, y-1); spanAbove = true; }
        else if (!ok) spanAbove = false;
      }
      if (y < H-1) {
        const bi = cx + (y+1)*W;
        const ok = !visited[bi] && match(bi*4);
        if (ok && !spanBelow) { stack.push(cx, y+1); spanBelow = true; }
        else if (!ok) spanBelow = false;
      }
      cx++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function tracePolygon(ctx: CanvasRenderingContext2D, poly: Point[], offset: Point = { x: 0, y: 0 }) {
  if (poly.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(poly[0].x + offset.x, poly[0].y + offset.y);
  for (let i = 1; i < poly.length; i++) {
    ctx.lineTo(poly[i].x + offset.x, poly[i].y + offset.y);
  }
  ctx.closePath();
}

function drawStroke(ctx: CanvasRenderingContext2D, action: FreehandStroke) {
  const pts = action.points;
  const prs = action.pressures;
  const baseSize = action.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = action.tool === 'eraser' ? '#FFFFFF' : action.color;
  ctx.fillStyle = ctx.strokeStyle as string;

  if (pts.length === 1) {
    const pr = prs && prs.length > 0 ? prs[0] : 0.5;
    const w = baseSize * (0.25 + pr * 0.75);
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, w/2, 0, Math.PI*2);
    ctx.fill();
    return;
  }

  let varies = false;
  if (prs && prs.length === pts.length) {
    for (let i = 1; i < prs.length; i++) {
      if (Math.abs(prs[i] - prs[0]) > 0.02) { varies = true; break; }
    }
  }

  if (varies && prs) {
    for (let i = 1; i < pts.length; i++) {
      const pr = (prs[i-1] + prs[i]) / 2;
      const w = Math.max(0.5, baseSize * (0.25 + pr * 0.75));
      ctx.beginPath();
      ctx.lineWidth = w;
      ctx.moveTo(pts[i-1].x, pts[i-1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    const prFirst = prs[0];
    const wFirst = Math.max(0.5, baseSize * (0.25 + prFirst * 0.75));
    ctx.beginPath();
    ctx.lineWidth = wFirst;
    ctx.arc(pts[0].x, pts[0].y, wFirst/2, 0, Math.PI*2);
    ctx.fill();
    const prLast = prs[prs.length-1];
    const wLast = Math.max(0.5, baseSize * (0.25 + prLast * 0.75));
    ctx.beginPath();
    ctx.arc(pts[pts.length-1].x, pts[pts.length-1].y, wLast/2, 0, Math.PI*2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.lineWidth = baseSize;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

export default function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [activeMenu, setActiveMenu] = useState<'file' | 'window' | null>(null);
  const [exportSubmenuOpen, setExportSubmenuOpen] = useState(false);

  const canvasWidth = 794;
  const canvasHeight = 1123;

  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [lastShapeTool, setLastShapeTool] = useState<ShapeTool>('rectangle');
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [hoveredShape, setHoveredShape] = useState<ShapeTool | null>(null);

  const [pencilSize, setPencilSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(24);
  const [shapeSize, setShapeSize] = useState(4);
  const [isShapeFilled, setIsShapeFilled] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#1E293B');

  const [activePopover, setActivePopover] = useState<'pencil' | 'eraser' | 'shape' | 'color' | null>(null);

  const [hsv, setHsv] = useState({ h: 215, s: 80, v: 23 });
  const [hexInput, setHexInput] = useState('#1E293B');
  const [rgbInput, setRgbInput] = useState({ r: '30', g: '41', b: '59' });

  const [history, setHistory] = useState<CanvasAction[]>([]);
  const [, setRedoStack] = useState<CanvasAction[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isSatDragging, setIsSatDragging] = useState(false);
  const [isHueDragging, setIsHueDragging] = useState(false);

  const currentStrokeRef = useRef<Point[]>([]);
  const currentPressuresRef = useRef<number[]>([]);
  const shapeStartRef = useRef<Point | null>(null);
  const isMouseDownRef = useRef(false);
  const cursorPosRef = useRef<Point>({ x: 0, y: 0 });
  const shiftPressedRef = useRef(false);
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const spacePressedRef = useRef(false);
  const activeToolRef = useRef<Tool>('pencil');
  const selectedColorRef = useRef<string>('#1E293B');
  const pencilSizeRef = useRef(4);
  const eraserSizeRef = useRef(24);
  const shapeSizeRef = useRef(4);
  const isShapeFilledRef = useRef(false);
  const zoomRef = useRef(0.85);
  const rafRef = useRef<number | null>(null);

  const shapeHoldTimerRef = useRef<number | null>(null);
  const shapePressActiveRef = useRef(false);
  const shapeWasMenuOpenedRef = useRef(false);
  const hoveredShapeRef = useRef<ShapeTool | null>(null);

  const bgImageRef = useRef<HTMLImageElement | null>(null);

  const lassoPathRef = useRef<Point[]>([]);
  const lassoPolyRef = useRef<Point[]>([]);
  const lassoBufferRef = useRef<HTMLCanvasElement | null>(null);
  const lassoBBoxRef = useRef<Point>({ x: 0, y: 0 });
  const lassoOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const lassoModeRef = useRef<'draw' | 'selected' | 'move' | null>(null);
  const lassoMoveStartRef = useRef<Point | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const pointersRef = useRef<Map<number, { x: number; y: number; type: string }>>(new Map());
  const drawingPointerIdRef = useRef<number | null>(null);
  const pinchStartRef = useRef<{ distance: number; center: Point; zoom: number; pan: Point } | null>(null);
  const penActiveRef = useRef(false);
  const penReleaseTimerRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const satValRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cursorRingRef = useRef<HTMLDivElement>(null);
  const [isInsideCanvas, setIsInsideCanvas] = useState(false);

  const isDark = theme === 'dark';
  const isShapeTool = (t: Tool): t is ShapeTool =>
    t === 'line' || t === 'rectangle' || t === 'circle' || t === 'triangle';

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { pencilSizeRef.current = pencilSize; }, [pencilSize]);
  useEffect(() => { eraserSizeRef.current = eraserSize; }, [eraserSize]);
  useEffect(() => { shapeSizeRef.current = shapeSize; }, [shapeSize]);
  useEffect(() => { isShapeFilledRef.current = isShapeFilled; }, [isShapeFilled]);

  useEffect(() => {
    const ring = cursorRingRef.current;
    if (!ring) return;
    const size = activeTool === 'pencil' ? pencilSize : activeTool === 'eraser' ? eraserSize : 0;
    if (size > 0) {
      ring.style.width = `${size * zoomRef.current}px`;
      ring.style.height = `${size * zoomRef.current}px`;
    }
  }, [pencilSize, eraserSize, activeTool]);

  const drawShape = (
    ctx: CanvasRenderingContext2D,
    tool: ShapeTool,
    start: Point, end: Point, color: string, size: number,
    isFilled: boolean, snapShift: boolean
  ) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    if (snapShift && (tool === 'rectangle' || tool === 'circle' || tool === 'triangle')) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      dx = dx >= 0 ? m : -m;
      dy = dy >= 0 ? m : -m;
    }
    if (tool === 'line') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (tool === 'rectangle') {
      const x = dx < 0 ? start.x + dx : start.x;
      const y = dy < 0 ? start.y + dy : start.y;
      const w = Math.abs(dx), h = Math.abs(dy);
      if (isFilled) ctx.fillRect(x, y, w, h); else ctx.strokeRect(x, y, w, h);
    } else if (tool === 'circle') {
      const rx = Math.abs(dx)/2, ry = Math.abs(dy)/2;
      const cx = start.x + dx/2, cy = start.y + dy/2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1,rx), Math.max(1,ry), 0, 0, Math.PI*2);
      if (isFilled) ctx.fill(); else ctx.stroke();
    } else if (tool === 'triangle') {
      const x = dx < 0 ? start.x + dx : start.x;
      const y = dy < 0 ? start.y + dy : start.y;
      const w = Math.abs(dx), h = Math.abs(dy);
      ctx.beginPath();
      ctx.moveTo(x + w/2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      if (isFilled) ctx.fill(); else ctx.stroke();
    }
  };

  const drawAction = (ctx: CanvasRenderingContext2D, action: CanvasAction) => {
    if (action.type === 'stroke') {
      if (action.points.length < 1) return;
      drawStroke(ctx, action);
    } else if (action.type === 'shape') {
      drawShape(ctx, action.tool, action.start, action.end, action.color, action.size, action.isFilled, !!action.shiftKey);
    } else if (action.type === 'fill') {
      floodFill(ctx, action.x, action.y, action.color, canvasWidth, canvasHeight);
    } else if (action.type === 'lasso') {
      ctx.save();
      tracePolygon(ctx, action.polygon);
      ctx.clip();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
      if (!action.deleteOnly && action.buffer) {
        ctx.drawImage(action.buffer, action.bboxX + action.offset.x, action.bboxY + action.offset.y);
      }
    }
  };

  const redrawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, canvasWidth, canvasHeight);
    }
    for (const a of history) drawAction(ctx, a);
  }, [history, canvasWidth, canvasHeight]);

  useEffect(() => { redrawBase(); }, [redrawBase, historyVersion]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const tool = activeToolRef.current;
    const mode = lassoModeRef.current;

    if (tool === 'lasso') {
      const lw = 1.5 / zoomRef.current;
      const dash = [6 / zoomRef.current, 4 / zoomRef.current];

      if (mode === 'draw' && lassoPathRef.current.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = lw;
        ctx.setLineDash(dash);
        const p = lassoPathRef.current;
        ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if ((mode === 'selected' || mode === 'move') && lassoPolyRef.current.length > 0) {
        const poly = lassoPolyRef.current;
        const off = lassoOffsetRef.current;
        const bbox = lassoBBoxRef.current;

        ctx.save();
        tracePolygon(ctx, poly);
        ctx.clip();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();

        if (lassoBufferRef.current) {
          ctx.drawImage(lassoBufferRef.current, bbox.x + off.x, bbox.y + off.y);
        }

        ctx.save();
        ctx.translate(off.x, off.y);
        tracePolygon(ctx, poly);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = lw;
        ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      return;
    }

    if (!isMouseDownRef.current) return;
    if (tool === 'pencil' || tool === 'eraser') {
      const pts = currentStrokeRef.current;
      if (pts.length === 0) return;
      const size = tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current;
      drawStroke(ctx, {
        type: 'stroke',
        tool,
        points: pts,
        pressures: currentPressuresRef.current,
        color: selectedColorRef.current,
        size
      });
    } else if (shapeStartRef.current && isShapeTool(tool)) {
      drawShape(ctx, tool, shapeStartRef.current, cursorPosRef.current, selectedColorRef.current, shapeSizeRef.current, isShapeFilledRef.current, shiftPressedRef.current);
    }
  }, [canvasWidth, canvasHeight]);

  const scheduleOverlay = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawOverlay();
    });
  }, [drawOverlay]);

  const updateFromHsv = useCallback((n: { h:number; s:number; v:number }) => {
    setHsv(n);
    const { r, g, b } = hsvToRgb(n.h, n.s, n.v);
    const hex = rgbToHex(r, g, b);
    setSelectedColor(hex);
    selectedColorRef.current = hex;
    setHexInput(hex);
    setRgbInput({ r: String(r), g: String(g), b: String(b) });
  }, []);

  useEffect(() => {
    const up = () => { setIsSatDragging(false); setIsHueDragging(false); };
    const move = (e: MouseEvent) => {
      if (isSatDragging && satValRef.current) {
        const r = satValRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
        const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
        updateFromHsv({ ...hsv, s: (x/r.width)*100, v: (1 - y/r.height)*100 });
      }
      if (isHueDragging && hueRef.current) {
        const r = hueRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
        updateFromHsv({ ...hsv, h: (x/r.width)*360 });
      }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointermove', move);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointermove', move); };
  }, [isSatDragging, isHueDragging, hsv, updateFromHsv]);

  const handleHex = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHexInput(v);
    if (/^#?[0-9A-Fa-f]{6}$/.test(v)) {
      const hex = v.startsWith('#') ? v : `#${v}`;
      const rgb = hexToRgb(hex);
      if (rgb) {
        setSelectedColor(hex);
        selectedColorRef.current = hex;
        setRgbInput({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });
        setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
      }
    }
  };

  const handleRgb = (ch: 'r'|'g'|'b', v: string) => {
    const ni = { ...rgbInput, [ch]: v };
    setRgbInput(ni);
    const r = parseInt(ni.r), g = parseInt(ni.g), b = parseInt(ni.b);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b) && r>=0 && r<=255 && g>=0 && g<=255 && b>=0 && b<=255) {
      const hex = rgbToHex(r,g,b);
      setSelectedColor(hex);
      selectedColorRef.current = hex;
      setHexInput(hex);
      setHsv(rgbToHsv(r,g,b));
    }
  };

  useEffect(() => {
    if (activePopover !== 'color') return;
    const s = satValRef.current, h = hueRef.current;
    if (!s || !h) return;
    const sc = s.getContext('2d');
    if (sc) {
      sc.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
      sc.fillRect(0, 0, s.width, s.height);
      const wg = sc.createLinearGradient(0, 0, s.width, 0);
      wg.addColorStop(0, 'rgba(255,255,255,1)');
      wg.addColorStop(1, 'rgba(255,255,255,0)');
      sc.fillStyle = wg;
      sc.fillRect(0, 0, s.width, s.height);
      const bg = sc.createLinearGradient(0, 0, 0, s.height);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(1, 'rgba(0,0,0,1)');
      sc.fillStyle = bg;
      sc.fillRect(0, 0, s.width, s.height);
    }
    const hc = h.getContext('2d');
    if (hc) {
      const g = hc.createLinearGradient(0, 0, h.width, 0);
      g.addColorStop(0, '#F00'); g.addColorStop(0.17, '#FF0');
      g.addColorStop(0.33, '#0F0'); g.addColorStop(0.5, '#0FF');
      g.addColorStop(0.67, '#00F'); g.addColorStop(0.83, '#F0F');
      g.addColorStop(1, '#F00');
      hc.fillStyle = g;
      hc.fillRect(0, 0, h.width, h.height);
    }
  }, [activePopover, hsv.h]);

  const cancelLasso = useCallback(() => {
    lassoPathRef.current = [];
    lassoPolyRef.current = [];
    lassoBufferRef.current = null;
    lassoBBoxRef.current = { x: 0, y: 0 };
    lassoOffsetRef.current = { x: 0, y: 0 };
    lassoModeRef.current = null;
    lassoMoveStartRef.current = null;
    setHasSelection(false);
    scheduleOverlay();
  }, [scheduleOverlay]);

  const commitLassoSelection = useCallback(() => {
    const path = lassoPathRef.current;
    if (path.length < 3) { cancelLasso(); return; }
    const baseCanvas = baseCanvasRef.current;
    if (!baseCanvas) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of path) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const bw = Math.max(1, Math.ceil(maxX - minX));
    const bh = Math.max(1, Math.ceil(maxY - minY));

    const buf = document.createElement('canvas');
    buf.width = bw;
    buf.height = bh;
    const bctx = buf.getContext('2d');
    if (bctx) {
      bctx.save();
      bctx.translate(-minX, -minY);
      tracePolygon(bctx, path);
      bctx.clip();
      bctx.drawImage(baseCanvas, 0, 0);
      bctx.restore();
    }

    lassoPolyRef.current = [...path];
    lassoBufferRef.current = buf;
    lassoBBoxRef.current = { x: minX, y: minY };
    lassoOffsetRef.current = { x: 0, y: 0 };
    lassoPathRef.current = [];
    lassoModeRef.current = 'selected';
    setHasSelection(true);
    scheduleOverlay();
  }, [cancelLasso, scheduleOverlay]);

  const finalizeLasso = useCallback((deleteOnly: boolean = false) => {
    const poly = lassoPolyRef.current;
    const buf = lassoBufferRef.current;
    if (poly.length < 3) { cancelLasso(); return; }

    const action: LassoAction = {
      type: 'lasso',
      polygon: [...poly],
      buffer: deleteOnly ? null : buf,
      bboxX: lassoBBoxRef.current.x,
      bboxY: lassoBBoxRef.current.y,
      offset: { ...lassoOffsetRef.current },
      deleteOnly,
    };

    setHistory(p => [...p, action]);
    setRedoStack([]);
    setHistoryVersion(v => v + 1);

    lassoPathRef.current = [];
    lassoPolyRef.current = [];
    lassoBufferRef.current = null;
    lassoBBoxRef.current = { x: 0, y: 0 };
    lassoOffsetRef.current = { x: 0, y: 0 };
    lassoModeRef.current = null;
    lassoMoveStartRef.current = null;
    setHasSelection(false);
    scheduleOverlay();
  }, [cancelLasso, scheduleOverlay]);

  const undo = useCallback(() => {
    if (lassoModeRef.current !== null) { cancelLasso(); return; }
    setHistory(p => {
      if (!p.length) return p;
      const n = [...p];
      const last = n.pop()!;
      setRedoStack(r => [...r, last]);
      return n;
    });
    setHistoryVersion(v => v + 1);
  }, [cancelLasso]);

  const redo = useCallback(() => {
    if (lassoModeRef.current !== null) return;
    setRedoStack(p => {
      if (!p.length) return p;
      const n = [...p];
      const a = n.pop()!;
      setHistory(h => [...h, a]);
      return n;
    });
    setHistoryVersion(v => v + 1);
  }, []);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'Shift') shiftPressedRef.current = true;
      if (e.code === 'Space') spacePressedRef.current = true;

      const mode = lassoModeRef.current;
      if (activeToolRef.current === 'lasso' && mode !== null) {
        if (e.key === 'Escape') { e.preventDefault(); cancelLasso(); return; }
        if (e.key === 'Enter') { e.preventDefault(); finalizeLasso(false); return; }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); finalizeLasso(true); return; }
      }
      if (e.key === 'Escape') {
        setActiveMenu(null); setActivePopover(null); setIsShapeMenuOpen(false); setExportSubmenuOpen(false);
      }
      const ctrl = e.ctrlKey || e.metaKey;
      const code = e.code, key = e.key.toLowerCase();
      if (ctrl) {
        if ((code === 'KeyZ' || key === 'z' || key === 'я') && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((code === 'KeyY' || key === 'y' || key === 'н') || ((code === 'KeyZ' || key === 'z' || key === 'я') && e.shiftKey)) { e.preventDefault(); redo(); }
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = false;
      if (e.code === 'Space') spacePressedRef.current = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [undo, redo, cancelLasso, finalizeLasso]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    setActiveMenu(null);
  };

  const getCanvasPt = useCallback((cx: number, cy: number): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const r = containerRef.current.getBoundingClientRect();
    return { x: (cx - r.left - panRef.current.x) / zoomRef.current, y: (cy - r.top - panRef.current.y) / zoomRef.current };
  }, []);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const nz = Math.max(0.15, Math.min(5, zoomRef.current * factor));
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const np = {
      x: mx - (mx - panRef.current.x) * (nz / zoomRef.current),
      y: my - (my - panRef.current.y) * (nz / zoomRef.current)
    };
    panRef.current = np;
    zoomRef.current = nz;
    if (canvasWrapperRef.current) {
      canvasWrapperRef.current.style.transform = `translate3d(${np.x}px, ${np.y}px, 0) scale(${nz})`;
    }
    const ring = cursorRingRef.current;
    if (ring) {
      const size = activeToolRef.current === 'pencil' ? pencilSizeRef.current : activeToolRef.current === 'eraser' ? eraserSizeRef.current : 0;
      if (size > 0) {
        ring.style.width = `${size * nz}px`;
        ring.style.height = `${size * nz}px`;
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}

    const p = { x: e.clientX, y: e.clientY, type: e.pointerType };
    pointersRef.current.set(e.pointerId, p);

    if (e.pointerType === 'touch' && penActiveRef.current) return;
    if (e.pointerType === 'touch') {
      for (const ptr of pointersRef.current.values()) {
        if (ptr.type === 'pen') return;
      }
    }

    if (e.pointerType === 'pen') {
      penActiveRef.current = true;
      if (penReleaseTimerRef.current) {
        window.clearTimeout(penReleaseTimerRef.current);
        penReleaseTimerRef.current = null;
      }
    }

    if (pointersRef.current.size === 2) {
      const ptrs = Array.from(pointersRef.current.values());
      const [a, b] = ptrs;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinchStartRef.current = {
        distance,
        center,
        zoom: zoomRef.current,
        pan: { ...panRef.current },
      };
      isMouseDownRef.current = false;
      isPanningRef.current = false;
      drawingPointerIdRef.current = null;
      currentStrokeRef.current = [];
      currentPressuresRef.current = [];
      shapeStartRef.current = null;
      lassoPathRef.current = [];
      lassoModeRef.current = null;
      setHasSelection(false);
      scheduleOverlay();
      return;
    }

    if (pointersRef.current.size > 2) return;

    const isPenEraser = e.pointerType === 'pen' && ((e.buttons & 32) !== 0);
    const isMiddle = e.button === 1;
    const tool = activeToolRef.current;
    const handMode = tool === 'hand' || spacePressedRef.current || isMiddle || isPenEraser;

    if (handMode) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
      drawingPointerIdRef.current = e.pointerId;
      return;
    }

    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const pt = getCanvasPt(e.clientX, e.clientY);
    drawingPointerIdRef.current = e.pointerId;
    isMouseDownRef.current = true;

    const pressure = e.pointerType === 'pen' ? (e.pressure > 0 ? e.pressure : 0.5) : 0.5;

    if (tool === 'pencil' || tool === 'eraser') {
      currentStrokeRef.current = [pt];
      currentPressuresRef.current = [pressure];
      scheduleOverlay();
    } else if (isShapeTool(tool)) {
      shapeStartRef.current = pt;
      cursorPosRef.current = pt;
      scheduleOverlay();
    } else if (tool === 'lasso') {
      const mode = lassoModeRef.current;
      if (mode === 'selected' || mode === 'move') {
        const off = lassoOffsetRef.current;
        const testPoly = lassoPolyRef.current.map(q => ({ x: q.x + off.x, y: q.y + off.y }));
        if (pointInPolygon(pt, testPoly)) {
          lassoModeRef.current = 'move';
          lassoMoveStartRef.current = pt;
          scheduleOverlay();
          return;
        }
        finalizeLasso(false);
      }
      lassoModeRef.current = 'draw';
      lassoPathRef.current = [pt];
      scheduleOverlay();
    } else if (tool === 'bucket') {
      const c = baseCanvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      floodFill(ctx, pt.x, pt.y, selectedColorRef.current, canvasWidth, canvasHeight);
      setHistory(p => [...p, { type: 'fill', x: Math.round(pt.x), y: Math.round(pt.y), color: selectedColorRef.current }]);
      setRedoStack([]);
      setHistoryVersion(v => v + 1);
      isMouseDownRef.current = false;
      drawingPointerIdRef.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointersRef.current.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }

    const ring = cursorRingRef.current;
    if (ring) {
      ring.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
    }

    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const ptrs = Array.from(pointersRef.current.values());
      const [a, b] = ptrs;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = distance / Math.max(1, pinchStartRef.current.distance);
      const newZoom = Math.max(0.15, Math.min(5, pinchStartRef.current.zoom * scale));
      const dx = center.x - pinchStartRef.current.center.x;
      const dy = center.y - pinchStartRef.current.center.y;
      const newPan = {
        x: pinchStartRef.current.pan.x + dx,
        y: pinchStartRef.current.pan.y + dy,
      };
      zoomRef.current = newZoom;
      panRef.current = newPan;
      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.style.transform = `translate3d(${newPan.x}px, ${newPan.y}px, 0) scale(${newZoom})`;
      }
      if (ring) {
        const size = activeToolRef.current === 'pencil' ? pencilSizeRef.current : activeToolRef.current === 'eraser' ? eraserSizeRef.current : 0;
        if (size > 0) {
          ring.style.width = `${size * newZoom}px`;
          ring.style.height = `${size * newZoom}px`;
        }
      }
      return;
    }

    if (e.pointerId !== drawingPointerIdRef.current) return;

    const pt = getCanvasPt(e.clientX, e.clientY);
    cursorPosRef.current = pt;

    if (isPanningRef.current) {
      const np = { x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y };
      panRef.current = np;
      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.style.transform = `translate3d(${np.x}px, ${np.y}px, 0) scale(${zoomRef.current})`;
      }
      return;
    }

    const tool = activeToolRef.current;

    if (tool === 'lasso') {
      const mode = lassoModeRef.current;
      if (mode === 'draw' && isMouseDownRef.current) {
        lassoPathRef.current.push(pt);
        scheduleOverlay();
        return;
      }
      if (mode === 'move' && lassoMoveStartRef.current) {
        const dx = pt.x - lassoMoveStartRef.current.x;
        const dy = pt.y - lassoMoveStartRef.current.y;
        lassoMoveStartRef.current = pt;
        lassoOffsetRef.current = {
          x: lassoOffsetRef.current.x + dx,
          y: lassoOffsetRef.current.y + dy
        };
        scheduleOverlay();
        return;
      }
      return;
    }

    if (isMouseDownRef.current && (tool === 'pencil' || tool === 'eraser')) {
      const pressure = e.pointerType === 'pen' ? (e.pressure > 0 ? e.pressure : 0.5) : 0.5;
      currentStrokeRef.current.push(pt);
      currentPressuresRef.current.push(pressure);
      scheduleOverlay();
    } else if (isMouseDownRef.current && shapeStartRef.current) {
      scheduleOverlay();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    pointersRef.current.delete(e.pointerId);

    if (e.pointerType === 'pen') {
      if (penReleaseTimerRef.current) window.clearTimeout(penReleaseTimerRef.current);
      penReleaseTimerRef.current = window.setTimeout(() => {
        penActiveRef.current = false;
        penReleaseTimerRef.current = null;
      }, 600);
    }

    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    if (e.pointerId !== drawingPointerIdRef.current) return;

    const tool = activeToolRef.current;

    if (tool === 'lasso') {
      isMouseDownRef.current = false;
      const mode = lassoModeRef.current;
      if (mode === 'draw') {
        commitLassoSelection();
      } else if (mode === 'move') {
        lassoModeRef.current = 'selected';
        lassoMoveStartRef.current = null;
        scheduleOverlay();
      }
      drawingPointerIdRef.current = null;
      return;
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      drawingPointerIdRef.current = null;
      return;
    }

    if (!isMouseDownRef.current) {
      drawingPointerIdRef.current = null;
      return;
    }

    if (tool === 'pencil' || tool === 'eraser') {
      if (currentStrokeRef.current.length > 0) {
        const s: FreehandStroke = {
          type: 'stroke',
          tool,
          points: [...currentStrokeRef.current],
          pressures: [...currentPressuresRef.current],
          color: selectedColorRef.current,
          size: tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current
        };
        setHistory(p => [...p, s]);
        setRedoStack([]);
      }
    } else if (shapeStartRef.current && isShapeTool(tool)) {
      const sh: ShapeAction = {
        type: 'shape',
        tool,
        start: shapeStartRef.current,
        end: cursorPosRef.current,
        color: selectedColorRef.current,
        size: shapeSizeRef.current,
        isFilled: isShapeFilledRef.current,
        shiftKey: shiftPressedRef.current
      };
      setHistory(p => [...p, sh]);
      setRedoStack([]);
    }

    isMouseDownRef.current = false;
    currentStrokeRef.current = [];
    currentPressuresRef.current = [];
    shapeStartRef.current = null;
    drawingPointerIdRef.current = null;

    setHistoryVersion(v => v + 1);

    const o = overlayCanvasRef.current;
    if (o) {
      const ctx = o.getContext('2d');
      ctx?.clearRect(0, 0, canvasWidth, canvasHeight);
    }
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;

    if (e.pointerId === drawingPointerIdRef.current) {
      isMouseDownRef.current = false;
      isPanningRef.current = false;
      currentStrokeRef.current = [];
      currentPressuresRef.current = [];
      shapeStartRef.current = null;
      drawingPointerIdRef.current = null;
      const o = overlayCanvasRef.current;
      if (o) {
        const ctx = o.getContext('2d');
        ctx?.clearRect(0, 0, canvasWidth, canvasHeight);
      }
    }
  };

  const exportImg = (fmt: 'png' | 'jpg' | 'jpeg') => {
    const b = baseCanvasRef.current;
    if (!b) return;
    const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    const quality = fmt === 'png' ? undefined : 0.92;
    const link = document.createElement('a');
    link.download = `draft-${Date.now()}.${fmt}`;
    link.href = b.toDataURL(mime, quality);
    link.click();
    setActiveMenu(null);
    setExportSubmenuOpen(false);
  };

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        bgImageRef.current = img;
        setHistory([]);
        setRedoStack([]);
        setHistoryVersion(v => v + 1);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    setActiveMenu(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const shapeMouseDown = () => {
    shapePressActiveRef.current = true;
    shapeWasMenuOpenedRef.current = false;
    shapeHoldTimerRef.current = window.setTimeout(() => {
      shapeHoldTimerRef.current = null;
      if (shapePressActiveRef.current) {
        setIsShapeMenuOpen(true);
        shapeWasMenuOpenedRef.current = true;
        setActivePopover(null);
      }
    }, 180);
  };

  useEffect(() => {
    const up = () => {
      if (shapeHoldTimerRef.current !== null) {
        clearTimeout(shapeHoldTimerRef.current);
        shapeHoldTimerRef.current = null;
      }
      if (shapeWasMenuOpenedRef.current) {
        if (hoveredShapeRef.current) {
          const s = hoveredShapeRef.current;
          setActiveTool(s);
          activeToolRef.current = s;
          setLastShapeTool(s);
        }
        setIsShapeMenuOpen(false);
        setHoveredShape(null);
        hoveredShapeRef.current = null;
        shapeWasMenuOpenedRef.current = false;
      } else if (shapePressActiveRef.current) {
        setActiveTool(lastShapeTool);
        activeToolRef.current = lastShapeTool;
      }
      shapePressActiveRef.current = false;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [lastShapeTool]);

  const toolClick = (t: Tool) => {
    if (t !== 'lasso' && lassoModeRef.current !== null) {
      if (lassoModeRef.current === 'selected' || lassoModeRef.current === 'move') {
        finalizeLasso(false);
      } else {
        cancelLasso();
      }
    }
    if (t === 'pencil' || t === 'eraser') {
      if (activeTool === t) setActivePopover(activePopover === t ? null : t);
      else { setActiveTool(t); setActivePopover(null); }
      return;
    }
    if (t === 'bucket' || t === 'hand' || t === 'lasso') { setActiveTool(t); setActivePopover(null); return; }
    if (isShapeTool(t) && !isShapeMenuOpen) {
      setActivePopover(activePopover === 'shape' ? null : 'shape');
    }
  };

  const currentShape: ShapeTool = isShapeTool(activeTool) ? activeTool : lastShapeTool;
  const CurrentShapeIcon = SHAPE_TOOLS.find(s => s.id === currentShape)!.Icon;

  const bg = isDark ? 'bg-zinc-950' : 'bg-zinc-100';
  const panel = isDark ? 'bg-zinc-900' : 'bg-white';
  const hover = isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100';
  const text = isDark ? 'text-zinc-200' : 'text-zinc-800';
  const muted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const border = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const inputBg = isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200';
  const btnBase = isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100';
  const btnOn = isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900';

  const viewportBg = isDark ? '#18181b' : '#e4e4e7';

  useEffect(() => {
    const fit = () => {
      if (containerRef.current && canvasWrapperRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        const sx = (r.width * 0.85) / canvasWidth;
        const sy = (r.height * 0.85) / canvasHeight;
        const z = Math.min(Math.max(Math.min(sx, sy), 0.2), 1);
        zoomRef.current = z;
        const np = {
          x: (r.width - canvasWidth * z) / 2,
          y: Math.max(20, (r.height - canvasHeight * z) / 2)
        };
        panRef.current = np;
        canvasWrapperRef.current.style.transform = `translate3d(${np.x}px, ${np.y}px, 0) scale(${z})`;
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (!activeMenu) return;
    const close = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-menu]')) return;
      setActiveMenu(null);
      setExportSubmenuOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [activeMenu]);

  const cursorStyle: React.CSSProperties['cursor'] =
    activeTool === 'hand' ? 'grab' : 'crosshair';

  const ringSize =
    activeTool === 'pencil' ? pencilSize
    : activeTool === 'eraser' ? eraserSize
    : 0;

  return (
    <div className={`relative w-screen h-screen ${bg} ${text} font-sans select-none overflow-hidden flex flex-col`}>

      <div className={`h-9 ${panel} border-b ${border} flex items-stretch text-[13px] z-[80] relative shrink-0`} data-menu>
        <div className="flex items-center justify-center px-2.5">
          <img src={draftLogo} alt="Draft" className="h-5 w-5 object-contain" draggable={false} />
        </div>

        <MenuButton
          label="File"
          active={activeMenu === 'file'}
          onToggle={() => { setActiveMenu(activeMenu === 'file' ? null : 'file'); setExportSubmenuOpen(false); }}
        />
        <MenuButton
          label="Window"
          active={activeMenu === 'window'}
          onToggle={() => { setActiveMenu(activeMenu === 'window' ? null : 'window'); setExportSubmenuOpen(false); }}
        />

        {activeMenu === 'file' && (
          <Dropdown panel={panel} border={border} width={210} offset={40}>
            <DropItem label="Open Project" onClick={() => fileInputRef.current?.click()} hover={hover} />
            <div className={`h-px my-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
            <DropItem
              label="Export"
              right={<ChevronRight className="w-3.5 h-3.5" />}
              onMouseEnter={() => setExportSubmenuOpen(true)}
              hover={hover}
            />
            {exportSubmenuOpen && (
              <div
                className={`absolute left-full top-0 -mt-1 ml-0.5 ${panel} border ${border} rounded shadow-2xl py-1 min-w-[140px]`}
                onMouseEnter={() => setExportSubmenuOpen(true)}
                onMouseLeave={() => setExportSubmenuOpen(false)}
              >
                <DropItem label="PNG" onClick={() => exportImg('png')} hover={hover} />
                <DropItem label="JPG" onClick={() => exportImg('jpg')} hover={hover} />
                <DropItem label="JPEG" onClick={() => exportImg('jpeg')} hover={hover} />
              </div>
            )}
          </Dropdown>
        )}

        {activeMenu === 'window' && (
          <Dropdown panel={panel} border={border} width={210} offset={78}>
            <DropItem
              label={isDark ? 'Light Theme' : 'Dark Theme'}
              onClick={() => { setTheme(isDark ? 'light' : 'dark'); setActiveMenu(null); }}
              hover={hover}
            />
            <DropItem
              label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              onClick={toggleFullscreen}
              hover={hover}
            />
          </Dropdown>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleOpenProject}
        className="hidden"
      />

      <main
        ref={containerRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={(e) => { setIsInsideCanvas(false); if (e.pointerType === 'mouse') onPointerCancel(e); }}
        onPointerEnter={() => setIsInsideCanvas(true)}
        onContextMenu={(e) => e.preventDefault()}
        className="flex-1 relative overflow-hidden"
        style={{
          backgroundColor: viewportBg,
          cursor: cursorStyle,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div
          ref={canvasWrapperRef}
          className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          <canvas
            ref={baseCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="block w-full h-full bg-white shadow-2xl"
          />
          <canvas
            ref={overlayCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />

          {hasSelection && activeTool === 'lasso' && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-mono z-20 bg-indigo-500 text-white">
              Drag to move · Enter apply · Del remove · Esc cancel
            </div>
          )}
        </div>
      </main>

      {(activeTool === 'pencil' || activeTool === 'eraser') && isInsideCanvas && ringSize > 0 && (
        <div
          ref={cursorRingRef}
          className="fixed top-0 left-0 pointer-events-none z-[100] rounded-full"
          style={{
            width: `${ringSize * zoomRef.current}px`,
            height: `${ringSize * zoomRef.current}px`,
            border: '1.5px solid rgba(99, 102, 241, 0.9)',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.85), 0 0 4px rgba(0,0,0,0.35)',
            willChange: 'transform',
          }}
        />
      )}

      <aside className="absolute top-1/2 -translate-y-1/2 left-2 md:left-3 z-30">
        <div className={`${panel} border ${border} rounded-lg p-1 flex flex-col gap-0.5 shadow-xl`}>

          <div className="relative">
            <button
              onClick={() => toolClick('pencil')}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'pencil' ? btnOn : btnBase}`}
            >
              <Pencil className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={1.8} />
            </button>
            {activePopover === 'pencil' && (
              <Popover isDark={isDark} border={border}>
                <SliderRow label="Size" value={pencilSize} unit="px" min={1} max={60} onChange={setPencilSize} isDark={isDark} muted={muted} />
              </Popover>
            )}
          </div>

          <div className="relative">
            <button
              onPointerDown={shapeMouseDown}
              className={`relative w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center transition-colors ${isShapeTool(activeTool) ? btnOn : btnBase}`}
            >
              <CurrentShapeIcon className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={1.8} />
              <ChevronRight className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 text-white drop-shadow-[0_0_1.5px_rgba(0,0,0,0.9)]" strokeWidth={3} />
            </button>

            {isShapeMenuOpen && (
              <div className={`absolute left-11 md:left-12 top-0 ${panel} border ${border} rounded-md p-1 shadow-xl z-40 flex flex-col gap-0.5 min-w-[120px]`}>
                {SHAPE_TOOLS.map(({ id, label, Icon }) => {
                  const hovered = hoveredShape === id;
                  const current = activeTool === id;
                  return (
                    <div
                      key={id}
                      onPointerEnter={() => { setHoveredShape(id); hoveredShapeRef.current = id; }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                        hovered ? 'bg-indigo-500 text-white' : current ? btnOn : btnBase
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {activePopover === 'shape' && isShapeTool(activeTool) && !isShapeMenuOpen && (
              <Popover isDark={isDark} border={border}>
                <SliderRow label="Line" value={shapeSize} unit="px" min={1} max={40} onChange={setShapeSize} isDark={isDark} muted={muted} />
                {['rectangle','circle','triangle'].includes(activeTool) && (
                  <button
                    onClick={() => setIsShapeFilled(!isShapeFilled)}
                    className={`mt-2 w-full px-2 py-1 rounded text-[11px] font-medium transition-colors ${isShapeFilled ? 'bg-indigo-500 text-white' : isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}
                  >
                    {isShapeFilled ? 'Filled' : 'Outline'}
                  </button>
                )}
              </Popover>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => toolClick('eraser')}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'eraser' ? btnOn : btnBase}`}
            >
              <Eraser className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={1.8} />
            </button>
            {activePopover === 'eraser' && (
              <Popover isDark={isDark} border={border}>
                <SliderRow label="Size" value={eraserSize} unit="px" min={4} max={120} onChange={setEraserSize} isDark={isDark} muted={muted} />
              </Popover>
            )}
          </div>

          <button
            onClick={() => toolClick('bucket')}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'bucket' ? btnOn : btnBase}`}
          >
            <PaintBucket className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={1.8} />
          </button>

          <button
            onClick={() => toolClick('lasso')}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'lasso' ? btnOn : btnBase}`}
          >
            <Lasso className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={1.8} />
          </button>

          <div className="relative">
            <button
              onClick={() => { setActivePopover(activePopover === 'color' ? null : 'color'); setIsShapeMenuOpen(false); }}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center transition-colors ${activePopover === 'color' ? btnOn : btnBase}`}
            >
              <div className={`w-5 h-5 md:w-6 md:h-6 rounded border ${border}`} style={{ backgroundColor: selectedColor }} />
            </button>
            {activePopover === 'color' && (
              <div className={`absolute left-11 md:left-12 bottom-0 ${panel} border ${border} rounded-md p-2.5 shadow-xl w-56 z-50 flex flex-col gap-2`}>
                <div className={`relative w-full h-32 rounded overflow-hidden border ${border} cursor-crosshair`}>
                  <canvas
                    ref={satValRef}
                    width={216} height={128}
                    onPointerDown={(e) => {
                      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
                      setIsSatDragging(true);
                      const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
                      const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
                      const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
                      updateFromHsv({ ...hsv, s: (x/r.width)*100, v: (1-y/r.height)*100 });
                    }}
                    className="w-full h-full block"
                  />
                  <div
                    className="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${hsv.s}%`, top: `${100-hsv.v}%`, backgroundColor: selectedColor }}
                  />
                </div>
                <div className={`relative w-full h-2.5 rounded overflow-hidden border ${border} cursor-pointer`}>
                  <canvas
                    ref={hueRef}
                    width={216} height={10}
                    onPointerDown={(e) => {
                      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
                      setIsHueDragging(true);
                      const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
                      const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
                      updateFromHsv({ ...hsv, h: (x/r.width)*360 });
                    }}
                    className="w-full h-full block"
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 border border-white shadow bg-white pointer-events-none -translate-x-1/2"
                    style={{ left: `${(hsv.h/360)*100}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className={`w-6 ${muted} font-mono`}>HEX</span>
                  <input
                    type="text"
                    value={hexInput}
                    onChange={handleHex}
                    className={`flex-1 ${inputBg} border rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-indigo-500 uppercase text-[11px]`}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className={`w-6 ${muted} font-mono`}>RGB</span>
                  <div className="flex gap-1 flex-1">
                    {(['r','g','b'] as const).map(ch => (
                      <input
                        key={ch}
                        type="text"
                        value={rgbInput[ch]}
                        onChange={(e) => handleRgb(ch, e.target.value)}
                        className={`w-full ${inputBg} border rounded px-1 py-0.5 text-center font-mono focus:outline-none focus:border-indigo-500 text-[11px]`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => toolClick('hand')}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-md flex items-center justify-center transition-colors ${activeTool === 'hand' ? btnOn : btnBase}`}
          >
            <Hand className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={1.8} />
          </button>
        </div>
      </aside>
    </div>
  );
}

function MenuButton({ label, active, onToggle }: {
  label: string; active: boolean; onToggle: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); onToggle(); }}
      className={`px-3 text-[13px] transition-colors ${
        active
          ? 'bg-indigo-500 text-white'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
      }`}
    >
      {label}
    </button>
  );
}

function Dropdown({ children, panel, border, width = 210, offset = 0 }: {
  children: React.ReactNode;
  panel: string;
  border: string;
  width?: number;
  offset?: number;
}) {
  return (
    <div
      className={`absolute top-full ${panel} border ${border} rounded shadow-xl py-1 z-[90]`}
      style={{ width, left: offset }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function DropItem({ label, onClick, onMouseEnter, right, hover, danger }: {
  label: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  right?: React.ReactNode;
  hover: string;
  danger?: boolean;
}) {
  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); onClick?.(); }}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors ${
        danger ? 'text-red-400 hover:bg-red-500/10' : `text-zinc-300 ${hover}`
      }`}
    >
      <span className="flex-1 text-left">{label}</span>
      {right}
    </button>
  );
}

function Popover({ children, isDark, border }: {
  children: React.ReactNode; isDark: boolean; border: string;
}) {
  return (
    <div className={`absolute left-11 md:left-12 top-0 ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${border} rounded-md p-2.5 shadow-xl w-48 z-40`}>
      {children}
    </div>
  );
}

function SliderRow({ label, value, unit, min, max, onChange, isDark, muted }: {
  label: string; value: number; unit: string; min: number; max: number;
  onChange: (n: number) => void; isDark: boolean; muted: string;
}) {
  return (
    <>
      <div className={`flex justify-between text-[11px] mb-1.5 ${muted}`}>
        <span>{label}</span>
        <span className="font-mono">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded appearance-none cursor-pointer accent-indigo-500"
        style={{ background: isDark ? '#3f3f46' : '#e4e4e7' }}
      />
    </>
  );
}