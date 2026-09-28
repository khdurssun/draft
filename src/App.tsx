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
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16),
      g: parseInt(cleanHex[1] + cleanHex[1], 16),
      b: parseInt(cleanHex[2] + cleanHex[2], 16)
    };
  }
  if (cleanHex.length === 6) {
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16)
    };
  }
  return null;
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
};

const hsvToRgb = (h: number, s: number, v: number) => {
  h = (h % 360 + 360) % 360 / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

function executeFloodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
  width: number,
  height: number
) {
  startX = Math.round(startX);
  startY = Math.round(startY);
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const targetRgb = hexToRgb(fillColor);
  if (!targetRgb) return;

  const startPos = (startY * width + startX) * 4;
  const startR = data[startPos];
  const startG = data[startPos + 1];
  const startB = data[startPos + 2];
  const startA = data[startPos + 3];

  if (startR === targetRgb.r && startG === targetRgb.g && startB === targetRgb.b && startA === 255) return;

  const TOLERANCE = 32;
  const colorMatch = (pos: number) =>
    Math.abs(data[pos] - startR) <= TOLERANCE &&
    Math.abs(data[pos + 1] - startG) <= TOLERANCE &&
    Math.abs(data[pos + 2] - startB) <= TOLERANCE &&
    Math.abs(data[pos + 3] - startA) <= TOLERANCE;

  const pixelStack: number[] = [startX, startY];
  const visited = new Uint8Array(width * height);

  while (pixelStack.length > 0) {
    const y = pixelStack.pop()!;
    const x = pixelStack.pop()!;
    let currentX = x;
    while (currentX >= 0 && !visited[currentX + y * width] && colorMatch((y * width + currentX) * 4)) currentX--;
    currentX++;

    let spanAbove = false, spanBelow = false;
    while (currentX < width && !visited[currentX + y * width] && colorMatch((y * width + currentX) * 4)) {
      const p = (y * width + currentX) * 4;
      data[p] = targetRgb.r;
      data[p + 1] = targetRgb.g;
      data[p + 2] = targetRgb.b;
      data[p + 3] = 255;
      visited[currentX + y * width] = 1;

      if (y > 0) {
        const aboveIdx = currentX + (y - 1) * width;
        const canFillAbove = !visited[aboveIdx] && colorMatch(aboveIdx * 4);
        if (canFillAbove && !spanAbove) { pixelStack.push(currentX, y - 1); spanAbove = true; }
        else if (!canFillAbove) spanAbove = false;
      }
      if (y < height - 1) {
        const belowIdx = currentX + (y + 1) * width;
        const canFillBelow = !visited[belowIdx] && colorMatch(belowIdx * 4);
        if (canFillBelow && !spanBelow) { pixelStack.push(currentX, y + 1); spanBelow = true; }
        else if (!canFillBelow) spanBelow = false;
      }
      currentX++;
    }
  }

  const HEAL_TOLERANCE = 96;
  const healPass = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = x + y * width;
      if (visited[idx] || healPass[idx]) continue;
      const p = idx * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3];
      const dr = Math.abs(r - startR), dg = Math.abs(g - startG), db = Math.abs(b - startB), da = Math.abs(a - startA);
      if (dr > HEAL_TOLERANCE || dg > HEAL_TOLERANCE || db > HEAL_TOLERANCE || da > HEAL_TOLERANCE) continue;
      const isAdjacentToFilled =
        (x > 0 && visited[x - 1 + y * width]) ||
        (x < width - 1 && visited[x + 1 + y * width]) ||
        (y > 0 && visited[x + (y - 1) * width]) ||
        (y < height - 1 && visited[x + (y + 1) * width]);
      if (!isAdjacentToFilled) continue;
      const distToOrig = Math.sqrt(dr * dr + dg * dg + db * db);
      const maxDist = HEAL_TOLERANCE * Math.sqrt(3);
      const t = Math.min(1, Math.max(0, distToOrig / maxDist));
      data[p] = Math.round(r * (1 - t) + targetRgb.r * t);
      data[p + 1] = Math.round(g * (1 - t) + targetRgb.g * t);
      data[p + 2] = Math.round(b * (1 - t) + targetRgb.b * t);
      data[p + 3] = 255;
      healPass[idx] = 1;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export default function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [canvasWidth] = useState(794);
  const [canvasHeight] = useState(1123);

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const [isHoveringViewport, setIsHoveringViewport] = useState(false);

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

  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isSatValDragging, setIsSatValDragging] = useState(false);
  const [isHueDragging, setIsHueDragging] = useState(false);

  const currentStrokeRef = useRef<Point[]>([]);
  const shapeStartRef = useRef<Point | null>(null);
  const isMouseDownRef = useRef(false);
  const cursorPosRef = useRef<Point>({ x: 0, y: 0 });
  const shiftPressedRef = useRef(false);
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const activeToolRef = useRef<Tool>('pencil');
  const selectedColorRef = useRef<string>('#1E293B');
  const pencilSizeRef = useRef(4);
  const eraserSizeRef = useRef(24);
  const shapeSizeRef = useRef(4);
  const isShapeFilledRef = useRef(false);
  const zoomRef = useRef(0.85);
  const rafRef = useRef<number | null>(null);

  // Shape menu press-and-hold
  const shapeHoldTimerRef = useRef<number | null>(null);
  const shapePressActiveRef = useRef(false);
  const shapeWasMenuOpenedRef = useRef(false);
  const hoveredShapeRef = useRef<ShapeTool | null>(null);
  const shapeMenuRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
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
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { shiftPressedRef.current = isShiftPressed; }, [isShiftPressed]);

  const centerCanvasInViewport = useCallback((width: number, height: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = (rect.width * 0.85) / width;
      const scaleY = (rect.height * 0.85) / height;
      const initialZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.0);
      setZoom(initialZoom);
      zoomRef.current = initialZoom;
      const newPan = {
        x: (rect.width - width * initialZoom) / 2,
        y: Math.max(20, (rect.height - height * initialZoom) / 2)
      };
      setPan(newPan);
      panRef.current = newPan;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => centerCanvasInViewport(canvasWidth, canvasHeight), 50);
    return () => clearTimeout(timer);
  }, [canvasWidth, canvasHeight, centerCanvasInViewport]);

  // Global mouseup — commits shape selection if menu is open
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (shapeHoldTimerRef.current !== null) {
        window.clearTimeout(shapeHoldTimerRef.current);
        shapeHoldTimerRef.current = null;
      }

      if (shapeWasMenuOpenedRef.current) {
        // Menu was open — apply hovered shape if any
        if (hoveredShapeRef.current) {
          setActiveTool(hoveredShapeRef.current);
          activeToolRef.current = hoveredShapeRef.current;
          setLastShapeTool(hoveredShapeRef.current);
        }
        setIsShapeMenuOpen(false);
        setHoveredShape(null);
        hoveredShapeRef.current = null;
        shapeWasMenuOpenedRef.current = false;
      } else if (shapePressActiveRef.current) {
        // Short click — use last shape tool
        setActiveTool(lastShapeTool);
        activeToolRef.current = lastShapeTool;
      }

      shapePressActiveRef.current = false;
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [lastShapeTool]);

  const updateFromHsv = useCallback((newHsv: { h: number; s: number; v: number }) => {
    setHsv(newHsv);
    const { r, g, b } = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    const hex = rgbToHex(r, g, b);
    setSelectedColor(hex);
    selectedColorRef.current = hex;
    setHexInput(hex);
    setRgbInput({ r: r.toString(), g: g.toString(), b: b.toString() });
  }, []);

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#?[0-9A-Fa-f]{6}$/.test(val)) {
      const formattedHex = val.startsWith('#') ? val : `#${val}`;
      const rgb = hexToRgb(formattedHex);
      if (rgb) {
        setSelectedColor(formattedHex);
        selectedColorRef.current = formattedHex;
        setRgbInput({ r: rgb.r.toString(), g: rgb.g.toString(), b: rgb.b.toString() });
        setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
      }
    }
  };

  const handleRgbInputChange = (channel: 'r' | 'g' | 'b', val: string) => {
    const newRgbInput = { ...rgbInput, [channel]: val };
    setRgbInput(newRgbInput);
    const rNum = parseInt(newRgbInput.r, 10);
    const gNum = parseInt(newRgbInput.g, 10);
    const bNum = parseInt(newRgbInput.b, 10);
    if (!isNaN(rNum) && !isNaN(gNum) && !isNaN(bNum) &&
        rNum >= 0 && rNum <= 255 && gNum >= 0 && gNum <= 255 && bNum >= 0 && bNum <= 255) {
      const hex = rgbToHex(rNum, gNum, bNum);
      setSelectedColor(hex);
      selectedColorRef.current = hex;
      setHexInput(hex);
      setHsv(rgbToHsv(rNum, gNum, bNum));
    }
  };

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
      const maxSide = Math.max(Math.abs(dx), Math.abs(dy));
      dx = dx >= 0 ? maxSide : -maxSide;
      dy = dy >= 0 ? maxSide : -maxSide;
    }

    if (tool === 'line') {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (tool === 'rectangle') {
      const x = dx < 0 ? start.x + dx : start.x;
      const y = dy < 0 ? start.y + dy : start.y;
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      if (isFilled) ctx.fillRect(x, y, w, h);
      else ctx.strokeRect(x, y, w, h);
    } else if (tool === 'circle') {
      const rx = Math.abs(dx) / 2;
      const ry = Math.abs(dy) / 2;
      const cx = start.x + dx / 2;
      const cy = start.y + dy / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      else ctx.stroke();
    } else if (tool === 'triangle') {
      const x = dx < 0 ? start.x + dx : start.x;
      const y = dy < 0 ? start.y + dy : start.y;
      const w = Math.abs(dx);
      const h = Math.abs(dy);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      if (isFilled) ctx.fill();
      else ctx.stroke();
    }
  };

  const drawAction = (ctx: CanvasRenderingContext2D, action: CanvasAction) => {
    if (action.type === 'stroke') {
      if (action.points.length < 1) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (action.tool === 'eraser') {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = action.size;
      } else {
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.size;
      }
      if (action.points.length === 1) {
        ctx.arc(action.points[0].x, action.points[0].y, action.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = action.tool === 'eraser' ? '#FFFFFF' : action.color;
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
      executeFloodFill(ctx, action.x, action.y, action.color, canvasWidth, canvasHeight);
    }
  };

  const redrawBaseCanvas = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    for (const action of history) drawAction(ctx, action);
  }, [history, canvasWidth, canvasHeight]);

  useEffect(() => {
    redrawBaseCanvas();
  }, [redrawBaseCanvas, historyVersion]);

  const redrawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!isMouseDownRef.current) return;

    const tool = activeToolRef.current;

    if (tool === 'pencil' || tool === 'eraser') {
      const points = currentStrokeRef.current;
      if (points.length === 0) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const size = tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current;
      if (tool === 'eraser') {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = size;
        ctx.fillStyle = '#FFFFFF';
      } else {
        ctx.strokeStyle = selectedColorRef.current;
        ctx.fillStyle = selectedColorRef.current;
        ctx.lineWidth = size;
      }
      if (points.length === 1) {
        ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    } else if (shapeStartRef.current && isShapeTool(tool)) {
      drawShape(
        ctx,
        tool,
        shapeStartRef.current,
        cursorPosRef.current,
        selectedColorRef.current,
        shapeSizeRef.current,
        isShapeFilledRef.current,
        shiftPressedRef.current
      );
    }
  }, [canvasWidth, canvasHeight]);

  const scheduleOverlayRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redrawOverlay();
    });
  }, [redrawOverlay]);

  useEffect(() => {
    if (activePopover !== 'color' || !satValRef.current || !hueRef.current) return;
    const satCanvas = satValRef.current;
    const sCtx = satCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
      sCtx.fillRect(0, 0, satCanvas.width, satCanvas.height);
      const whiteGrad = sCtx.createLinearGradient(0, 0, satCanvas.width, 0);
      whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
      whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
      sCtx.fillStyle = whiteGrad;
      sCtx.fillRect(0, 0, satCanvas.width, satCanvas.height);
      const blackGrad = sCtx.createLinearGradient(0, 0, 0, satCanvas.height);
      blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
      blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
      sCtx.fillStyle = blackGrad;
      sCtx.fillRect(0, 0, satCanvas.width, satCanvas.height);
    }
    const hueCanvas = hueRef.current;
    const hCtx = hueCanvas.getContext('2d');
    if (hCtx) {
      const grad = hCtx.createLinearGradient(0, 0, hueCanvas.width, 0);
      grad.addColorStop(0, '#FF0000');
      grad.addColorStop(0.17, '#FFFF00');
      grad.addColorStop(0.33, '#00FF00');
      grad.addColorStop(0.5, '#00FFFF');
      grad.addColorStop(0.67, '#0000FF');
      grad.addColorStop(0.83, '#FF00FF');
      grad.addColorStop(1, '#FF0000');
      hCtx.fillStyle = grad;
      hCtx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
    }
  }, [activePopover, hsv.h]);

  const handleSatValMove = useCallback((clientX: number, clientY: number) => {
    if (!satValRef.current) return;
    const rect = satValRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    updateFromHsv({ ...hsv, s: (x / rect.width) * 100, v: (1 - y / rect.height) * 100 });
  }, [hsv, updateFromHsv]);

  const handleHueMove = useCallback((clientX: number) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    updateFromHsv({ ...hsv, h: (x / rect.width) * 360 });
  }, [hsv, updateFromHsv]);

  useEffect(() => {
    const up = () => { setIsSatValDragging(false); setIsHueDragging(false); };
    const move = (e: MouseEvent) => {
      if (isSatValDragging) handleSatValMove(e.clientX, e.clientY);
      if (isHueDragging) handleHueMove(e.clientX);
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mousemove', move);
    };
  }, [isSatValDragging, isHueDragging, handleSatValMove, handleHueMove]);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const last = newHistory.pop()!;
      setRedoStack((r) => [...r, last]);
      return newHistory;
    });
    setHistoryVersion((v) => v + 1);
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const newRedo = [...prev];
      const action = newRedo.pop()!;
      setHistory((h) => [...h, action]);
      return newRedo;
    });
    setHistoryVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.code === 'Space') setIsSpacePressed(true);
      if (e.key === 'Escape') { setIsDrawerOpen(false); setActivePopover(null); setIsShapeMenuOpen(false); }
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const code = e.code;
      if (isCtrlOrCmd) {
        if ((code === 'KeyZ' || key === 'z' || key === 'я') && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if ((code === 'KeyY' || key === 'y' || key === 'н') ||
                   ((code === 'KeyZ' || key === 'z' || key === 'я') && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [handleUndo, handleRedo]);

  const getCanvasCoordinates = useCallback((clientX: number, clientY: number): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current
    };
  }, []);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.max(0.15, Math.min(5.0, zoomRef.current * zoomFactor));
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const newPan = {
      x: mouseX - (mouseX - panRef.current.x) * (newZoom / zoomRef.current),
      y: mouseY - (mouseY - panRef.current.y) * (newZoom / zoomRef.current)
    };
    panRef.current = newPan;
    zoomRef.current = newZoom;
    setPan(newPan);
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isMiddleClick = e.button === 1;
    const tool = activeToolRef.current;
    const isHandMode = tool === 'hand' || isSpacePressed || isMiddleClick;

    if (isHandMode) {
      e.preventDefault();
      setIsPanning(true);
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
      return;
    }
    if (e.button !== 0) return;

    const pt = getCanvasCoordinates(e.clientX, e.clientY);
    isMouseDownRef.current = true;

    if (tool === 'pencil' || tool === 'eraser') {
      currentStrokeRef.current = [pt];
      scheduleOverlayRedraw();
    } else if (isShapeTool(tool)) {
      shapeStartRef.current = pt;
      cursorPosRef.current = pt;
      scheduleOverlayRedraw();
    } else if (tool === 'bucket') {
      const baseCanvas = baseCanvasRef.current;
      if (!baseCanvas) return;
      const ctx = baseCanvas.getContext('2d');
      if (!ctx) return;
      executeFloodFill(ctx, Math.round(pt.x), Math.round(pt.y), selectedColorRef.current, canvasWidth, canvasHeight);
      setHistory((prev) => {
        const next = [...prev, { type: 'fill', x: Math.round(pt.x), y: Math.round(pt.y), color: selectedColorRef.current } as FillAction];
        return next;
      });
      setRedoStack([]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pt = getCanvasCoordinates(e.clientX, e.clientY);
    cursorPosRef.current = pt;
    setCursorPos(pt);

    if (isPanningRef.current) {
      const newPan = { x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y };
      panRef.current = newPan;
      setPan(newPan);
      return;
    }

    const tool = activeToolRef.current;
    if (isMouseDownRef.current && (tool === 'pencil' || tool === 'eraser')) {
      currentStrokeRef.current.push(pt);
      scheduleOverlayRedraw();
    } else if (isMouseDownRef.current && shapeStartRef.current) {
      scheduleOverlayRedraw();
    }
  };

  const handleMouseUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      return;
    }

    if (!isMouseDownRef.current) return;
    const tool = activeToolRef.current;

    if (tool === 'pencil' || tool === 'eraser') {
      if (currentStrokeRef.current.length > 0) {
        const newStroke: FreehandStroke = {
          type: 'stroke',
          tool,
          points: [...currentStrokeRef.current],
          color: selectedColorRef.current,
          size: tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current
        };
        const baseCanvas = baseCanvasRef.current;
        if (baseCanvas) {
          const ctx = baseCanvas.getContext('2d');
          if (ctx) {
            if (tool === 'eraser') {
              ctx.strokeStyle = '#FFFFFF';
              ctx.fillStyle = '#FFFFFF';
              ctx.lineWidth = eraserSizeRef.current;
            } else {
              ctx.strokeStyle = selectedColorRef.current;
              ctx.fillStyle = selectedColorRef.current;
              ctx.lineWidth = pencilSizeRef.current;
            }
            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const points = newStroke.points;
            if (points.length === 1) {
              ctx.arc(points[0].x, points[0].y, newStroke.size / 2, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.moveTo(points[0].x, points[0].y);
              for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
              ctx.stroke();
            }
          }
        }
        setHistory((prev) => [...prev, newStroke]);
        setRedoStack([]);
      }
    } else if (shapeStartRef.current && isShapeTool(tool)) {
      const newShape: ShapeAction = {
        type: 'shape',
        tool,
        start: shapeStartRef.current,
        end: cursorPosRef.current,
        color: selectedColorRef.current,
        size: shapeSizeRef.current,
        isFilled: isShapeFilledRef.current,
        shiftKey: shiftPressedRef.current
      };
      const baseCanvas = baseCanvasRef.current;
      if (baseCanvas) {
        const ctx = baseCanvas.getContext('2d');
        if (ctx) drawAction(ctx, newShape);
      }
      setHistory((prev) => [...prev, newShape]);
      setRedoStack([]);
    }

    isMouseDownRef.current = false;
    currentStrokeRef.current = [];
    shapeStartRef.current = null;

    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx?.clearRect(0, 0, canvasWidth, canvasHeight);
    }
  };

  const exportImage = (format: 'png' | 'jpeg') => {
    const base = baseCanvasRef.current;
    if (!base) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasWidth;
    exportCanvas.height = canvasHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(base, 0, 0);
    const link = document.createElement('a');
    link.download = `draft-${Date.now()}.${format === 'png' ? 'png' : 'jpg'}`;
    link.href = format === 'png' ? exportCanvas.toDataURL('image/png') : exportCanvas.toDataURL('image/jpeg', 0.92);
    link.click();
    setIsDrawerOpen(false);
  };

  const handleToolClick = (tool: Tool) => {
    if (tool === 'pencil' || tool === 'eraser') {
      if (activeTool === tool) setActivePopover(activePopover === tool ? null : tool);
      else { setActiveTool(tool); setActivePopover(null); }
      return;
    }
    if (tool === 'bucket' || tool === 'hand') {
      setActiveTool(tool);
      setActivePopover(null);
      return;
    }
    // Shape tools handled separately via press-and-hold
    if (isShapeTool(tool) && !isShapeMenuOpen) {
      setActivePopover(activePopover === 'shape' ? null : 'shape');
    }
  };

  // Shape button: press-and-hold opens the submenu
  const handleShapeButtonMouseDown = (e: React.MouseEvent) => {
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

  const handleShapeItemMouseEnter = (shape: ShapeTool) => {
    if (!shapeWasMenuOpenedRef.current) return;
    setHoveredShape(shape);
    hoveredShapeRef.current = shape;
  };

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  const currentShapeForIcon: ShapeTool = isShapeTool(activeTool) ? activeTool : lastShapeTool;
  const CurrentShapeIcon = SHAPE_TOOLS.find(s => s.id === currentShapeForIcon)!.Icon;

  const bgMain = isDark ? 'bg-zinc-950' : 'bg-zinc-100';
  const bgPanel = isDark ? 'bg-zinc-900' : 'bg-white';
  const bgPanelHover = isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100';
  const textMain = isDark ? 'text-neutral-100' : 'text-neutral-900';
  const textMuted = isDark ? 'text-neutral-500' : 'text-neutral-400';
  const borderMain = isDark ? 'border-zinc-800' : 'border-zinc-200';
  const viewportBg = isDark ? 'bg-zinc-900' : 'bg-zinc-200';
  const inputBg = isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-300';
  const toolbarBg = isDark ? 'bg-zinc-900' : 'bg-white';
  const toolbarBtn = isDark
    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-zinc-800'
    : 'text-neutral-500 hover:text-neutral-800 hover:bg-zinc-100';
  const toolbarBtnActive = isDark
    ? 'bg-zinc-800 text-white border border-zinc-700'
    : 'bg-zinc-200 text-neutral-900 border border-zinc-400';

  return (
    <div className={`relative w-screen h-screen ${bgMain} ${textMain} font-sans select-none overflow-hidden`}>
      
      <button
        onClick={() => setIsDrawerOpen(true)}
        className={`absolute top-4 left-4 z-50 w-10 h-10 ${bgPanel} ${bgPanelHover} rounded-lg border ${borderMain} flex items-center justify-center shadow-lg transition-colors`}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div
        onClick={() => setIsDrawerOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`fixed top-0 left-0 z-[70] h-full w-64 ${bgPanel} border-r ${borderMain} shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className={`flex items-center justify-between px-4 py-4 border-b ${borderMain}`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${isDark ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'} flex items-center justify-center`}>
              <Pencil className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm">Draft</span>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className={`w-8 h-8 rounded-lg ${bgPanelHover} flex items-center justify-center ${textMuted}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
          <DrawerItem icon={Download} label="Save PNG" onClick={() => exportImage('png')} isDark={isDark} />
          <DrawerItem icon={Download} label="Save JPEG" onClick={() => exportImage('jpeg')} isDark={isDark} />
          <div className={`my-2 border-t ${borderMain}`} />
          <DrawerItem
            icon={isDark ? Sun : Moon}
            label={isDark ? 'Light theme' : 'Dark theme'}
            onClick={toggleTheme}
            isDark={isDark}
          />
          <DrawerItem
            icon={Trash2}
            label="Clear canvas"
            onClick={() => { setHistory([]); setRedoStack([]); setHistoryVersion(v => v + 1); setIsDrawerOpen(false); }}
            isDark={isDark}
            danger
          />
        </div>

        <div className={`px-4 py-3 border-t ${borderMain} text-[10px] font-mono ${textMuted} flex justify-between`}>
          <span>{canvasWidth}×{canvasHeight}</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
      </aside>

      <aside className="absolute top-1/2 -translate-y-1/2 left-4 z-30">
        <div className={`${toolbarBg} border ${borderMain} rounded-xl p-1.5 shadow-2xl flex flex-col gap-1`}>

          {/* Pencil */}
          <div className="relative">
            <button
              onClick={() => handleToolClick('pencil')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeTool === 'pencil' ? toolbarBtnActive : toolbarBtn}`}
            >
              <Pencil className="w-5 h-5" />
            </button>
            {activePopover === 'pencil' && (
              <Popover borderMain={borderMain} textMuted={textMuted} isDark={isDark}>
                <div className={`flex justify-between text-xs mb-2 ${textMuted}`}>
                  <span>Size</span>
                  <span className="font-mono">{pencilSize}px</span>
                </div>
                <input type="range" min="1" max="60" value={pencilSize}
                  onChange={(e) => setPencilSize(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  style={{ background: isDark ? '#3f3f46' : '#d4d4d8' }}
                />
              </Popover>
            )}
          </div>

          {/* Shape picker — press-and-hold to open submenu */}
          <div className="relative">
            <button
              onMouseDown={handleShapeButtonMouseDown}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all ${isShapeTool(activeTool) ? toolbarBtnActive : toolbarBtn}`}
              title="Shape tools (hold to open)"
            >
              <CurrentShapeIcon className="w-5 h-5" />
              <ChevronRight
                className="absolute bottom-0.5 right-0.5 w-3 h-3 text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
                strokeWidth={3}
              />
            </button>

            {/* Shape submenu (opened on hold, selection on hover + release) */}
            {isShapeMenuOpen && (
              <div
                ref={shapeMenuRef}
                className={`absolute left-14 top-0 ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${borderMain} rounded-lg p-1.5 shadow-2xl z-40 flex flex-col gap-0.5`}
              >
                {SHAPE_TOOLS.map(({ id, label, Icon }) => {
                  const isHovered = hoveredShape === id;
                  const isCurrent = activeTool === id;
                  return (
                    <div
                      key={id}
                      onMouseEnter={() => handleShapeItemMouseEnter(id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        isHovered
                          ? 'bg-indigo-500 text-white'
                          : isCurrent
                            ? isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-neutral-900'
                            : isDark ? 'text-neutral-300' : 'text-neutral-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Shape settings popover (short-click on active shape) */}
            {activePopover === 'shape' && isShapeTool(activeTool) && !isShapeMenuOpen && (
              <Popover borderMain={borderMain} textMuted={textMuted} isDark={isDark}>
                <div className={`flex justify-between text-xs mb-2 ${textMuted}`}>
                  <span>Line</span>
                  <span className="font-mono">{shapeSize}px</span>
                </div>
                <input type="range" min="1" max="40" value={shapeSize}
                  onChange={(e) => setShapeSize(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  style={{ background: isDark ? '#3f3f46' : '#d4d4d8' }}
                />
                {['rectangle', 'circle', 'triangle'].includes(activeTool) && (
                  <button onClick={() => setIsShapeFilled(!isShapeFilled)}
                    className={`mt-3 w-full px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      isShapeFilled ? 'bg-indigo-500 text-white'
                        : isDark ? 'bg-zinc-800 text-neutral-300' : 'bg-zinc-100 text-neutral-700'
                    }`}>
                    {isShapeFilled ? 'Filled' : 'Outline'}
                  </button>
                )}
              </Popover>
            )}
          </div>

          {/* Eraser */}
          <div className="relative">
            <button onClick={() => handleToolClick('eraser')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeTool === 'eraser' ? toolbarBtnActive : toolbarBtn}`}>
              <Eraser className="w-5 h-5" />
            </button>
            {activePopover === 'eraser' && (
              <Popover borderMain={borderMain} textMuted={textMuted} isDark={isDark}>
                <div className={`flex justify-between text-xs mb-2 ${textMuted}`}>
                  <span>Size</span>
                  <span className="font-mono">{eraserSize}px</span>
                </div>
                <input type="range" min="4" max="120" value={eraserSize}
                  onChange={(e) => setEraserSize(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  style={{ background: isDark ? '#3f3f46' : '#d4d4d8' }}
                />
              </Popover>
            )}
          </div>

          {/* Bucket */}
          <button onClick={() => handleToolClick('bucket')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeTool === 'bucket' ? toolbarBtnActive : toolbarBtn}`}>
            <PaintBucket className="w-5 h-5" />
          </button>

          {/* Color */}
          <div className="relative">
            <button
              onClick={() => { setActivePopover(activePopover === 'color' ? null : 'color'); setIsShapeMenuOpen(false); }}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activePopover === 'color' ? toolbarBtnActive : toolbarBtn}`}
            >
              <div className={`w-6 h-6 rounded-md border ${borderMain}`} style={{ backgroundColor: selectedColor }} />
            </button>
            {activePopover === 'color' && (
              <div className={`absolute left-14 bottom-0 ${bgPanel} border ${borderMain} rounded-xl p-3 shadow-2xl w-60 z-50 flex flex-col gap-3`}>
                <div className={`relative w-full h-32 rounded-md overflow-hidden border ${borderMain} cursor-crosshair`}>
                  <canvas ref={satValRef} width={216} height={128}
                    onMouseDown={(e) => { setIsSatValDragging(true); handleSatValMove(e.clientX, e.clientY); }}
                    className="w-full h-full block" />
                  <div className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: selectedColor }} />
                </div>
                <div className={`relative w-full h-3 rounded-md overflow-hidden border ${borderMain} cursor-pointer`}>
                  <canvas ref={hueRef} width={216} height={12}
                    onMouseDown={(e) => { setIsHueDragging(true); handleHueMove(e.clientX); }}
                    className="w-full h-full block" />
                  <div className="absolute top-0 bottom-0 w-1.5 border border-white shadow bg-neutral-200 pointer-events-none -translate-x-1/2"
                    style={{ left: `${(hsv.h / 360) * 100}%` }} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-8 ${textMuted} font-mono`}>HEX</span>
                  <input type="text" value={hexInput} onChange={handleHexInputChange}
                    className={`flex-1 ${inputBg} border rounded px-2 py-1 font-mono ${textMain} focus:outline-none focus:border-indigo-500 uppercase`} />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-8 ${textMuted} font-mono`}>RGB</span>
                  <div className="flex gap-1 flex-1">
                    {(['r', 'g', 'b'] as const).map((ch) => (
                      <input key={ch} type="text" value={rgbInput[ch]}
                        onChange={(e) => handleRgbInputChange(ch, e.target.value)}
                        className={`w-full ${inputBg} border rounded px-1 py-1 text-center font-mono ${textMain} focus:outline-none focus:border-indigo-500`} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hand */}
          <button onClick={() => handleToolClick('hand')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeTool === 'hand' ? toolbarBtnActive : toolbarBtn}`}>
            <Hand className="w-5 h-5" />
          </button>

          <div className={`my-0.5 border-t ${borderMain}`} />

          <button onClick={handleUndo} disabled={history.length === 0}
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${toolbarBtn} disabled:opacity-30 disabled:hover:bg-transparent transition-colors`}>
            <Undo2 className="w-5 h-5" />
          </button>
          <button onClick={handleRedo} disabled={redoStack.length === 0}
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${toolbarBtn} disabled:opacity-30 disabled:hover:bg-transparent transition-colors`}>
            <Redo2 className="w-5 h-5" />
          </button>
        </div>
      </aside>

      <main
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => setIsHoveringViewport(true)}
        onMouseLeave={() => setIsHoveringViewport(false)}
        className={`w-full h-full overflow-hidden ${viewportBg} ${
          isPanning || activeTool === 'hand' || isSpacePressed
            ? isPanning ? 'cursor-grabbing' : 'cursor-grab'
            : activeTool === 'eraser' || activeTool === 'pencil' ? 'cursor-none' : 'cursor-crosshair'
        }`}
      >
        <div
          className="absolute origin-top-left will-change-transform"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            width: canvasWidth,
            height: canvasHeight
          }}
        >
          <canvas
            ref={baseCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className={`bg-white block w-full h-full shadow-2xl border ${isDark ? 'border-zinc-800' : 'border-zinc-400/60'}`}
          />
          <canvas
            ref={overlayCanvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />

          {activeTool === 'eraser' && isHoveringViewport && !isPanning && (
            <div
              className="absolute pointer-events-none rounded-full border border-black ring-1 ring-white/90 -translate-x-1/2 -translate-y-1/2"
              style={{ left: cursorPos.x, top: cursorPos.y, width: eraserSize, height: eraserSize }}
            />
          )}

          {activeTool === 'pencil' && isHoveringViewport && !isPanning && (
            <div
              className="absolute pointer-events-none rounded-full border border-black ring-1 ring-white/90 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: cursorPos.x, top: cursorPos.y,
                width: Math.max(4, pencilSize), height: Math.max(4, pencilSize),
                backgroundColor: selectedColor
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Popover({
  children, isDark, borderMain
}: {
  children: React.ReactNode; isDark: boolean; borderMain: string; textMuted?: string;
}) {
  return (
    <div className={`absolute left-14 top-0 ${isDark ? 'bg-zinc-900' : 'bg-white'} border ${borderMain} rounded-lg p-3 shadow-2xl w-48 z-40`}>
      {children}
    </div>
  );
}

function DrawerItem({
  icon: Icon, label, onClick, isDark, danger
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; onClick: () => void; isDark: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
        danger
          ? isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
          : isDark ? 'text-neutral-300 hover:bg-zinc-800' : 'text-neutral-700 hover:bg-zinc-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}