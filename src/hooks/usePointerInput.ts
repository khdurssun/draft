import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Tool, ShapeTool, BrushType, Point, FreehandStroke, ShapeAction, EraserShape } from '../lib/types';
import { pointInPolygon, tracePolygon } from '../lib/geometry';
import { floodFill } from '../lib/floodFill';
import { drawActionToCtx } from '../lib/actions';
import { drawStrokeToCtx } from '../lib/brushes';
import { drawShapeToCtx } from '../lib/shapes';
import { rgbToHex, rgbToHsv } from '../lib/color';
import type { DiffBounds } from '../lib/history';

type LassoMode = 'draw' | 'selected' | 'move' | null;

const TEXTURED_BRUSHES: BrushType[] = [
  'airbrush', 'glow', 'watercolor', 'neon',
  'mist', 'smoke', 'cloud', 'aurora', 'fog',
  'spray', 'chalk', 'charcoal', 'crayon', 'bristle',
  'oil', 'pastel', 'sand', 'rust', 'concrete', 'wood', 'fabric',
  'sparkle', 'stars', 'confetti', 'bubbles', 'glitter',
  'frost', 'splatter', 'vine', 'leaves',
  'mosaic', 'rings', 'web', 'flame', 'galaxy',
];

const LONG_STROKE_THRESHOLD = 200;

export interface UsePointerInputArgs {
  activeToolRef: MutableRefObject<Tool>;
  selectedColorRef: MutableRefObject<string>;
  pencilSizeRef: MutableRefObject<number>;
  eraserSizeRef: MutableRefObject<number>;
  isShapeFilledRef: MutableRefObject<boolean>;
  brushTypeRef: MutableRefObject<BrushType>;
  brushOpacityRef: MutableRefObject<number>;
  eraserShapeRef: MutableRefObject<EraserShape>;
  fillOpacityRef: MutableRefObject<number>;
  zoomRef: MutableRefObject<number>;
  panRef: MutableRefObject<Point>;
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>;
  activeLayerIdRef: MutableRefObject<string>;
  frameOrderRef: MutableRefObject<string[]>;
  currentFrameRef: MutableRefObject<number>;

  baseCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  canvasWrapperRef: MutableRefObject<HTMLDivElement | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  cursorRingRef: MutableRefObject<HTMLDivElement | null>;
  previewCircleRef: MutableRefObject<HTMLDivElement | null>;
  previewSizeRef: MutableRefObject<number | null>;
  previewActiveRef: MutableRefObject<boolean>;

  lassoPathRef: MutableRefObject<Point[]>;
  lassoPolyRef: MutableRefObject<Point[]>;
  lassoBufferRef: MutableRefObject<HTMLCanvasElement | null>;
  lassoBBoxRef: MutableRefObject<Point>;
  lassoOffsetRef: MutableRefObject<Point>;
  lassoModeRef: MutableRefObject<LassoMode>;
  lassoMoveStartRef: MutableRefObject<Point | null>;
  lassoPreSnapshotRef: MutableRefObject<ImageData | null>;

  prevTool: Tool;

  /** Текущий shape-tool, к которому переключаться по хоткею W. */
  lastShapeToolRef: MutableRefObject<ShapeTool>;

  /** true, если сейчас в App.tsx активен режим редактирования картинки. */
  hasImageTransformRef: MutableRefObject<boolean>;

  renderComposite: () => void;
  getCurrentFrameId: () => string | null;
  getFrameCanvasById: (layerId: string, frameId: string) => HTMLCanvasElement | null;

  findLayer: (id: string) => { id: string; name: string; visible: boolean; locked: boolean } | null;
  selectFrame: (idx: number) => void;
  addFrame: () => void;
  deleteFrame: () => void;
  bumpThumbs: () => void;
  bumpTimeline: () => void;

  snapshot: (layerId: string, frameId: string) => ImageData | null;
  pushHistory: (
    layerId: string,
    frameId: string,
    before: ImageData | null,
    after: ImageData | null,
    label: string,
    bounds?: DiffBounds | null,
  ) => void;
  commitLasso: (label?: string) => void;
  cancelLasso: () => void;
  clearLassoState: () => void;
  undo: () => void;
  redo: () => void;

