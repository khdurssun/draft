import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pencil, Eraser, PaintBucket, Hand, Undo2, Redo2, Menu, Download, X,
  Minus, Square, Circle, Sun, Moon, Trash2, Triangle, ChevronRight
} from 'lucide-react';

type Tool = 'pencil' | 'line' | 'rectangle' | 'circle' | 'triangle' | 'eraser' | 'bucket' | 'hand';
type ShapeTool = 'line' | 'rectangle' | 'circle' | 'triangle';
type Theme = 'light' | 'dark';

interface Point { x: number; y: number; }

interface FreehandStroke {
  type: 'stroke';
  tool: 'pencil' | 'eraser';
  points: Point[];
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

type CanvasAction = FreehandStroke | ShapeAction | FillAction;

const SHAPE_TOOLS: { id: ShapeTool; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
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

function floodFill(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  fillColor: string,
  W: number, H: number
) {
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
    Math.abs(d[pos]-sR) <= TOL &&
    Math.abs(d[pos+1]-sG) <= TOL &&
    Math.abs(d[pos+2]-sB) <= TOL &&
    Math.abs(d[pos+3]-sA) <= TOL;

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

  const HT = 96;
  const heal = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = x + y*W;
      if (visited[idx] || heal[idx]) continue;
      const p = idx * 4;
      const r = d[p], g = d[p+1], b = d[p+2], a = d[p+3];
      const dr = Math.abs(r-sR), dg = Math.abs(g-sG), db = Math.abs(b-sB), da = Math.abs(a-sA);
      if (dr > HT || dg > HT || db > HT || da > HT) continue;
      const adj =
        (x > 0 && visited[x-1 + y*W]) ||
        (x < W-1 && visited[x+1 + y*W]) ||
        (y > 0 && visited[x + (y-1)*W]) ||
        (y < H-1 && visited[x + (y+1)*W]);
      if (!adj) continue;
      const dist = Math.sqrt(dr*dr + dg*dg + db*db);
      const maxD = HT * Math.sqrt(3);
      const t = Math.min(1, Math.max(0, dist / maxD));
      d[p] = Math.round(r*(1-t) + target.r*t);
      d[p+1] = Math.round(g*(1-t) + target.g*t);
      d[p+2] = Math.round(b*(1-t) + target.b*t);
      d[p+3] = 255;
      heal[idx] = 1;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export default function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
  const [redoStack, setRedoStack] = useState<CanvasAction[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);

  const [isSatDragging, setIsSatDragging] = useState(false);
  const [isHueDragging, setIsHueDragging] = useState(false);

  const currentStrokeRef = useRef<Point[]>([]);
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
  const hasStrokeRef = useRef(false);

  const shapeHoldTimerRef = useRef<number | null>(null);
  const shapePressActiveRef = useRef(false);
  const shapeWasMenuOpenedRef = useRef(false);
  const hoveredShapeRef = useRef<ShapeTool | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const satValRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);

  const isDark = theme === 'dark';
  const isShapeTool = (t: Tool): t is ShapeTool =>
    t === 'line' || t === 'rectangle' || t === 'circle' || t === 'triangle';

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { pencilSizeRef.current = pencilSize; }, [pencilSize]);
  useEffect(() => { eraserSizeRef.current = eraserSize; }, [eraserSize]);
  useEffect(() => { shapeSizeRef.current = shapeSize; }, [shapeSize]);
  useEffect(() => { isShapeFilledRef.current = isShapeFilled; }, [isShapeFilled]);

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
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = action.tool === 'eraser' ? '#FFFFFF' : action.color;
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.lineWidth = action.size;
      if (action.points.length === 1) {
        ctx.arc(action.points[0].x, action.points[0].y, action.size/2, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.moveTo(action.points[0].x, action.points[0].y);
        for (let i = 1; i < action.points.length; i++) {
          ctx.lineTo(action.points[i].x, action.points[i].y);
        }
        ctx.stroke();
      }
    } else if (action.type === 'shape') {
      drawShape(ctx, action.tool, action.start, action.end, action.color, action.size, action.isFilled, !!action.shiftKey);
    } else if (action.type === 'fill') {
      floodFill(ctx, action.x, action.y, action.color, canvasWidth, canvasHeight);
    }
  };

  const redrawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    for (const a of history) drawAction(ctx, a);
  }, [history, canvasWidth, canvasHeight]);

  useEffect(() => { redrawBase(); }, [redrawBase, historyVersion]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!isMouseDownRef.current) return;
    const tool = activeToolRef.current;
    if (tool === 'pencil' || tool === 'eraser') {
      const pts = currentStrokeRef.current;
      if (pts.length === 0) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const s = tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current;
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : selectedColorRef.current;
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.lineWidth = s;
      if (pts.length === 1) {
        ctx.arc(pts[0].x, pts[0].y, s/2, 0, Math.PI*2);
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
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
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move); };
  }, [isSatDragging, isHueDragging, hsv]);

  const updateFromHsv = useCallback((n: { h:number; s:number; v:number }) => {
    setHsv(n);
    const { r, g, b } = hsvToRgb(n.h, n.s, n.v);
    const hex = rgbToHex(r, g, b);
    setSelectedColor(hex);
    selectedColorRef.current = hex;
    setHexInput(hex);
    setRgbInput({ r: String(r), g: String(g), b: String(b) });
  }, []);

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

  const undo = useCallback(() => {
    setHistory(p => {
      if (!p.length) return p;
      const n = [...p];
      const last = n.pop()!;
      setRedoStack(r => [...r, last]);
      return n;
    });
    setHistoryVersion(v => v + 1);
  }, []);

  const redo = useCallback(() => {
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
      if (e.key === 'Escape') { setIsDrawerOpen(false); setActivePopover(null); setIsShapeMenuOpen(false); }
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
  }, [undo, redo]);

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
  };

  const onDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isMiddle = e.button === 1;
    const tool = activeToolRef.current;
    const handMode = tool === 'hand' || spacePressedRef.current || isMiddle;

    if (handMode) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;

    const pt = getCanvasPt(e.clientX, e.clientY);
    isMouseDownRef.current = true;

    if (tool === 'pencil' || tool === 'eraser') {
      currentStrokeRef.current = [pt];
      hasStrokeRef.current = true;
      scheduleOverlay();
    } else if (isShapeTool(tool)) {
      shapeStartRef.current = pt;
      cursorPosRef.current = pt;
      scheduleOverlay();
    } else if (tool === 'bucket') {
      const c = baseCanvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      floodFill(ctx, pt.x, pt.y, selectedColorRef.current, canvasWidth, canvasHeight);
      setHistory(p => [...p, { type: 'fill', x: Math.round(pt.x), y: Math.round(pt.y), color: selectedColorRef.current }]);
      setRedoStack([]);
    }
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
    if (isMouseDownRef.current && (tool === 'pencil' || tool === 'eraser')) {
      currentStrokeRef.current.push(pt);
      scheduleOverlay();
    } else if (isMouseDownRef.current && shapeStartRef.current) {
      scheduleOverlay();
    }
    // update cursor ring position without state
    const ring = document.getElementById('cursor-ring');
    if (ring) {
      ring.style.left = pt.x + 'px';
      ring.style.top = pt.y + 'px';
    }
  };

  const onUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      if (containerRef.current) containerRef.current.style.cursor = '';
      return;
    }
    if (!isMouseDownRef.current) return;
    const tool = activeToolRef.current;

    if (tool === 'pencil' || tool === 'eraser') {
      if (currentStrokeRef.current.length > 0) {
        const s: FreehandStroke = {
          type: 'stroke',
          tool,
          points: [...currentStrokeRef.current],
          color: selectedColorRef.current,
          size: tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current
        };
        const c = baseCanvasRef.current;
        if (c) {
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (tool === 'eraser') {
              ctx.strokeStyle = '#FFFFFF';
              ctx.fillStyle = '#FFFFFF';
              ctx.lineWidth = eraserSizeRef.current;
            } else {
              ctx.strokeStyle = selectedColorRef.current;
              ctx.fillStyle = selectedColorRef.current;
              ctx.lineWidth = pencilSizeRef.current;
            }
            if (s.points.length === 1) {
              ctx.arc(s.points[0].x, s.points[0].y, s.size/2, 0, Math.PI*2);
              ctx.fill();
            } else {
              ctx.moveTo(s.points[0].x, s.points[0].y);
              for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
              ctx.stroke();
            }
          }
        }
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
      const c = baseCanvasRef.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) drawAction(ctx, sh);
      }
      setHistory(p => [...p, sh]);
      setRedoStack([]);
    }

    isMouseDownRef.current = false;
    currentStrokeRef.current = [];
    shapeStartRef.current = null;
    hasStrokeRef.current = false;

    const o = overlayCanvasRef.current;
    if (o) {
      const ctx = o.getContext('2d');
      ctx?.clearRect(0, 0, canvasWidth, canvasHeight);
    }
  };

  const exportImg = (fmt: 'png' | 'jpeg') => {
    const b = baseCanvasRef.current;
    if (!b) return;
    const link = document.createElement('a');
    link.download = `draft-${Date.now()}.${fmt === 'png' ? 'png' : 'jpg'}`;
    link.href = fmt === 'png' ? b.toDataURL('image/png') : b.toDataURL('image/jpeg', 0.92);
    link.click();
    setIsDrawerOpen(false);
  };

  const shapeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [lastShapeTool]);

  const toolClick = (t: Tool) => {
    if (t === 'pencil' || t === 'eraser') {
      if (activeTool === t) setActivePopover(activePopover === t ? null : t);
      else { setActiveTool(t); setActivePopover(null); }
      return;
    }
    if (t === 'bucket' || t === 'hand') { setActiveTool(t); setActivePopover(null); return; }
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

  // Initialize transform once
  useEffect(() => {
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
  }, []);

  return (
    <div className={`relative w-screen h-screen ${bg} ${text} font-sans select-none overflow-hidden`}>

      {/* Top-left: menu button */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        className={`absolute top-3 left-3 z-50 w-9 h-9 ${panel} ${hover} rounded-md border ${border} flex items-center justify-center transition-colors`}
      >
        <Menu className="w-[18px] h-[18px]" strokeWidth={1.8} />
      </button>

      {/* Drawer backdrop */}
      <div
        onClick={() => setIsDrawerOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-200 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-56 ${panel} border-r ${border} flex flex-col transition-transform duration-200 ease-out ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`h-12 flex items-center justify-between px-3 border-b ${border}`}>
          <span className="text-sm font-medium tracking-tight">Draft</span>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className={`w-7 h-7 rounded-md ${hover} flex items-center justify-center ${muted}`}
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>

        <nav className="flex-1 py-2 px-1.5 flex flex-col gap-0.5">
          <Row icon={Download} label="PNG" onClick={() => exportImg('png')} />
          <Row icon={Download} label="JPEG" onClick={() => exportImg('jpeg')} />
          <div className={`h-px my-1.5 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
          <Row icon={isDark ? Sun : Moon} label={isDark ? 'Light' : 'Dark'} onClick={() => setTheme(isDark ? 'light' : 'dark')} />
          <Row icon={Trash2} label="Clear" onClick={() => { setHistory([]); setRedoStack([]); setHistoryVersion(v => v+1); setIsDrawerOpen(false); }} danger />
        </nav>

        <div className={`h-9 px-3 border-t ${border} flex items-center justify-between text-[10px] font-mono ${muted}`}>
          <span>{canvasWidth}×{canvasHeight}</span>
          <span>{Math.round(zoomRef.current * 100)}%</span>
        </div>
      </aside>

      {/* Toolbar */}
      <aside className="absolute top-1/2 -translate-y-1/2 left-3 z-30">
        <div className={`${panel} border ${border} rounded-lg p-1 flex flex-col gap-0.5 shadow-xl`}>

          {/* Pencil */}
          <div className="relative">
            <button
              onClick={() => toolClick('pencil')}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${activeTool === 'pencil' ? btnOn : btnBase}`}
            >
              <Pencil className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </button>
            {activePopover === 'pencil' && (
              <Popover isDark={isDark} border={border} muted={muted}>
                <SliderRow label="Size" value={pencilSize} unit="px" min={1} max={60} onChange={setPencilSize} isDark={isDark} muted={muted} />
              </Popover>
            )}
          </div>

          {/* Shape */}
          <div className="relative">
            <button
              onMouseDown={shapeMouseDown}
              className={`relative w-9 h-9 rounded-md flex items-center justify-center transition-colors ${isShapeTool(activeTool) ? btnOn : btnBase}`}
            >
              <CurrentShapeIcon className="w-[18px] h-[18px]" strokeWidth={1.8} />
              <ChevronRight className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 text-white drop-shadow-[0_0_1.5px_rgba(0,0,0,0.9)]" strokeWidth={3} />
            </button>

            {isShapeMenuOpen && (
              <div className={`absolute left-12 top-0 ${panel} border ${border} rounded-md p-1 shadow-xl z-40 flex flex-col gap-0.5 min-w-[110px]`}>
                {SHAPE_TOOLS.map(({ id, label, Icon }) => {
                  const hovered = hoveredShape === id;
                  const current = activeTool === id;
                  return (
                    <div
                      key={id}
                      onMouseEnter={() => { setHoveredShape(id); hoveredShapeRef.current = id; }}
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
              <Popover isDark={isDark} border={border} muted={muted}>
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

          {/* Eraser */}
          <div className="relative">
            <button
              onClick={() => toolClick('eraser')}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${activeTool === 'eraser' ? btnOn : btnBase}`}
            >
              <Eraser className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </button>
            {activePopover === 'eraser' && (
              <Popover isDark={isDark} border={border} muted={muted}>
                <SliderRow label="Size" value={eraserSize} unit="px" min={4} max={120} onChange={setEraserSize} isDark={isDark} muted={muted} />
              </Popover>
            )}
          </div>

          {/* Bucket */}
          <button
            onClick={() => toolClick('bucket')}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${activeTool === 'bucket' ? btnOn : btnBase}`}
          >
            <PaintBucket className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>

          {/* Color */}
          <div className="relative">
            <button
              onClick={() => { setActivePopover(activePopover === 'color' ? null : 'color'); setIsShapeMenuOpen(false); }}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${activePopover === 'color' ? btnOn : btnBase}`}
            >
              <div className={`w-5 h-5 rounded border ${border}`} style={{ backgroundColor: selectedColor }} />
            </button>
            {activePopover === 'color' && (
              <div className={`absolute left-12 bottom-0 ${panel} border ${border} rounded-md p-2 shadow-xl w-52 z-50 flex flex-col gap-2`}>
                <div className={`relative w-full h-28 rounded overflow-hidden border ${border} cursor-crosshair`}>
                  <canvas
                    ref={satValRef}
                    width={200} height={112}
                    onMouseDown={(e) => {
                      setIsSatDragging(true);
                      const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
                      const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
                      const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
                      updateFromHsv({ ...hsv, s: (x/r.width)*100, v: (1-y/r.height)*100 });
                    }}
                    className="w-full h-full block"
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full border-2 border-white shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${hsv.s}%`, top: `${100-hsv.v}%`, backgroundColor: selectedColor }}
                  />
                </div>
                <div className={`relative w-full h-2.5 rounded overflow-hidden border ${border} cursor-pointer`}>
                  <canvas
                    ref={hueRef}
                    width={200} height={10}
                    onMouseDown={(e) => {
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

          {/* Hand */}
          <button
            onClick={() => toolClick('hand')}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${activeTool === 'hand' ? btnOn : btnBase}`}
          >
            <Hand className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>

          <div className={`h-px my-0.5 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

          <button
            onClick={undo}
            disabled={!history.length}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${btnBase} disabled:opacity-25 disabled:hover:bg-transparent`}
          >
            <Undo2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>
          <button
            onClick={redo}
            disabled={!redoStack.length}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${btnBase} disabled:opacity-25 disabled:hover:bg-transparent`}
          >
            <Redo2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      {/* Viewport */}
      <main
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        className="w-full h-full overflow-hidden bg-zinc-200 dark:bg-zinc-900"
        style={{ cursor: activeTool === 'hand' ? 'grab' : (activeTool === 'pencil' || activeTool === 'eraser') ? 'none' : 'crosshair' }}
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
            className={`block w-full h-full bg-white shadow-2xl ${isDark ? 'border border-zinc-800' : 'border border-zinc-300'}`}
          />
          <canvas
            ref={overlayCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />

          {(activeTool === 'pencil' || activeTool === 'eraser') && (
            <div
              id="cursor-ring"
              className={`absolute pointer-events-none rounded-full -translate-x-1/2 -translate-y-1/2 z-20 ${
                activeTool === 'eraser'
                  ? 'border border-black ring-1 ring-white/80'
                  : 'border border-black ring-1 ring-white/80'
              }`}
              style={{
                width: activeTool === 'eraser' ? eraserSize : Math.max(4, pencilSize),
                height: activeTool === 'eraser' ? eraserSize : Math.max(4, pencilSize),
                backgroundColor: activeTool === 'pencil' ? selectedColor : 'transparent',
                display: 'none'
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- small components ---------- */

function Row({
  icon: Icon, label, onClick, danger
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 dark:hover:bg-zinc-800'
      }`}
    >
      <Icon className="w-4 h-4" strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  );
}

function Popover({ children, isDark, border, muted }: {
  children: React.ReactNode; isDark: boolean; border: string; muted: string;
}) {
  return (
    <div className={`absolute left-12 top-0 ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${border} rounded-md p-2 shadow-xl w-44 z-40`}>
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