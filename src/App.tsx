import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Pencil, 
  Eraser, 
  PaintBucket, 
  Hand, 
  Undo2, 
  Redo2, 
  Menu, 
  Download, 
  X
} from 'lucide-react';

type Tool = 'pencil' | 'eraser' | 'bucket' | 'hand';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  type: 'stroke';
  tool: 'pencil' | 'eraser';
  points: Point[];
  color: string;
  size: number;
}

interface FillAction {
  type: 'fill';
  x: number;
  y: number;
  color: string;
}

type CanvasAction = Stroke | FillAction;

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => {
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

const hsvToRgb = (h: number, s: number, v: number): { r: number; g: number; b: number } => {
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
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
};

export default function App() {
  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;

  // Viewport State
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  // Tool State
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [pencilSize, setPencilSize] = useState<number>(4);
  const [eraserSize, setEraserSize] = useState<number>(24);
  const [selectedColor, setSelectedColor] = useState<string>('#1E293B');

  // Popover UI State
  const [activePopover, setActivePopover] = useState<'pencil' | 'eraser' | 'color' | 'menu' | null>(null);

  // HSV & Color Picker State
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>({ h: 215, s: 80, v: 23 });
  const [hexInput, setHexInput] = useState<string>('#1E293B');
  const [rgbInput, setRgbInput] = useState<{ r: string; g: string; b: string }>({ r: '30', g: '41', b: '59' });

  // Cursor & Mouse State
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const [isHoveringViewport, setIsHoveringViewport] = useState<boolean>(false);

  // Pan Interaction States
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Spectrum Dragging States
  const [isSatValDragging, setIsSatValDragging] = useState<boolean>(false);
  const [isHueDragging, setIsHueDragging] = useState<boolean>(false);

  // Path History
  const [history, setHistory] = useState<CanvasAction[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasAction[]>([]);
  const currentStrokeRef = useRef<Point[]>([]);

  // Canvas & Container Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const satValRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: (rect.width - A4_WIDTH * 0.85) / 2,
        y: Math.max(20, (rect.height - A4_HEIGHT * 0.85) / 2)
      });
    }
  }, []);

  const updateFromHsv = useCallback((newHsv: { h: number; s: number; v: number }) => {
    setHsv(newHsv);
    const { r, g, b } = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    const hex = rgbToHex(r, g, b);
    setSelectedColor(hex);
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
        rNum >= 0 && rNum <= 255 &&
        gNum >= 0 && gNum <= 255 &&
        bNum >= 0 && bNum <= 255) {
      const hex = rgbToHex(rNum, gNum, bNum);
      setSelectedColor(hex);
      setHexInput(hex);
      setHsv(rgbToHsv(rNum, gNum, bNum));
    }
  };

  function executeFloodFill(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColor: string) {
    if (startX < 0 || startX >= A4_WIDTH || startY < 0 || startY >= A4_HEIGHT) return;

    const imgData = ctx.getImageData(0, 0, A4_WIDTH, A4_HEIGHT);
    const data = imgData.data;

    const targetRgb = hexToRgb(fillColor);
    if (!targetRgb) return;

    const startPos = (startY * A4_WIDTH + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    if (startR === targetRgb.r && startG === targetRgb.g && startB === targetRgb.b && startA === 255) {
      return;
    }

    const colorMatch = (pos: number) => {
      return Math.abs(data[pos] - startR) < 15 &&
             Math.abs(data[pos + 1] - startG) < 15 &&
             Math.abs(data[pos + 2] - startB) < 15 &&
             Math.abs(data[pos + 3] - startA) < 15;
    };

    const pixelStack: [number, number][] = [[startX, startY]];

    while (pixelStack.length > 0) {
      const [x, y] = pixelStack.pop()!;
      let currentY = y;

      while (currentY >= 0 && colorMatch((currentY * A4_WIDTH + x) * 4)) {
        currentY--;
      }
      currentY++;

      let reachLeft = false;
      let reachRight = false;

      while (currentY < A4_HEIGHT && colorMatch((currentY * A4_WIDTH + x) * 4)) {
        const p = (currentY * A4_WIDTH + x) * 4;
        data[p] = targetRgb.r;
        data[p + 1] = targetRgb.g;
        data[p + 2] = targetRgb.b;
        data[p + 3] = 255;

        if (x > 0) {
          if (colorMatch((currentY * A4_WIDTH + (x - 1)) * 4)) {
            if (!reachLeft) {
              pixelStack.push([x - 1, currentY]);
              reachLeft = true;
            }
          } else if (reachLeft) {
            reachLeft = false;
          }
        }

        if (x < A4_WIDTH - 1) {
          if (colorMatch((currentY * A4_WIDTH + (x + 1)) * 4)) {
            if (!reachRight) {
              pixelStack.push([x + 1, currentY]);
              reachRight = true;
            }
          } else if (reachRight) {
            reachRight = false;
          }
        }

        currentY++;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

    history.forEach((action) => {
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
      } else if (action.type === 'fill') {
        executeFloodFill(ctx, Math.round(action.x), Math.round(action.y), action.color);
      }
    });

    if (isMouseDown && currentStrokeRef.current.length > 0 && (activeTool === 'pencil' || activeTool === 'eraser')) {
      const points = currentStrokeRef.current;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const size = activeTool === 'pencil' ? pencilSize : eraserSize;

      if (activeTool === 'eraser') {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = size;
      } else {
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = size;
      }

      if (points.length === 1) {
        ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = activeTool === 'eraser' ? '#FFFFFF' : selectedColor;
        ctx.fill();
      } else {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
      }
    }
  }, [history, isMouseDown, activeTool, pencilSize, eraserSize, selectedColor]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

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

    const s = (x / rect.width) * 100;
    const v = (1 - y / rect.height) * 100;
    updateFromHsv({ ...hsv, s, v });
  }, [hsv, updateFromHsv]);

  const handleHueMove = useCallback((clientX: number) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const h = (x / rect.width) * 360;
    updateFromHsv({ ...hsv, h });
  }, [hsv, updateFromHsv]);

  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsSatValDragging(false);
      setIsHueDragging(false);
    };

    const handleMouseMoveGlobal = (e: MouseEvent) => {
      if (isSatValDragging) {
        handleSatValMove(e.clientX, e.clientY);
      }
      if (isHueDragging) {
        handleHueMove(e.clientX);
      }
    };

    window.addEventListener('mouseup', handleMouseUpGlobal);
    window.addEventListener('mousemove', handleMouseMoveGlobal);
    return () => {
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
    };
  }, [isSatValDragging, isHueDragging, handleSatValMove, handleHueMove]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const lastAction = newHistory.pop()!;
    setHistory(newHistory);
    setRedoStack((prev) => [...prev, lastAction]);
  }, [history]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const newRedo = [...redoStack];
    const actionToRestore = newRedo.pop()!;
    setRedoStack(newRedo);
    setHistory((prev) => [...prev, actionToRestore]);
  }, [redoStack]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const code = e.code;

      if (isCtrlOrCmd) {
        if ((code === 'KeyZ' || key === 'z' || key === 'я') && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if (
          (code === 'KeyY' || key === 'y' || key === 'н') ||
          ((code === 'KeyZ' || key === 'z' || key === 'я') && e.shiftKey)
        ) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo, isSpacePressed]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLDivElement>): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    return {
      x: (clientX - pan.x) / zoom,
      y: (clientY - pan.y) / zoom
    };
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.max(0.15, Math.min(5.0, zoom * zoomFactor));

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setPan({
      x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
      y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
    });
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isMiddleClick = e.button === 1;
    const isHandMode = activeTool === 'hand' || isSpacePressed || isMiddleClick;

    if (isHandMode) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return;

    const pt = getCanvasCoordinates(e);
    setIsMouseDown(true);

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      currentStrokeRef.current = [pt];
    } else if (activeTool === 'bucket') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        setHistory((prev) => [
          ...prev,
          { type: 'fill', x: Math.round(pt.x), y: Math.round(pt.y), color: selectedColor }
        ]);
        setRedoStack([]);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const pt = getCanvasCoordinates(e);
    setCursorPos(pt);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    if (isMouseDown && (activeTool === 'pencil' || activeTool === 'eraser')) {
      currentStrokeRef.current.push(pt);
      redrawCanvas();
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isMouseDown && (activeTool === 'pencil' || activeTool === 'eraser')) {
      if (currentStrokeRef.current.length > 0) {
        const newStroke: Stroke = {
          type: 'stroke',
          tool: activeTool,
          points: [...currentStrokeRef.current],
          color: selectedColor,
          size: activeTool === 'pencil' ? pencilSize : eraserSize
        };
        setHistory((prev) => [...prev, newStroke]);
        setRedoStack([]);
      }
    }
    setIsMouseDown(false);
    currentStrokeRef.current = [];
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `drawing-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setActivePopover(null);
  };

  const handleExportJPEG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `drawing-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
    setActivePopover(null);
  };

  const handleToolClick = (tool: Tool) => {
    if (activeTool === tool && (tool === 'pencil' || tool === 'eraser')) {
      setActivePopover(activePopover === tool ? null : tool);
    } else {
      setActiveTool(tool);
      setActivePopover(null);
    }
  };

  const handleToolDoubleClick = (tool: Tool) => {
    if (tool === 'pencil' || tool === 'eraser') {
      setActiveTool(tool);
      setActivePopover(tool);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-zinc-300 text-neutral-100 font-sans select-none overflow-hidden flex flex-col">
      
      {/* Top Left Menu (Clear Sheet option removed) */}
      <header className="absolute top-4 left-4 z-30">
        <div className="relative">
          <button
            onClick={() => setActivePopover(activePopover === 'menu' ? null : 'menu')}
            className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 flex items-center justify-center shadow-lg transition-colors"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {activePopover === 'menu' && (
            <div className="absolute top-12 left-0 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-2xl p-1.5 z-40 text-sm">
              <button
                onClick={handleExportPNG}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-neutral-200 hover:bg-neutral-700 rounded-md transition-colors"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Save as PNG</span>
              </button>
              <button
                onClick={handleExportJPEG}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-neutral-200 hover:bg-neutral-700 rounded-md transition-colors"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Save as JPEG</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Floating Left Toolbar */}
      <aside className="absolute top-1/2 -translate-y-1/2 left-4 z-30 flex flex-col gap-2">
        <div className="bg-neutral-800/95 border border-neutral-700 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1.5 backdrop-blur-sm">
          
          {/* Pencil Tool */}
          <div className="relative">
            <button
              onClick={() => handleToolClick('pencil')}
              onDoubleClick={() => handleToolDoubleClick('pencil')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'pencil'
                  ? 'bg-neutral-700 text-white border border-neutral-500 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
              }`}
              title="Pencil (Double click for size)"
            >
              <Pencil className="w-5 h-5" />
            </button>

            {activePopover === 'pencil' && (
              <div className="absolute left-14 top-0 bg-neutral-800 border border-neutral-700 rounded-lg p-3 shadow-2xl w-48 z-40">
                <div className="flex items-center justify-between text-xs text-neutral-300 mb-2 font-medium">
                  <span>Stroke Size</span>
                  <span className="font-mono">{pencilSize}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={pencilSize}
                  onChange={(e) => setPencilSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-neutral-200"
                />
                <div className="mt-3 flex items-center justify-center h-12 bg-neutral-900 border border-neutral-700/50 rounded-md overflow-hidden">
                  <div
                    className="rounded-full transition-all"
                    style={{
                      width: `${Math.min(pencilSize, 40)}px`,
                      height: `${Math.min(pencilSize, 40)}px`,
                      backgroundColor: selectedColor
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Eraser Tool */}
          <div className="relative">
            <button
              onClick={() => handleToolClick('eraser')}
              onDoubleClick={() => handleToolDoubleClick('eraser')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                activeTool === 'eraser'
                  ? 'bg-neutral-700 text-white border border-neutral-500 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
              }`}
              title="Eraser (Double click for size)"
            >
              <Eraser className="w-5 h-5" />
            </button>

            {activePopover === 'eraser' && (
              <div className="absolute left-14 top-0 bg-neutral-800 border border-neutral-700 rounded-lg p-3 shadow-2xl w-48 z-40">
                <div className="flex items-center justify-between text-xs text-neutral-300 mb-2 font-medium">
                  <span>Eraser Size</span>
                  <span className="font-mono">{eraserSize}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="120"
                  value={eraserSize}
                  onChange={(e) => setEraserSize(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-neutral-200"
                />
                <div className="mt-3 flex items-center justify-center h-12 bg-neutral-900 border border-neutral-700/50 rounded-md overflow-hidden">
                  <div
                    className="rounded-full border border-neutral-400 transition-all bg-transparent"
                    style={{
                      width: `${Math.min(eraserSize, 40)}px`,
                      height: `${Math.min(eraserSize, 40)}px`
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bucket Fill */}
          <button
            onClick={() => handleToolClick('bucket')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              activeTool === 'bucket'
                ? 'bg-neutral-700 text-white border border-neutral-500 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
            }`}
            title="Flood Fill"
          >
            <PaintBucket className="w-5 h-5" />
          </button>

          {/* Color Picker Toggle */}
          <div className="relative">
            <button
              onClick={() => setActivePopover(activePopover === 'color' ? null : 'color')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center relative transition-all ${
                activePopover === 'color'
                  ? 'bg-neutral-700 border border-neutral-500'
                  : 'hover:bg-neutral-700/50'
              }`}
              title="Color Palette"
            >
              <div
                className="w-6 h-6 rounded-md border border-neutral-600 shadow-inner"
                style={{ backgroundColor: selectedColor }}
              />
            </button>

            {activePopover === 'color' && (
              <div className="absolute left-14 bottom-0 bg-neutral-800 border border-neutral-700 rounded-xl p-3.5 shadow-2xl w-64 z-50 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                  <span>Color Selector</span>
                  <button
                    onClick={() => setActivePopover(null)}
                    className="text-neutral-400 hover:text-neutral-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative w-full h-36 rounded-md overflow-hidden border border-neutral-700 cursor-crosshair">
                  <canvas
                    ref={satValRef}
                    width={232}
                    height={144}
                    onMouseDown={(e) => {
                      setIsSatValDragging(true);
                      handleSatValMove(e.clientX, e.clientY);
                    }}
                    className="w-full h-full block"
                  />
                  <div
                    className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${hsv.s}%`,
                      top: `${100 - hsv.v}%`,
                      backgroundColor: selectedColor
                    }}
                  />
                </div>

                <div className="relative w-full h-4 rounded-md overflow-hidden border border-neutral-700 cursor-pointer">
                  <canvas
                    ref={hueRef}
                    width={232}
                    height={16}
                    onMouseDown={(e) => {
                      setIsHueDragging(true);
                      handleHueMove(e.clientX);
                    }}
                    className="w-full h-full block"
                  />
                  <div
                    className="absolute top-0 bottom-0 w-2 border border-white shadow bg-neutral-200 pointer-events-none -translate-x-1/2"
                    style={{ left: `${(hsv.h / 360) * 100}%` }}
                  />
                </div>

                <div className="flex flex-col gap-2 pt-1 border-t border-neutral-700/60 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-neutral-400 font-mono">HEX</span>
                    <input
                      type="text"
                      value={hexInput}
                      onChange={handleHexInputChange}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-mono text-neutral-200 focus:outline-none focus:border-neutral-500 uppercase"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-neutral-400 font-mono">RGB</span>
                    <div className="flex gap-1.5 flex-1">
                      <input
                        type="text"
                        value={rgbInput.r}
                        onChange={(e) => handleRgbInputChange('r', e.target.value)}
                        placeholder="R"
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-center font-mono text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                      <input
                        type="text"
                        value={rgbInput.g}
                        onChange={(e) => handleRgbInputChange('g', e.target.value)}
                        placeholder="G"
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-center font-mono text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                      <input
                        type="text"
                        value={rgbInput.b}
                        onChange={(e) => handleRgbInputChange('b', e.target.value)}
                        placeholder="B"
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1 text-center font-mono text-neutral-200 focus:outline-none focus:border-neutral-500"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Pan / Hand Tool */}
          <button
            onClick={() => handleToolClick('hand')}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              activeTool === 'hand'
                ? 'bg-neutral-700 text-white border border-neutral-500 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
            }`}
            title="Hand Tool (Pan Sheet)"
          >
            <Hand className="w-5 h-5" />
          </button>

          <div className="my-0.5 border-t border-neutral-700/80" />

          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5" />
          </button>

          {/* Redo */}
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-5 h-5" />
          </button>

        </div>
      </aside>

      {/* Main Viewport Workspace with Gray Canvas Background */}
      <main
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => setIsHoveringViewport(true)}
        onMouseLeave={() => setIsHoveringViewport(false)}
        className={`flex-1 relative w-full h-full overflow-hidden bg-zinc-300 ${
          isPanning || activeTool === 'hand' || isSpacePressed
            ? isPanning ? 'cursor-grabbing' : 'cursor-grab'
            : activeTool === 'eraser' || activeTool === 'pencil' ? 'cursor-none' : 'cursor-crosshair'
        }`}
      >
        <div
          className="absolute origin-top-left transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: `${A4_WIDTH}px`,
            height: `${A4_HEIGHT}px`
          }}
        >
          {/* White A4 Paper Sheet */}
          <canvas
            ref={canvasRef}
            width={A4_WIDTH}
            height={A4_HEIGHT}
            className="bg-white rounded-sm block w-full h-full shadow-2xl border border-zinc-400/80"
          />

          {/* Eraser Cursor Indicator (High Contrast Dual Outline) */}
          {activeTool === 'eraser' && isHoveringViewport && !isPanning && (
            <div
              className="absolute pointer-events-none rounded-full border border-black ring-1 ring-white/90 bg-transparent -translate-x-1/2 -translate-y-1/2 z-20 shadow-sm"
              style={{
                left: `${cursorPos.x}px`,
                top: `${cursorPos.y}px`,
                width: `${eraserSize}px`,
                height: `${eraserSize}px`
              }}
            />
          )}

          {/* Pencil Tool Cursor Indicator */}
          {activeTool === 'pencil' && isHoveringViewport && !isPanning && (
            <div
              className="absolute pointer-events-none rounded-full border border-black ring-1 ring-white/90 -translate-x-1/2 -translate-y-1/2 z-20"
              style={{
                left: `${cursorPos.x}px`,
                top: `${cursorPos.y}px`,
                width: `${Math.max(4, pencilSize)}px`,
                height: `${Math.max(4, pencilSize)}px`,
                backgroundColor: selectedColor
              }}
            />
          )}
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="absolute bottom-3 right-4 z-20 flex items-center gap-3 bg-neutral-800/90 border border-neutral-700 px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-300 shadow-lg backdrop-blur-sm">
        <span>A4 Sheet (794 × 1123)</span>
        <span className="text-neutral-600">|</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span className="text-neutral-600">|</span>
        <span className="text-neutral-400">Hold Space or Middle-Click to Pan</span>
      </footer>

    </div>
  );
}