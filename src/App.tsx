import React, { useRef, useState, useEffect, useCallback } from 'react';
import { T } from './i18n/translations';
import type { Tool, ShapeTool, Theme, Lang, BrushType, Point, LayerMeta, HistoryEntry, FreehandStroke, ShapeAction } from './lib/types';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from './lib/color';
import { pointInPolygon, tracePolygon } from './lib/geometry';
import { floodFill } from './lib/floodFill';
import { drawActionToCtx } from './lib/actions';
import { drawStrokeToCtx } from './lib/brushes';
import { drawShapeToCtx } from './lib/shapes';
import { uid } from './lib/constants';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import LayersPanel from './components/LayersPanel';
import SettingsModal from './components/SettingsModal';
import NewProjectModal from './components/NewProjectModal';

export default function App() {
  /* ─── State ─── */
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Lang>('en');
  const [activeMenu, setActiveMenu] = useState<'file' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLayers, setShowLayers] = useState(false);

  const [canvasBg, setCanvasBg] = useState('#FFFFFF');
  const [viewportBg, setViewportBg] = useState('auto');
  const [canvasSize, setCanvasSize] = useState({ w: 794, h: 1123 });

  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [prevTool, setPrevTool] = useState<Tool>('pencil');
  const [lastShapeTool, setLastShapeTool] = useState<ShapeTool>('rectangle');
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
  const [hoveredShape, setHoveredShape] = useState<ShapeTool | null>(null);

  const [pencilSize, setPencilSize] = useState(6);
  const [eraserSize, setEraserSize] = useState(24);
  const [shapeSize, setShapeSize] = useState(4);
  const [isShapeFilled, setIsShapeFilled] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#1E293B');
  const [brushType, setBrushType] = useState<BrushType>('round');

  const [activePopover, setActivePopover] = useState<'pencil' | 'eraser' | 'shape' | 'color' | null>(null);
  const [pencilTab, setPencilTab] = useState<'size' | 'brush'>('size');

  const [hsv, setHsv] = useState({ h: 215, s: 80, v: 23 });
  const [hexInput, setHexInput] = useState('#1E293B');
  const [rgbInput, setRgbInput] = useState({ r: '30', g: '41', b: '59' });

  const [layersVersion, setLayersVersion] = useState(0);
  const [activeLayerId, setActiveLayerId] = useState('');
  const [thumbsVersion, setThumbsVersion] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  /* ─── Refs ─── */
  const layersRef = useRef<LayerMeta[]>([]);
  const layerCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const activeLayerIdRef = useRef<string>('');
  const historyRef = useRef<HistoryEntry[]>([]);
  const redoRef = useRef<HistoryEntry[]>([]);
  const lastActiveLayerIdRef = useRef<string>('');

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
  const pencilSizeRef = useRef(6);
  const eraserSizeRef = useRef(24);
  const shapeSizeRef = useRef(4);
  const isShapeFilledRef = useRef(false);
  const brushTypeRef = useRef<BrushType>('round');
  const zoomRef = useRef(0.85);
  const rafRef = useRef<number | null>(null);
  const canvasBgRef = useRef('#FFFFFF');
  const canvasSizeRef = useRef({ w: 794, h: 1123 });

  const shapeHoldTimerRef = useRef<number | null>(null);
  const shapePressActiveRef = useRef(false);
  const shapeWasMenuOpenedRef = useRef(false);
  const hoveredShapeRef = useRef<ShapeTool | null>(null);

  const lassoPathRef = useRef<Point[]>([]);
  const lassoPolyRef = useRef<Point[]>([]);
  const lassoBufferRef = useRef<HTMLCanvasElement | null>(null);
  const lassoBBoxRef = useRef<Point>({ x: 0, y: 0 });
  const lassoOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const lassoModeRef = useRef<'draw' | 'selected' | 'move' | null>(null);
  const lassoMoveStartRef = useRef<Point | null>(null);
  const lassoPreSnapshotRef = useRef<ImageData | null>(null);

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
  const previewCircleRef = useRef<HTMLDivElement>(null);
  const [isInsideCanvas, setIsInsideCanvas] = useState(false);
  const previewSizeRef = useRef<number | null>(null);
  const previewActiveRef = useRef(false);

  const isDark = theme === 'dark';
  const isShapeTool = (tl: Tool): tl is ShapeTool =>
    tl === 'line' || tl === 'rectangle' || tl === 'circle' || tl === 'triangle';

  /* ─── Sync refs ─── */
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { pencilSizeRef.current = pencilSize; }, [pencilSize]);
  useEffect(() => { eraserSizeRef.current = eraserSize; }, [eraserSize]);
  useEffect(() => { shapeSizeRef.current = shapeSize; }, [shapeSize]);
  useEffect(() => { isShapeFilledRef.current = isShapeFilled; }, [isShapeFilled]);
  useEffect(() => { brushTypeRef.current = brushType; }, [brushType]);
  useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
  useEffect(() => { canvasBgRef.current = canvasBg; }, [canvasBg]);
  useEffect(() => { canvasSizeRef.current = canvasSize; }, [canvasSize]);

  /* ─── Persistence ─── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('draft-settings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.theme) setTheme(s.theme);
        if (s.canvasBg) setCanvasBg(s.canvasBg);
        if (s.viewportBg) setViewportBg(s.viewportBg);
        if (s.brushType) setBrushType(s.brushType);
        if (s.lang) setLang(s.lang);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('draft-settings', JSON.stringify({ theme, canvasBg, viewportBg, brushType, lang }));
    } catch {}
  }, [theme, canvasBg, viewportBg, brushType, lang]);

  const resolvedViewportBg = viewportBg === 'auto'
    ? (isDark ? '#0a0a0b' : '#f4f4f5')
    : viewportBg;

  const bumpLayers = () => setLayersVersion(v => v + 1);
  const bumpThumbs = () => setThumbsVersion(v => v + 1);

  /* ─── Composite render ─── */
  const renderComposite = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = canvasSizeRef.current;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = canvasBgRef.current;
    ctx.fillRect(0, 0, w, h);
    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      const lc = layerCanvasesRef.current.get(layer.id);
      if (!lc) continue;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lc, 0, 0);
    }
  }, []);

  /* ─── Init ─── */
  useEffect(() => {
    const { w, h } = canvasSizeRef.current;
    const lc = document.createElement('canvas');
    lc.width = w; lc.height = h;
    const lid = uid();
    layerCanvasesRef.current.set(lid, lc);
    layersRef.current = [{ id: lid, name: 'Layer 1', visible: true, locked: false }];
    activeLayerIdRef.current = lid;
    lastActiveLayerIdRef.current = lid;
    setActiveLayerId(lid);
    if (baseCanvasRef.current) { baseCanvasRef.current.width = w; baseCanvasRef.current.height = h; }
    if (overlayCanvasRef.current) { overlayCanvasRef.current.width = w; overlayCanvasRef.current.height = h; }
    bumpLayers();
    setTimeout(() => renderComposite(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { renderComposite(); }, [canvasBg, layersVersion, renderComposite]);

  /* ─── Layer helpers ─── */
  const findLayer = (id: string): LayerMeta | null => {
    for (const l of layersRef.current) if (l.id === id) return l;
    return null;
  };

  const addLayer = () => {
    const { w, h } = canvasSizeRef.current;
    const id = uid();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    layerCanvasesRef.current.set(id, c);
    layersRef.current.push({
      id,
      name: `Layer ${layersRef.current.length + 1}`,
      visible: true,
      locked: false,
    });
    setActiveLayerId(id);
    activeLayerIdRef.current = id;
    bumpLayers(); renderComposite(); bumpThumbs();
  };

  const deleteLayer = (id: string) => {
    const idx = layersRef.current.findIndex(l => l.id === id);
    if (idx < 0) return;
    if (layersRef.current.length <= 1) return;
    layersRef.current.splice(idx, 1);
    layerCanvasesRef.current.delete(id);
    historyRef.current = historyRef.current.filter(e => e.layerId !== id);
    redoRef.current = redoRef.current.filter(e => e.layerId !== id);
    if (activeLayerIdRef.current === id) {
      const next = layersRef.current[Math.min(idx, layersRef.current.length - 1)];
      setActiveLayerId(next.id);
      activeLayerIdRef.current = next.id;
    }
    bumpLayers(); renderComposite();
  };

  const moveLayerTo = (dragId: string, targetId: string, position: 'above' | 'below') => {
    const dragIdx = layersRef.current.findIndex(l => l.id === dragId);
    if (dragIdx < 0) return;
    const [drag] = layersRef.current.splice(dragIdx, 1);
    const tIdx = layersRef.current.findIndex(l => l.id === targetId);
    if (tIdx < 0) { layersRef.current.splice(dragIdx, 0, drag); return; }
    layersRef.current.splice(position === 'above' ? tIdx + 1 : tIdx, 0, drag);
    bumpLayers(); renderComposite();
  };

  const setLayerProp = (id: string, patch: Partial<LayerMeta>) => {
    const l = findLayer(id);
    if (!l) return;
    Object.assign(l, patch);
    bumpLayers(); renderComposite();
  };

  /* ─── Snapshots ─── */
  const snapshot = (layerId: string): ImageData | null => {
    const c = layerCanvasesRef.current.get(layerId);
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    return ctx.getImageData(0, 0, c.width, c.height);
  };
  const restoreSnap = (layerId: string, data: ImageData | null) => {
    if (!data) return;
    const c = layerCanvasesRef.current.get(layerId);
    if (!c) return;
    c.getContext('2d')!.putImageData(data, 0, 0);
  };
  const pushHistory = (layerId: string, before: ImageData | null, after: ImageData | null, label: string) => {
    historyRef.current.push({ layerId, before, after, label });
    if (historyRef.current.length > 30) historyRef.current.shift();
    redoRef.current = [];
  };

  /* ─── Lasso helpers ─── */
  const clearLassoState = useCallback(() => {
    lassoPathRef.current = [];
    lassoPolyRef.current = [];
    lassoBufferRef.current = null;
    lassoBBoxRef.current = { x: 0, y: 0 };
    lassoOffsetRef.current = { x: 0, y: 0 };
    lassoModeRef.current = null;
    lassoMoveStartRef.current = null;
    lassoPreSnapshotRef.current = null;
    setHasSelection(false);
  }, []);

  const commitLasso = useCallback((label = 'Lasso') => {
    const mode = lassoModeRef.current;
    const lid = activeLayerIdRef.current;
    const lc = layerCanvasesRef.current.get(lid);
    const buffer = lassoBufferRef.current;
    const poly = lassoPolyRef.current;

    if ((mode === 'selected' || mode === 'move') && lc && buffer && poly.length >= 3) {
      const offset = lassoOffsetRef.current;
      const bbox = lassoBBoxRef.current;
      const ctx = lc.getContext('2d');
      if (ctx) {
        ctx.drawImage(buffer, bbox.x + offset.x, bbox.y + offset.y);
      }
    }

    const before = lassoPreSnapshotRef.current;
    const after = snapshot(lid);
    if (before && after) {
      pushHistory(lid, before, after, label);
    }

    renderComposite();
    bumpThumbs();
    clearLassoState();
  }, [clearLassoState, renderComposite]);

  const cancelLasso = useCallback(() => {
    const snap = lassoPreSnapshotRef.current;
    if (snap) {
      restoreSnap(activeLayerIdRef.current, snap);
      renderComposite();
      bumpThumbs();
    }
    clearLassoState();
  }, [clearLassoState, renderComposite]);

  /* ─── Layer switch: commit active lasso before changing layer ─── */
  useEffect(() => {
    if (lastActiveLayerIdRef.current !== activeLayerId) {
      if (lassoModeRef.current !== null) commitLasso('Lasso');
      lastActiveLayerIdRef.current = activeLayerId;
    }
  }, [activeLayerId, commitLasso]);

  /* ─── Undo / Redo ─── */
  const undo = useCallback(() => {
    if (lassoModeRef.current !== null) {
      const snap = lassoPreSnapshotRef.current;
      if (snap) restoreSnap(activeLayerIdRef.current, snap);
      lassoPathRef.current = [];
      lassoPolyRef.current = [];
      lassoBufferRef.current = null;
      lassoBBoxRef.current = { x: 0, y: 0 };
      lassoOffsetRef.current = { x: 0, y: 0 };
      lassoModeRef.current = null;
      lassoMoveStartRef.current = null;
      lassoPreSnapshotRef.current = null;
      setHasSelection(false);
      renderComposite();
      return;
    }
    const entry = historyRef.current.pop();
    if (!entry) return;
    restoreSnap(entry.layerId, entry.before);
    redoRef.current.push(entry);
    renderComposite(); bumpThumbs();
  }, [renderComposite]);

  const redo = useCallback(() => {
    const entry = redoRef.current.pop();
    if (!entry) return;
    restoreSnap(entry.layerId, entry.after);
    historyRef.current.push(entry);
    renderComposite(); bumpThumbs();
  }, [renderComposite]);

  /* ─── Color inputs ─── */
  const updateFromHsv = useCallback((n: { h: number; s: number; v: number }) => {
    setHsv(n);
    const { r, g, b } = hsvToRgb(n.h, n.s, n.v);
    const hex = rgbToHex(r, g, b);
    setSelectedColor(hex); selectedColorRef.current = hex;
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
        setSelectedColor(hex); selectedColorRef.current = hex;
        setRgbInput({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });
        setHsv(rgbToHsv(rgb.r, rgb.g, rgb.b));
      }
    }
  };
  const handleRgb = (ch: 'r' | 'g' | 'b', v: string) => {
    const ni = { ...rgbInput, [ch]: v };
    setRgbInput(ni);
    const r = parseInt(ni.r), g = parseInt(ni.g), b = parseInt(ni.b);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b) && r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      const hex = rgbToHex(r, g, b);
      setSelectedColor(hex); selectedColorRef.current = hex;
      setHexInput(hex);
      setHsv(rgbToHsv(r, g, b));
    }
  };

  /* ─── Preview circle ─── */
  const showPreviewAtCanvasCenter = useCallback((size: number) => {
    previewSizeRef.current = size;
    const pc = previewCircleRef.current;
    const cont = containerRef.current;
    if (!pc || !cont) return;
    const r = cont.getBoundingClientRect();
    pc.style.left = `${r.left + r.width / 2}px`;
    pc.style.top = `${r.top + r.height / 2}px`;
    const d = size * zoomRef.current;
    pc.style.width = `${d}px`;
    pc.style.height = `${d}px`;
    pc.style.display = 'block';
    previewActiveRef.current = true;
  }, []);

  const hidePreview = useCallback(() => {
    previewSizeRef.current = null;
    const pc = previewCircleRef.current;
    if (pc) pc.style.display = 'none';
    previewActiveRef.current = false;
  }, []);

  /* ─── Overlay ─── */
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

    if (tool === 'pencil' || tool === 'eraser') {
      const pts = currentStrokeRef.current;
      if (pts.length === 0) return;
      const size = tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current;
      if (tool === 'eraser') {
        ctx.save();
        ctx.globalAlpha = 0.45;
        drawStrokeToCtx(ctx, {
          type: 'stroke', tool: 'pencil', brush: 'round',
          points: pts,
          pressures: currentPressuresRef.current,
          color: '#ef4444',
          size,
        }, false);
        ctx.restore();
      } else {
        drawStrokeToCtx(ctx, {
          type: 'stroke', tool, brush: brushTypeRef.current,
          points: pts,
          pressures: currentPressuresRef.current,
          color: selectedColorRef.current,
          size,
        }, false);
      }
    } else if (shapeStartRef.current && isShapeTool(tool)) {
      drawShapeToCtx(ctx, {
        type: 'shape', tool,
        start: shapeStartRef.current,
        end: cursorPosRef.current,
        color: selectedColorRef.current,
        size: shapeSizeRef.current,
        isFilled: isShapeFilledRef.current,
        shiftKey: shiftPressedRef.current,
      });
    }
  }, []);

  const scheduleOverlay = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawOverlay();
    });
  }, [drawOverlay]);

  /* ─── Keyboard ─── */
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'Shift') shiftPressedRef.current = true;
      if (e.code === 'Space') { e.preventDefault(); spacePressedRef.current = true; }

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
          const before = lassoPreSnapshotRef.current ?? snapshot(lid);
          const lc = layerCanvasesRef.current.get(lid);
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
          const after = snapshot(lid);
          if (before && after) pushHistory(lid, before, after, 'Lasso delete');
          clearLassoState();
          renderComposite();
          bumpThumbs();
          scheduleOverlay();
          return;
        }
      if (e.key === 'Escape') {
          e.preventDefault();
          const snap = lassoPreSnapshotRef.current;
          if (snap) restoreSnap(activeLayerIdRef.current, snap);
          lassoPathRef.current = []; lassoPolyRef.current = []; lassoBufferRef.current = null;
          lassoBBoxRef.current = { x: 0, y: 0 }; lassoOffsetRef.current = { x: 0, y: 0 };
          lassoModeRef.current = null; lassoMoveStartRef.current = null; lassoPreSnapshotRef.current = null;
          setHasSelection(false); scheduleOverlay(); renderComposite();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const snap = lassoPreSnapshotRef.current;
          const lid = activeLayerIdRef.current;
          if (snap) {
            const after = snapshot(lid);
            if (after) pushHistory(lid, snap, after, 'Lasso');
          }
          lassoPathRef.current = []; lassoPolyRef.current = []; lassoBufferRef.current = null;
          lassoBBoxRef.current = { x: 0, y: 0 }; lassoOffsetRef.current = { x: 0, y: 0 };
          lassoModeRef.current = null; lassoMoveStartRef.current = null; lassoPreSnapshotRef.current = null;
          setHasSelection(false); scheduleOverlay(); bumpThumbs();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const lc = layerCanvasesRef.current.get(activeLayerIdRef.current);
          if (lc) {
            const ctx = lc.getContext('2d')!;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            tracePolygon(ctx, lassoPolyRef.current, lassoOffsetRef.current);
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.fill();
            ctx.restore();
          }
          renderComposite();
          lassoPathRef.current = []; lassoPolyRef.current = []; lassoBufferRef.current = null;
          lassoBBoxRef.current = { x: 0, y: 0 }; lassoOffsetRef.current = { x: 0, y: 0 };
          lassoModeRef.current = null; lassoMoveStartRef.current = null; lassoPreSnapshotRef.current = null;
          setHasSelection(false); scheduleOverlay(); bumpThumbs();
          return;
        }
      }
      if (e.key === 'Escape') {
        setActiveMenu(null); setActivePopover(null); setIsShapeMenuOpen(false);
        setShowSettings(false); setShowNewProject(false); setExportOpen(false);
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
    const blur = () => {
      shiftPressedRef.current = false;
      spacePressedRef.current = false;
      isPanningRef.current = false;
      isMouseDownRef.current = false;
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
  }, [undo, redo, scheduleOverlay, renderComposite, commitLasso, cancelLasso, clearLassoState]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  /* ─── Coords / Wheel ─── */
  const getCanvasPt = useCallback((cx: number, cy: number): Point => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const r = containerRef.current.getBoundingClientRect();
    return {
      x: (cx - r.left - panRef.current.x) / zoomRef.current,
      y: (cy - r.top - panRef.current.y) / zoomRef.current,
    };
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

  /* ─── Pointer ─── */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}
    if (e.pointerType !== 'mouse') e.preventDefault();

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
    const handMode = tool === 'hand' || spacePressedRef.current || isMiddle;

    if (handMode) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
      drawingPointerIdRef.current = e.pointerId;
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
      lassoPreSnapshotRef.current = snapshot(activeLayerIdRef.current);
      lassoModeRef.current = 'draw';
      lassoPathRef.current = [pt];
      scheduleOverlay();
    } else if (tool === 'bucket') {
      const comp = baseCanvasRef.current;
      const lc = layerCanvasesRef.current.get(activeLayerIdRef.current);
      if (!comp || !lc) return;
      const compCtx = comp.getContext('2d');
      if (!compCtx) return;
      const before = snapshot(activeLayerIdRef.current);
      const { w, h } = canvasSizeRef.current;
      const refData = compCtx.getImageData(0, 0, w, h).data;
      const lctx = lc.getContext('2d')!;
      floodFill(lctx, refData, pt.x, pt.y, selectedColorRef.current, w, h);
      renderComposite();
      const after = snapshot(activeLayerIdRef.current);
      pushHistory(activeLayerIdRef.current, before, after, 'Fill');
      isMouseDownRef.current = false;
      drawingPointerIdRef.current = null;
      bumpThumbs();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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
    if (e.pointerId !== drawingPointerIdRef.current) return;

    const tool = activeToolRef.current;
    const lc = layerCanvasesRef.current.get(activeLayerIdRef.current);

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
        const after = snapshot(lid);
        if (snap && after) pushHistory(lid, snap, after, 'Lasso move');
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
    if (!lc) {
      isMouseDownRef.current = false;
      currentStrokeRef.current = [];
      currentPressuresRef.current = [];
      shapeStartRef.current = null;
      drawingPointerIdRef.current = null;
      const o = overlayCanvasRef.current;
      if (o) {
        const { w, h } = canvasSizeRef.current;
        o.getContext('2d')?.clearRect(0, 0, w, h);
      }
      scheduleOverlay();
      return;
    }

    const lid = activeLayerIdRef.current;
    const before = snapshot(lid);

    if (tool === 'pencil' || tool === 'eraser') {
      if (currentStrokeRef.current.length > 0) {
        const action: FreehandStroke = {
          type: 'stroke',
          tool,
          brush: tool === 'pencil' ? brushTypeRef.current : undefined,
          points: [...currentStrokeRef.current],
          pressures: [...currentPressuresRef.current],
          color: selectedColorRef.current,
          size: tool === 'pencil' ? pencilSizeRef.current : eraserSizeRef.current,
        };
        drawActionToCtx(lc.getContext('2d')!, action);
        renderComposite();
        const after = snapshot(lid);
        pushHistory(lid, before, after, tool);
        bumpThumbs();
      }
    } else if (shapeStartRef.current && isShapeTool(tool)) {
      const action: ShapeAction = {
        type: 'shape',
        tool,
        start: shapeStartRef.current,
        end: cursorPosRef.current,
        color: selectedColorRef.current,
        size: shapeSizeRef.current,
        isFilled: isShapeFilledRef.current,
        shiftKey: shiftPressedRef.current,
      };
      drawActionToCtx(lc.getContext('2d')!, action);
      renderComposite();
      const after = snapshot(lid);
      pushHistory(lid, before, after, 'Shape');
      bumpThumbs();
    }

    isMouseDownRef.current = false;
    currentStrokeRef.current = [];
    currentPressuresRef.current = [];
    shapeStartRef.current = null;
    drawingPointerIdRef.current = null;

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
    if (e.pointerId === drawingPointerIdRef.current) {
      isMouseDownRef.current = false;
      isPanningRef.current = false;
      currentStrokeRef.current = [];
      currentPressuresRef.current = [];
      shapeStartRef.current = null;
      drawingPointerIdRef.current = null;
      const o = overlayCanvasRef.current;
      if (o) {
        const { w, h } = canvasSizeRef.current;
        o.getContext('2d')?.clearRect(0, 0, w, h);
      }
      scheduleOverlay();
    }
  };

  /* ─── Export ─── */
  const exportImg = (fmt: 'png' | 'jpeg', onlyActive: boolean = false) => {
    const comp = document.createElement('canvas');
    const { w, h } = canvasSizeRef.current;
    comp.width = w;
    comp.height = h;
    const ctx = comp.getContext('2d')!;
    if (onlyActive) {
      const lc = layerCanvasesRef.current.get(activeLayerIdRef.current);
      if (lc) ctx.drawImage(lc, 0, 0);
    } else {
      ctx.fillStyle = canvasBgRef.current;
      ctx.fillRect(0, 0, w, h);
      for (const layer of layersRef.current) {
        if (!layer.visible) continue;
        const lc = layerCanvasesRef.current.get(layer.id);
        if (!lc) continue;
        ctx.drawImage(lc, 0, 0);
      }
    }
    const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    const quality = fmt === 'png' ? undefined : 0.92;
    const link = document.createElement('a');
    link.download = `draft-${Date.now()}.${fmt}`;
    link.href = comp.toDataURL(mime, quality);
    link.click();
    setActiveMenu(null);
    setExportOpen(false);
  };

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const { w, h } = canvasSizeRef.current;
        const id = uid();
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d')!;
        const sx = w / img.width, sy = h / img.height;
        const scale = Math.min(sx, sy);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        layerCanvasesRef.current.set(id, c);
        layersRef.current.push({ id, name: 'Imported', visible: true, locked: false });
        setActiveLayerId(id);
        activeLayerIdRef.current = id;
        bumpLayers(); renderComposite(); bumpThumbs();
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    setActiveMenu(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const createNewProject = (w: number, h: number) => {
    const lid = uid();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    layerCanvasesRef.current.clear();
    layerCanvasesRef.current.set(lid, canvas);
    layersRef.current = [{ id: lid, name: 'Layer 1', visible: true, locked: false }];
    activeLayerIdRef.current = lid;
    setActiveLayerId(lid);
    historyRef.current = [];
    redoRef.current = [];
    if (baseCanvasRef.current) { baseCanvasRef.current.width = w; baseCanvasRef.current.height = h; }
    if (overlayCanvasRef.current) { overlayCanvasRef.current.width = w; overlayCanvasRef.current.height = h; }
    canvasSizeRef.current = { w, h };
    setCanvasSize({ w, h });
    bumpLayers();
    setTimeout(() => {
      renderComposite();
      if (containerRef.current && canvasWrapperRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        const sx2 = (r.width * 0.85) / w, sy2 = (r.height * 0.85) / h;
        const z = Math.min(Math.max(Math.min(sx2, sy2), 0.2), 1);
        zoomRef.current = z;
        const np = { x: (r.width - w * z) / 2, y: Math.max(20, (r.height - h * z) / 2) };
        panRef.current = np;
        canvasWrapperRef.current.style.transform = `translate3d(${np.x}px, ${np.y}px, 0) scale(${z})`;
      }
    }, 50);
    setShowNewProject(false);
    setActiveMenu(null);
  };

  /* ─── Shape hold ─── */
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
    }, 150);
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

  /* ─── Fit viewport ─── */
  useEffect(() => {
    const fit = () => {
      if (containerRef.current && canvasWrapperRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        const { w, h } = canvasSizeRef.current;
        const sx = (r.width * 0.85) / w;
        const sy = (r.height * 0.85) / h;
        const z = Math.min(Math.max(Math.min(sx, sy), 0.2), 1);
        zoomRef.current = z;
        const np = { x: (r.width - w * z) / 2, y: Math.max(20, (r.height - h * z) / 2) };
        panRef.current = np;
        canvasWrapperRef.current.style.transform = `translate3d(${np.x}px, ${np.y}px, 0) scale(${z})`;
      }
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  /* ─── Close menu on outside click ─── */
  useEffect(() => {
    if (!activeMenu) return;
    const close = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-menu]')) return;
      setActiveMenu(null);
      setExportOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [activeMenu]);

  const t = (key: keyof typeof T.en) => T[lang][key];

  /* ─── Theme tokens ─── */
  const bg = isDark ? 'bg-[#0a0a0b]' : 'bg-[#f4f4f5]';
  const panel = isDark ? 'bg-[#0f0f10]' : 'bg-white';
  const hover = isDark ? 'hover:bg-[#18181b]' : 'hover:bg-zinc-50';
  const border = isDark ? 'border-[#1f1f22]' : 'border-zinc-200';
  const muted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const textSoft = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const textMain = isDark ? 'text-zinc-100' : 'text-zinc-900';
  const inputBg = isDark ? 'bg-[#0a0a0b] border-[#1f1f22] text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900';
  const btnBase = isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-[#18181b]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100';

  const cursorStyle: React.CSSProperties['cursor'] =
    activeTool === 'hand' ? 'grab' :
    activeTool === 'eyedropper' ? 'copy' : 'crosshair';
  const ringSize = activeTool === 'pencil' ? pencilSize : activeTool === 'eraser' ? eraserSize : 0;

  return (
    <div className={`relative w-screen h-screen ${bg} ${textMain} font-sans select-none overflow-hidden flex flex-col`}>
      <style>{`
        html, body { overscroll-behavior: none; }
        .slider-custom { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; background: ${isDark ? '#27272a' : '#e4e4e7'}; border-radius: 3px; outline: none; cursor: pointer; }
        .slider-custom::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${isDark ? '#fafafa' : '#18181b'}; border: none; cursor: grab; box-shadow: 0 1px 3px rgba(0,0,0,0.4); transition: transform 0.08s ease; }
        .slider-custom::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .slider-custom::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.08); }
        .slider-custom::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: ${isDark ? '#fafafa' : '#18181b'}; border: none; cursor: grab; }
        .scroll-thin::-webkit-scrollbar { width: 4px; }
        .scroll-thin::-webkit-scrollbar-track { background: transparent; }
        .scroll-thin::-webkit-scrollbar-thumb { background: ${isDark ? '#27272a' : '#d4d4d8'}; border-radius: 2px; }
      `}</style>

      <TopBar
        isDark={isDark}
        isFullscreen={isFullscreen}
        activeMenu={activeMenu}
        exportOpen={exportOpen}
        showLayers={showLayers}
        panel={panel}
        border={border}
        textSoft={textSoft}
        hover={hover}
        btnBase={btnBase}
        t={t}
        onToggleMenu={() => {
          setActiveMenu(activeMenu === 'file' ? null : 'file');
          setExportOpen(false);
        }}
        onToggleFullscreen={toggleFullscreen}
        onToggleLayers={() => setShowLayers(s => !s)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenNewProject={() => { setShowNewProject(true); setActiveMenu(null); }}
        onOpenImage={() => { fileInputRef.current?.click(); setActiveMenu(null); }}
        onSetExportOpen={setExportOpen}
        onExport={exportImg}
      />

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
        onPointerLeave={() => setIsInsideCanvas(false)}
        onPointerEnter={() => setIsInsideCanvas(true)}
        onContextMenu={(e) => e.preventDefault()}
        className="flex-1 relative overflow-hidden"
        style={{
          backgroundColor: resolvedViewportBg,
          cursor: cursorStyle,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          overscrollBehavior: 'none',
        }}
      >
        <div
          ref={canvasWrapperRef}
          className="absolute top-0 left-0 origin-top-left will-change-transform"
          style={{ width: canvasSize.w, height: canvasSize.h }}
        >
          <canvas
            ref={baseCanvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="block w-full h-full shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
          />
          <canvas
            ref={overlayCanvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
          {hasSelection && activeTool === 'lasso' && (
            <div className="absolute top-2 left-2 px-2 py-1 rounded-md text-[10px] font-mono z-20 bg-blue-600 text-white shadow-lg">
              Drag · Enter · Del · Esc
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
            border: `1px solid ${activeTool === 'eraser' ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.7)'}`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.6)',
            willChange: 'transform',
          }}
        />
      )}

      <div
        ref={previewCircleRef}
        className="fixed pointer-events-none z-[105] rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          border: `1.5px solid ${activeTool === 'eraser' ? '#ef4444' : '#3b82f6'}`,
          backgroundColor: activeTool === 'pencil' ? `${selectedColor}33` : 'transparent',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.55)',
          display: 'none',
        }}
      />

      <Toolbar
        isDark={isDark}
        panel={panel}
        border={border}
        hover={hover}
        muted={muted}
        textSoft={textSoft}
        textMain={textMain}
        btnBase={btnBase}
        inputBg={inputBg}
        activeTool={activeTool}
        activePopover={activePopover}
        shapeMenuOpen={isShapeMenuOpen}
        hoveredShape={hoveredShape}
        lastShapeTool={lastShapeTool}
        pencilTab={pencilTab}
        pencilSize={pencilSize}
        eraserSize={eraserSize}
        shapeSize={shapeSize}
        isShapeFilled={isShapeFilled}
        brushType={brushType}
        selectedColor={selectedColor}
        hsv={hsv}
        hexInput={hexInput}
        rgbInput={rgbInput}
        satValRef={satValRef}
        hueRef={hueRef}
        t={t}
        onToolClick={(tool) => {
          if (lassoModeRef.current !== null && tool !== 'lasso') {
            commitLasso('Lasso');
          }
          if (tool === 'eyedropper') {
            setPrevTool(activeTool === 'eyedropper' ? prevTool : activeTool);
            setActiveTool(tool);
            activeToolRef.current = tool;
            setActivePopover(null);
            return;
          }
          if (tool === 'pencil' || tool === 'eraser') {
            if (activeTool === tool) setActivePopover(activePopover === tool ? null : tool);
            else { setActiveTool(tool); activeToolRef.current = tool; setActivePopover(null); }
            return;
          }
          if (tool === 'bucket' || tool === 'hand' || tool === 'lasso') {
            setActiveTool(tool);
            activeToolRef.current = tool;
            setActivePopover(null);
            return;
          }
          if (isShapeTool(tool) && !isShapeMenuOpen) {
            setActivePopover(activePopover === 'shape' ? null : 'shape');
          }
        }}
        onShapeMouseDown={shapeMouseDown}
        onShapeHover={(s) => { setHoveredShape(s); hoveredShapeRef.current = s; }}
        setActivePopover={setActivePopover}
        setPencilTab={setPencilTab}
        setPencilSize={setPencilSize}
        setEraserSize={setEraserSize}
        setShapeSize={setShapeSize}
        setIsShapeFilled={setIsShapeFilled}
        setBrushType={setBrushType}
        updateFromHsv={updateFromHsv}
        handleHex={handleHex}
        handleRgb={handleRgb}
        onShowPreview={showPreviewAtCanvasCenter}
        onHidePreview={hidePreview}
      />

      {showLayers && (
        <LayersPanel
          isDark={isDark}
          panel={panel}
          border={border}
          hover={hover}
          muted={muted}
          btnBase={btnBase}
          layers={layersRef.current}
          activeLayerId={activeLayerId}
          thumbsVersion={thumbsVersion}
          layerCanvases={layerCanvasesRef.current}
          canvasSize={canvasSize}
          t={t}
          onSelect={(id) => { setActiveLayerId(id); activeLayerIdRef.current = id; }}
          onToggleVisible={(id) => { const l = findLayer(id); if (l) setLayerProp(id, { visible: !l.visible }); }}
          onToggleLock={(id) => { const l = findLayer(id); if (l) setLayerProp(id, { locked: !l.locked }); }}
          onAddLayer={addLayer}
          onDeleteLayer={() => deleteLayer(activeLayerId)}
          onMoveLayerTo={moveLayerTo}
        />
      )}

      {showSettings && (
        <SettingsModal
          isDark={isDark}
          panel={panel}
          border={border}
          muted={muted}
          textMain={textMain}
          btnBase={btnBase}
          theme={theme}
          lang={lang}
          canvasBg={canvasBg}
          viewportBg={viewportBg}
          resolvedViewportBg={resolvedViewportBg}
          t={t}
          onClose={() => setShowSettings(false)}
          setTheme={setTheme}
          setLang={setLang}
          setCanvasBg={setCanvasBg}
          setViewportBg={setViewportBg}
        />
      )}

      {showNewProject && (
        <NewProjectModal
          isDark={isDark}
          panel={panel}
          border={border}
          muted={muted}
          inputBg={inputBg}
          textMain={textMain}
          btnBase={btnBase}
          t={t}
          onClose={() => setShowNewProject(false)}
          onConfirm={createNewProject}
        />
      )}
    </div>
  );
}