  onCommitImageTransform: () => void;
  onCancelImageTransform: () => void;

  /** Хоткей переключения инструмента. Принимает конкретный Tool. */
  onToolShortcut: (tool: Tool) => void;
  /** Ctrl+Alt+N → New Project. */
  onNewProjectShortcut: () => void;

  setSelectedColor: (v: string) => void;
  setHexInput: (v: string) => void;
  setRgbInput: (v: { r: string; g: string; b: string }) => void;
  setHsv: (v: { h: number; s: number; v: number }) => void;
  setActiveTool: (v: Tool) => void;
  setActiveMenu: (v: 'file' | 'render' | null) => void;
  setActivePopover: (v: 'pencil' | 'eraser' | 'shape' | 'color' | 'bucket' | null) => void;
  setIsShapeMenuOpen: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowNewProject: (v: boolean) => void;
  setExportOpen: (v: boolean) => void;
  setHasSelection: (v: boolean) => void;

  onTogglePlayback: () => void;
}

export function usePointerInput({
  activeToolRef, selectedColorRef, pencilSizeRef, eraserSizeRef,
  isShapeFilledRef, brushTypeRef, brushOpacityRef, eraserShapeRef, fillOpacityRef,
  zoomRef, panRef, canvasSizeRef,
  activeLayerIdRef, frameOrderRef, currentFrameRef,
  baseCanvasRef, overlayCanvasRef, canvasWrapperRef, containerRef,
  cursorRingRef, previewCircleRef, previewSizeRef, previewActiveRef,
  lassoPathRef, lassoPolyRef, lassoBufferRef, lassoBBoxRef, lassoOffsetRef,
  lassoModeRef, lassoMoveStartRef, lassoPreSnapshotRef,
  prevTool,
  lastShapeToolRef,
  hasImageTransformRef,
  renderComposite, getCurrentFrameId, getFrameCanvasById,
  findLayer, selectFrame, addFrame, deleteFrame, bumpThumbs, bumpTimeline,
  snapshot, pushHistory, commitLasso, cancelLasso, clearLassoState, undo, redo,
  onCommitImageTransform, onCancelImageTransform,
  onToolShortcut, onNewProjectShortcut,
  setSelectedColor, setHexInput, setRgbInput, setHsv, setActiveTool,
  setActiveMenu, setActivePopover, setIsShapeMenuOpen,
  setShowSettings, setShowNewProject, setExportOpen, setHasSelection,
  onTogglePlayback,
}: UsePointerInputArgs) {
  const currentStrokeRef = useRef<Point[]>([]);
  const currentPressuresRef = useRef<number[]>([]);
  const shapeStartRef = useRef<Point | null>(null);
  const isMouseDownRef = useRef(false);
  const cursorPosRef = useRef<Point>({ x: 0, y: 0 });
  const shiftPressedRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const spacePressedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number; type: string }>>(new Map());
  const drawingPointerIdRef = useRef<number | null>(null);
  const pinchStartRef = useRef<{ distance: number; center: Point; zoom: number; pan: Point } | null>(null);
  const penActiveRef = useRef(false);
  const penReleaseTimerRef = useRef<number | null>(null);

  const spaceDownTimeRef = useRef<number>(0);
  const spaceUsedForPanRef = useRef(false);

  const skipNextRef = useRef<boolean>(false);
  const pendingRef = useRef<boolean>(false);
  const strokeBoundsRef = useRef<DiffBounds | null>(null);

  const isShapeTool = (tl: Tool): tl is ShapeTool =>
    tl === 'line' || tl === 'rectangle' || tl === 'circle' ||
    tl === 'triangle' || tl === 'star';

  const getCanvasPt = useCallback((cx: number, cy: number): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const r = containerRef.current.getBoundingClientRect();
    return {
      x: (cx - r.left - panRef.current.x) / zoomRef.current,
      y: (cy - r.top - panRef.current.y) / zoomRef.current,
    };
  }, [containerRef, panRef, zoomRef]);

  const updateStrokeBounds = useCallback((p: Point, radius: number) => {
    const cur = strokeBoundsRef.current;
    const pad = radius + 4;
    if (!cur) {
      strokeBoundsRef.current = { x: p.x - pad, y: p.y - pad, w: pad * 2, h: pad * 2 };
      return;
    }
    const x0 = Math.min(cur.x, p.x - pad);
    const y0 = Math.min(cur.y, p.y - pad);
    const x1 = Math.max(cur.x + cur.w, p.x + pad);
    const y1 = Math.max(cur.y + cur.h, p.y + pad);
    cur.x = x0; cur.y = y0; cur.w = x1 - x0; cur.h = y1 - y0;
  }, []);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = canvasSizeRef.current;
    ctx.clearRect(0, 0, w, h);

    const tool = activeToolRef.current;
    const mode = lassoModeRef.current;

    if (tool === 'lasso') {
      const lw = 1.5 / zoomRef.current;
      const dash = [6 / zoomRef.current, 4 / zoomRef.current];
      if (mode === 'draw' && lassoPathRef.current.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
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
        ctx.globalCompositeOperation = 'source-over';
        const base = baseCanvasRef.current;
        if (base) ctx.drawImage(base, 0, 0);
        ctx.globalCompositeOperation = 'destination-out';
        tracePolygon(ctx, poly);
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        if (lassoBufferRef.current) ctx.drawImage(lassoBufferRef.current, bbox.x + off.x, bbox.y + off.y);
        ctx.save();
        ctx.translate(off.x, off.y);
        tracePolygon(ctx, poly);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = lw;
        ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      return;
    }

    if (!isMouseDownRef.current) return;

    if (tool === 'pencil') {
      const pts = currentStrokeRef.current;
      if (pts.length === 0) return;
      drawStrokeToCtx(ctx, {
        type: 'stroke', tool: 'pencil', brush: brushTypeRef.current,
        points: pts,
        pressures: currentPressuresRef.current,
        color: selectedColorRef.current,
        size: pencilSizeRef.current,
        opacity: brushOpacityRef.current,
      }, false);
    } else if (tool === 'eraser') {
      const pts = currentStrokeRef.current;
      if (pts.length === 0) return;
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawStrokeToCtx(ctx, {
        type: 'stroke', tool: 'pencil', brush: eraserShapeRef.current,
        points: pts,
        pressures: currentPressuresRef.current,
        color: '#ef4444',
        size: eraserSizeRef.current,
      }, false);
      ctx.restore();
    } else if (shapeStartRef.current && isShapeTool(tool)) {
      drawShapeToCtx(ctx, {
        type: 'shape', tool,
        start: shapeStartRef.current,
        end: cursorPosRef.current,
        color: selectedColorRef.current,
        size: pencilSizeRef.current,
        isFilled: isShapeFilledRef.current,
        shiftKey: shiftPressedRef.current,
        brush: brushTypeRef.current,
      });
    }
  }, [
    overlayCanvasRef, canvasSizeRef, activeToolRef, lassoModeRef,
    lassoPathRef, zoomRef, lassoPolyRef, lassoOffsetRef, lassoBBoxRef,
    baseCanvasRef, lassoBufferRef, isMouseDownRef, currentStrokeRef,
    pencilSizeRef, eraserSizeRef, currentPressuresRef, brushTypeRef,
    brushOpacityRef, eraserShapeRef,
    selectedColorRef, shapeStartRef, cursorPosRef,
    isShapeFilledRef, shiftPressedRef,
  ]);

  const scheduleOverlay = useCallback(() => {
    if (rafRef.current !== null) {
      pendingRef.current = true;
      return;
    }
    const pts = currentStrokeRef.current;
    const isLong = pts.length >= LONG_STROKE_THRESHOLD;
    const shouldSkip = isLong && skipNextRef.current;
    skipNextRef.current = isLong ? !skipNextRef.current : false;

    if (shouldSkip) {
      pendingRef.current = true;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current) {
          pendingRef.current = false;
          scheduleOverlay();
        }
      });
      return;
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      pendingRef.current = false;
      drawOverlay();
    });
  }, [drawOverlay]);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const nz = Math.max(0.15, Math.min(5, zoomRef.current * factor));
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const np = {
      x: mx - (mx - panRef.current.x) * (nz / zoomRef.current),
      y: my - (my - panRef.current.y) * (nz / zoomRef.current),
    };
    panRef.current = np;
    zoomRef.current = nz;
    if (canvasWrapperRef.current) {
      canvasWrapperRef.current.style.transform = `translate3d(${np.x}px, ${np.y}px, 0) scale(${nz})`;
    }
    const ring = cursorRingRef.current;
    if (ring) {
      const size = activeToolRef.current === 'pencil' ? pencilSizeRef.current : activeToolRef.current === 'eraser' ? eraserSizeRef.current : 0;
      if (size > 0) { ring.style.width = `${size * nz}px`; ring.style.height = `${size * nz}px`; }
    }
    if (previewActiveRef.current && previewSizeRef.current !== null) {
      const pc = previewCircleRef.current;
      if (pc) {
        pc.style.width = `${previewSizeRef.current * nz}px`;
        pc.style.height = `${previewSizeRef.current * nz}px`;
      }
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hasImageTransformRef.current) return;

    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}
    if (e.pointerType !== 'mouse') e.preventDefault();

    const pointerWantsPan =
      e.button === 1 ||
      activeToolRef.current === 'hand' ||
      (spacePressedRef.current && e.pointerType === 'mouse');

    if (!pointerWantsPan) {
      isPanningRef.current = false;
      panStartRef.current = { x: 0, y: 0 };
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        spacePressedRef.current = false;
        spaceUsedForPanRef.current = false;
      }
    }

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });

    if (e.pointerType === 'touch' && penActiveRef.current) return;
    if (e.pointerType === 'touch') {
      for (const ptr of pointersRef.current.values()) if (ptr.type === 'pen') return;
    }
    if (e.pointerType === 'pen') {
      penActiveRef.current = true;
      if (penReleaseTimerRef.current) { clearTimeout(penReleaseTimerRef.current); penReleaseTimerRef.current = null; }
    }

    if (pointersRef.current.size === 2) {
      const ptrs = Array.from(pointersRef.current.values());
      const [a, b] = ptrs;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinchStartRef.current = { distance, center, zoom: zoomRef.current, pan: { ...panRef.current } };
      isMouseDownRef.current = false;
      isPanningRef.current = false;
      drawingPointerIdRef.current = null;
      currentStrokeRef.current = [];
      currentPressuresRef.current = [];
      shapeStartRef.current = null;
      if (lassoModeRef.current !== null) commitLasso('Lasso');
      scheduleOverlay();
      return;
    }
    if (pointersRef.current.size > 2) return;

    const isMiddle = e.button === 1;
    const tool = activeToolRef.current;
    const handMode = isMiddle || tool === 'hand' || (spacePressedRef.current && e.pointerType === 'mouse');

    if (handMode) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
      drawingPointerIdRef.current = e.pointerId;
      if (spacePressedRef.current) spaceUsedForPanRef.current = true;
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (tool === 'eyedropper') {
      const pt = getCanvasPt(e.clientX, e.clientY);
      const comp = baseCanvasRef.current;
      if (comp) {
        const ctx = comp.getContext('2d');
        if (ctx) {
          const sx = Math.round(pt.x), sy = Math.round(pt.y);
          if (sx >= 0 && sx < canvasSizeRef.current.w && sy >= 0 && sy < canvasSizeRef.current.h) {
            const px = ctx.getImageData(sx, sy, 1, 1).data;
            const hex = rgbToHex(px[0], px[1], px[2]);
            setSelectedColor(hex);
            selectedColorRef.current = hex;
            setHexInput(hex);
            setRgbInput({ r: String(px[0]), g: String(px[1]), b: String(px[2]) });
            setHsv(rgbToHsv(px[0], px[1], px[2]));
            setActiveTool(prevTool);
            activeToolRef.current = prevTool;
          }
        }
      }
      return;
    }

    const layer = findLayer(activeLayerIdRef.current);
    if (!layer || layer.locked || !layer.visible) return;

    const pt = getCanvasPt(e.clientX, e.clientY);
    drawingPointerIdRef.current = e.pointerId;
    isMouseDownRef.current = true;
    const pressure = e.pointerType === 'pen' ? Math.max(0.05, e.pressure) : 0.5;

    if (tool === 'pencil' || tool === 'eraser') {
      currentStrokeRef.current = [pt];
      currentPressuresRef.current = [pressure];
      skipNextRef.current = false;
      pendingRef.current = false;
      const size = tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current;
      strokeBoundsRef.current = { x: pt.x - size - 4, y: pt.y - size - 4, w: (size + 4) * 2, h: (size + 4) * 2 };
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
        commitLasso('Lasso');
      }
      const fid = getCurrentFrameId();
      lassoPreSnapshotRef.current = fid ? snapshot(activeLayerIdRef.current, fid) : null;
      lassoModeRef.current = 'draw';
      lassoPathRef.current = [pt];
      scheduleOverlay();
    } else if (tool === 'bucket') {
      const comp = baseCanvasRef.current;
      const fid = getCurrentFrameId();
      const lc = fid ? getFrameCanvasById(activeLayerIdRef.current, fid) : null;
      if (!comp || !lc || !fid) return;
      const compCtx = comp.getContext('2d');
      if (!compCtx) return;
      const before = snapshot(activeLayerIdRef.current, fid);
      const { w, h } = canvasSizeRef.current;
      const refData = compCtx.getImageData(0, 0, w, h).data;
      const lctx = lc.getContext('2d')!;
      floodFill(lctx, refData, pt.x, pt.y, selectedColorRef.current, w, h, fillOpacityRef.current);
      renderComposite();
      const after = snapshot(activeLayerIdRef.current, fid);
      pushHistory(activeLayerIdRef.current, fid, before, after, 'Fill');
      isMouseDownRef.current = false;
      drawingPointerIdRef.current = null;
      bumpThumbs(); bumpTimeline();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hasImageTransformRef.current) return;

    const p = pointersRef.current.get(e.pointerId);
    if (p) { p.x = e.clientX; p.y = e.clientY; }

    const ring = cursorRingRef.current;
    if (ring) {
      ring.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
    }

    if (!isMouseDownRef.current && !isPanningRef.current && pointersRef.current.size < 2) return;

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
        if (size > 0) { ring.style.width = `${size * newZoom}px`; ring.style.height = `${size * newZoom}px`; }
      }
      return;
    }

    if (e.pointerId !== drawingPointerIdRef.current) return;
    const pt = getCanvasPt(e.clientX, e.clientY);
    cursorPosRef.current = pt;

    if (isPanningRef.current) {
      const stillWantsPan =
        spacePressedRef.current ||
        activeToolRef.current === 'hand' ||
        e.buttons === 4;
      if (!stillWantsPan) {
        isPanningRef.current = false;
        drawingPointerIdRef.current = null;
        return;
      }

      const np = { x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y };
      panRef.current = np;
      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.style.transform = `translate3d(${np.x}px, ${np.y}px, 0) scale(${zoomRef.current})`;
      }
      if (spacePressedRef.current) spaceUsedForPanRef.current = true;
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
          y: lassoOffsetRef.current.y + dy,
        };
        scheduleOverlay();
        return;
      }
      return;
    }

    if (isMouseDownRef.current && (tool === 'pencil' || tool === 'eraser')) {
      const pressure = e.pointerType === 'pen' ? Math.max(0.05, e.pressure) : 0.5;
      currentStrokeRef.current.push(pt);
      currentPressuresRef.current.push(pressure);
      const size = tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current;
      updateStrokeBounds(pt, size);
      scheduleOverlay();
    } else if (isMouseDownRef.current && shapeStartRef.current) {
      scheduleOverlay();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    pointersRef.current.delete(e.pointerId);
    if (e.pointerType === 'pen') {
      if (penReleaseTimerRef.current) clearTimeout(penReleaseTimerRef.current);
      penReleaseTimerRef.current = window.setTimeout(() => {
        penActiveRef.current = false;
        penReleaseTimerRef.current = null;
      }, 600);
    }
    if (pointersRef.current.size < 2) pinchStartRef.current = null;

    isPanningRef.current = false;
    panStartRef.current = { x: 0, y: 0 };

    if (hasImageTransformRef.current) return;
    if (e.pointerId !== drawingPointerIdRef.current) return;

    const tool = activeToolRef.current;
    const fid = getCurrentFrameId();
    const lc = fid ? getFrameCanvasById(activeLayerIdRef.current, fid) : null;

    if (tool === 'lasso') {
      isMouseDownRef.current = false;
      const mode = lassoModeRef.current;
      if (mode === 'draw') {
        const path = lassoPathRef.current;
        if (path.length >= 3 && lc) {
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
          const bctx = buf.getContext('2d')!;
          bctx.save();
          bctx.translate(-minX, -minY);
          tracePolygon(bctx, path);
          bctx.clip();
          bctx.drawImage(lc, 0, 0);
          bctx.restore();
          const lctx = lc.getContext('2d')!;
          lctx.save();
          lctx.globalCompositeOperation = 'destination-out';
          tracePolygon(lctx, path);
          lctx.fillStyle = 'rgba(0,0,0,1)';
          lctx.fill();
          lctx.restore();
          lassoPolyRef.current = [...path];
          lassoBufferRef.current = buf;
          lassoBBoxRef.current = { x: minX, y: minY };
          lassoOffsetRef.current = { x: 0, y: 0 };
          lassoPathRef.current = [];
          lassoModeRef.current = 'selected';
          setHasSelection(true);
          renderComposite();
        } else {
          lassoPathRef.current = [];
          lassoModeRef.current = null;
        }
        scheduleOverlay();
      } else if (mode === 'move') {
        if (lc && lassoBufferRef.current && lassoPolyRef.current.length >= 3) {
          const lctx = lc.getContext('2d')!;
          lctx.drawImage(
            lassoBufferRef.current,
            lassoBBoxRef.current.x + lassoOffsetRef.current.x,
            lassoBBoxRef.current.y + lassoOffsetRef.current.y,
          );
          renderComposite();
        }
        const snap = lassoPreSnapshotRef.current;
        const lid = activeLayerIdRef.current;
        const after = fid ? snapshot(lid, fid) : null;
        if (snap && after && fid) pushHistory(lid, fid, snap, after, 'Lasso move');
        lassoPathRef.current = [];
        lassoPolyRef.current = [];
        lassoBufferRef.current = null;
        lassoBBoxRef.current = { x: 0, y: 0 };
        lassoOffsetRef.current = { x: 0, y: 0 };
        lassoModeRef.current = null;
        lassoMoveStartRef.current = null;
        lassoPreSnapshotRef.current = null;
        setHasSelection(false);
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
    if (!lc || !fid) {
      isMouseDownRef.current = false;
      currentStrokeRef.current = [];
      currentPressuresRef.current = [];
      shapeStartRef.current = null;
      drawingPointerIdRef.current = null;
      strokeBoundsRef.current = null;
      const o = overlayCanvasRef.current;
      if (o) {
        const { w, h } = canvasSizeRef.current;
        o.getContext('2d')?.clearRect(0, 0, w, h);
      }
      scheduleOverlay();
      return;
    }

    const lid = activeLayerIdRef.current;
    const before = snapshot(lid, fid);

    if (tool === 'pencil' || tool === 'eraser') {
      if (currentStrokeRef.current.length > 0) {
        const action: FreehandStroke = {
          type: 'stroke',
          tool,
          brush: tool === 'pencil' ? brushTypeRef.current : eraserShapeRef.current,
          points: [...currentStrokeRef.current],
          pressures: [...currentPressuresRef.current],
          color: selectedColorRef.current,
          size: tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current,
          opacity: tool === 'pencil' ? brushOpacityRef.current : 1,
        };
        drawActionToCtx(lc.getContext('2d')!, action);
        renderComposite();
        const after = snapshot(lid, fid);

        let bounds: DiffBounds | null = null;
        if (tool === 'eraser') {
          bounds = strokeBoundsRef.current;
        } else {
          const b = brushTypeRef.current;
          const isTextured = TEXTURED_BRUSHES.indexOf(b) !== -1;
          bounds = isTextured ? null : strokeBoundsRef.current;
        }
        pushHistory(lid, fid, before, after, tool, bounds);
        bumpThumbs(); bumpTimeline();
      }
    } else if (shapeStartRef.current && isShapeTool(tool)) {
      const action: ShapeAction = {
        type: 'shape',
        tool,
        start: shapeStartRef.current,
        end: cursorPosRef.current,
        color: selectedColorRef.current,
        size: pencilSizeRef.current,
        isFilled: isShapeFilledRef.current,
        shiftKey: shiftPressedRef.current,
        brush: brushTypeRef.current,
      };
      drawActionToCtx(lc.getContext('2d')!, action);
      renderComposite();
      const after = snapshot(lid, fid);
      pushHistory(lid, fid, before, after, 'Shape');
      bumpThumbs(); bumpTimeline();
    }

    isMouseDownRef.current = false;
    currentStrokeRef.current = [];
    currentPressuresRef.current = [];
    shapeStartRef.current = null;
    drawingPointerIdRef.current = null;
    strokeBoundsRef.current = null;
    skipNextRef.current = false;
    pendingRef.current = false;

    const o = overlayCanvasRef.current;
    if (o) {
      const { w, h } = canvasSizeRef.current;
      o.getContext('2d')?.clearRect(0, 0, w, h);
    }
    scheduleOverlay();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartRef.current = null;

    isPanningRef.current = false;
    panStartRef.current = { x: 0, y: 0 };

    if (e.pointerId === drawingPointerIdRef.current) {
      isMouseDownRef.current = false;
      currentStrokeRef.current = [];
      currentPressuresRef.current = [];
      shapeStartRef.current = null;
      drawingPointerIdRef.current = null;
      strokeBoundsRef.current = null;
      skipNextRef.current = false;
      pendingRef.current = false;
      const o = overlayCanvasRef.current;
      if (o) {
        const { w, h } = canvasSizeRef.current;
        o.getContext('2d')?.clearRect(0, 0, w, h);
      }
      scheduleOverlay();
    }
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      /* Image transform — приоритетная ветка. */
      if (hasImageTransformRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommitImageTransform();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancelImageTransform();
          return;
        }
        return;
      }

      if (e.key === 'Shift') shiftPressedRef.current = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!spacePressedRef.current) {
          spaceDownTimeRef.current = performance.now();
          spaceUsedForPanRef.current = false;
        }
        spacePressedRef.current = true;
      }

      /* ─── Hotkeys инструментов (без модификаторов, только физическая клавиша) ─── */
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        let hotkeyTool: Tool | null = null;
        switch (e.code) {
          case 'KeyQ': hotkeyTool = 'pencil'; break;
          case 'KeyW': hotkeyTool = lastShapeToolRef.current; break;
          case 'KeyE': hotkeyTool = 'eraser'; break;
          case 'KeyR': hotkeyTool = 'bucket'; break;
          case 'KeyT': hotkeyTool = 'eyedropper'; break;
          case 'KeyY': hotkeyTool = 'lasso'; break;
          case 'KeyU': hotkeyTool = 'hand'; break;
        }
        if (hotkeyTool) {
          e.preventDefault();
          onToolShortcut(hotkeyTool);
          return;
        }
      }

      /* ─── Ctrl+Alt+N / Cmd+Alt+N → New Project ─── */
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === 'KeyN') {
        e.preventDefault();
        onNewProjectShortcut();
        return;
      }

      /* ─── Ctrl+Delete → удалить кадр ─── */
      {
        const ctrlDel = e.ctrlKey || e.metaKey;
        if (ctrlDel && e.code === 'Delete') {
          e.preventDefault();
          deleteFrame();
          return;
        }
      }

      const mode = lassoModeRef.current;
      if (activeToolRef.current === 'lasso' && mode !== null) {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelLasso();
          scheduleOverlay();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          commitLasso('Lasso');
          scheduleOverlay();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const lid = activeLayerIdRef.current;
          const fid = getCurrentFrameId();
          if (!fid) return;
          const before = lassoPreSnapshotRef.current ?? snapshot(lid, fid);
          const lc = getFrameCanvasById(lid, fid);
          if (lc && lassoPolyRef.current.length >= 3) {
            const ctx = lc.getContext('2d');
            if (ctx) {
              ctx.save();
              ctx.globalCompositeOperation = 'destination-out';
              tracePolygon(ctx, lassoPolyRef.current, lassoOffsetRef.current);
              ctx.fillStyle = 'rgba(0,0,0,1)';
              ctx.fill();
              ctx.restore();
            }
          }
          const after = snapshot(lid, fid);
          if (before && after) pushHistory(lid, fid, before, after, 'Lasso delete');
          clearLassoState();
          renderComposite();
          bumpThumbs(); bumpTimeline();
          scheduleOverlay();
          return;
        }
      }
      if (e.key === 'Escape') {
        setActiveMenu(null); setActivePopover(null); setIsShapeMenuOpen(false);
        setShowSettings(false); setShowNewProject(false); setExportOpen(false);
      }
      const ctrl = e.ctrlKey || e.metaKey;
      const code = e.code, key = e.key.toLowerCase();

      if (ctrl && (code === 'KeyM' || key === 'm' || key === 'ь')) {
        e.preventDefault();
        addFrame();
        return;
      }

      if (ctrl) {
        if ((code === 'KeyZ' || key === 'z' || key === 'я') && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((code === 'KeyY' || key === 'y' || key === 'н') || ((code === 'KeyZ' || key === 'z' || key === 'я') && e.shiftKey)) { e.preventDefault(); redo(); }
      }
      if (e.key === 'ArrowLeft' && !ctrl) {
        e.preventDefault();
        selectFrame(Math.max(0, currentFrameRef.current - 1));
      }
      if (e.key === 'ArrowRight' && !ctrl) {
        e.preventDefault();
        selectFrame(Math.min(frameOrderRef.current.length - 1, currentFrameRef.current + 1));
      }
      if (e.code === 'Comma' && !ctrl) { e.preventDefault(); addFrame(); }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = false;
      if (e.code === 'Space') {
        const wasDown = spacePressedRef.current;
        spacePressedRef.current = false;
        if (wasDown && !spaceUsedForPanRef.current) {
          const dur = performance.now() - spaceDownTimeRef.current;
          if (dur < 300) {
            e.preventDefault();
            onTogglePlayback();
          }
        }
        spaceUsedForPanRef.current = false;
      }
    };
    const blur = () => {
      shiftPressedRef.current = false;
      spacePressedRef.current = false;
      spaceUsedForPanRef.current = false;
      isPanningRef.current = false;
      panStartRef.current = { x: 0, y: 0 };
      isMouseDownRef.current = false;
      drawingPointerIdRef.current = null;
      pointersRef.current.clear();
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', blur);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, scheduleOverlay, renderComposite, commitLasso, cancelLasso, clearLassoState,
      selectFrame, addFrame, deleteFrame, snapshot, pushHistory, getCurrentFrameId, getFrameCanvasById,
      onTogglePlayback, onCommitImageTransform, onCancelImageTransform,
      onToolShortcut, onNewProjectShortcut]);

  return {
    getCanvasPt,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}