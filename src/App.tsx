import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { T } from './i18n/translations';
import type { Tool, ShapeTool, Theme, Lang, BrushType, Point, LayerMeta, HistoryEntry, EraserShape } from './lib/types';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from './lib/color';
import { uid } from './lib/constants';
import type { AnimationFrame } from './animation/types';
import { useHistory } from './hooks/useHistory';
import { useProjectOps } from './hooks/useProjectOps';
import { usePointerInput } from './hooks/usePointerInput';
import { createEmptyCanvas, createFrame } from './animation/frameManager';
import { usePlayback } from './animation/playback';
import { drawOnionSkin } from './animation/onionSkin';
import { isVideoFormatSupported } from './lib/projectIO';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import LayersPanel from './components/LayersPanel';
import SettingsModal from './components/SettingsModal';
import NewProjectModal from './components/NewProjectModal';
import Timeline from './components/Timeline';
import ImageTransformOverlay, { type ImageTransform } from './components/ImageTransformOverlay';

type ActiveMenu = 'file' | 'render' | null;

export default function App() {
  /* ─── State ─── */
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Lang>('en');
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const [renderImageOpen, setRenderImageOpen] = useState(false);
  const [renderAnimOpen, setRenderAnimOpen] = useState(false);
  const [mp4Supported] = useState<boolean>(() => isVideoFormatSupported('mp4'));

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
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [eraserSize, setEraserSize] = useState(24);
  const [eraserShape, setEraserShape] = useState<EraserShape>('round');
  const [isShapeFilled, setIsShapeFilled] = useState(false);
  const [fillOpacity, setFillOpacity] = useState(1);
  const [selectedColor, setSelectedColor] = useState('#1E293B');
  const [brushType, setBrushType] = useState<BrushType>('round');

  const [activePopover, setActivePopover] = useState<'pencil' | 'eraser' | 'shape' | 'color' | 'bucket' | null>(null);
  const [pencilTab, setPencilTab] = useState<'size' | 'brush'>('size');

  const [hsv, setHsv] = useState({ h: 215, s: 80, v: 23 });
  const [hexInput, setHexInput] = useState('#1E293B');
  const [rgbInput, setRgbInput] = useState({ r: '30', g: '41', b: '59' });

  const [layersVersion, setLayersVersion] = useState(0);
  const [activeLayerId, setActiveLayerId] = useState('');
  const [thumbsVersion, setThumbsVersion] = useState(0);
  const [timelineVersion, setTimelineVersion] = useState(0);

  const [hasSelection, setHasSelection] = useState(false);

  /* ─── Image layer transform ─── */
  const [imageTransform, setImageTransform] = useState<ImageTransform | null>(null);

  /* ─── Animation state ─── */
  const [currentFrame, setCurrentFrame] = useState(0);
  const [fps, setFps] = useState(12);
  const [isPlaying, setIsPlaying] = useState(false);
  const [onionPrev, setOnionPrev] = useState(1);
  const [onionNext, setOnionNext] = useState(1);
  const [onionOpacity, setOnionOpacity] = useState(0.3);

  /* ─── Refs ─── */
  const layersRef = useRef<LayerMeta[]>([]);
  const activeLayerIdRef = useRef<string>('');
  const historyRef = useRef<HistoryEntry[]>([]);
  const redoRef = useRef<HistoryEntry[]>([]);
  const lastActiveLayerIdRef = useRef<string>('');

  const framesRef = useRef<Map<string, Map<string, HTMLCanvasElement>>>(new Map());
  const frameOrderRef = useRef<string[]>([]);
  const frameMetaRef = useRef<Map<string, AnimationFrame>>(new Map());
  const currentFrameRef = useRef<number>(0);
  const fpsRef = useRef<number>(12);
  const frameCountRef = useRef<number>(1);
  const onionSettingsRef = useRef({
    enabled: true,
    prev: 1,
    next: 1,
    opacity: 0.3,
  });

  const panRef = useRef<Point>({ x: 0, y: 0 });
  const activeToolRef = useRef<Tool>('pencil');
  const selectedColorRef = useRef<string>('#1E293B');
  const pencilSizeRef = useRef(6);
  const brushOpacityRef = useRef(1);
  const eraserSizeRef = useRef(24);
  const eraserShapeRef = useRef<EraserShape>('round');
  const isShapeFilledRef = useRef(false);
  const brushTypeRef = useRef<BrushType>('round');
  const fillOpacityRef = useRef(1);
  const zoomRef = useRef(0.85);
  const canvasBgRef = useRef('#FFFFFF');
  const canvasSizeRef = useRef({ w: 794, h: 1123 });
  const lastShapeToolRef = useRef<ShapeTool>('rectangle');

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

  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const satValRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const cursorRingRef = useRef<HTMLDivElement>(null);
  const previewCircleRef = useRef<HTMLDivElement>(null);
  const [isInsideCanvas, setIsInsideCanvas] = useState(false);
  const previewSizeRef = useRef<number | null>(null);
  const previewActiveRef = useRef(false);

  const hasImageTransformRef = useRef(false);
  useEffect(() => {
    hasImageTransformRef.current = imageTransform !== null;
  }, [imageTransform]);

  const isDark = theme === 'dark';
  const isShapeTool = (tl: Tool): tl is ShapeTool =>
    tl === 'line' || tl === 'rectangle' || tl === 'circle' ||
    tl === 'triangle' || tl === 'star';

  /* ─── Sync refs ─── */
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { selectedColorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { pencilSizeRef.current = pencilSize; }, [pencilSize]);
  useEffect(() => { brushOpacityRef.current = brushOpacity; }, [brushOpacity]);
  useEffect(() => { eraserSizeRef.current = eraserSize; }, [eraserSize]);
  useEffect(() => { eraserShapeRef.current = eraserShape; }, [eraserShape]);
  useEffect(() => { isShapeFilledRef.current = isShapeFilled; }, [isShapeFilled]);
  useEffect(() => { brushTypeRef.current = brushType; }, [brushType]);
  useEffect(() => { fillOpacityRef.current = fillOpacity; }, [fillOpacity]);
  useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
  useEffect(() => { canvasBgRef.current = canvasBg; }, [canvasBg]);
  useEffect(() => { canvasSizeRef.current = canvasSize; }, [canvasSize]);
  useEffect(() => { currentFrameRef.current = currentFrame; }, [currentFrame]);
  useEffect(() => { fpsRef.current = fps; }, [fps]);
  useEffect(() => { lastShapeToolRef.current = lastShapeTool; }, [lastShapeTool]);
  useEffect(() => {
    onionSettingsRef.current = {
      enabled: true,
      prev: onionPrev,
      next: onionNext,
      opacity: onionOpacity,
    };
  }, [onionPrev, onionNext, onionOpacity]);

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

  const bumpLayers = useCallback(() => setLayersVersion(v => v + 1), []);
  const bumpThumbs = useCallback(() => setThumbsVersion(v => v + 1), []);
  const bumpTimeline = useCallback(() => setTimelineVersion(v => v + 1), []);

  const getFrameCanvasById = useCallback((layerId: string, frameId: string): HTMLCanvasElement | null => {
    return framesRef.current.get(layerId)?.get(frameId) ?? null;
  }, []);

  const getCurrentFrameId = useCallback((): string | null => {
    return frameOrderRef.current[currentFrameRef.current] ?? null;
  }, []);

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

    const onion = onionSettingsRef.current;
    if (onion.enabled && frameOrderRef.current.length > 1) {
      drawOnionSkin({
        ctx,
        w,
        h,
        currentFrame: currentFrameRef.current,
        frameOrder: frameOrderRef.current,
        layers: layersRef.current,
        getFrameCanvas: getFrameCanvasById,
        settings: onion,
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    const fid = frameOrderRef.current[currentFrameRef.current];
    if (!fid) return;
    for (const layer of layersRef.current) {
      if (!layer.visible) continue;
      const lc = framesRef.current.get(layer.id)?.get(fid);
      if (!lc) continue;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(lc, 0, 0);
    }
  }, [getFrameCanvasById]);

  /* ─── Init ─── */
  useEffect(() => {
    const { w, h } = canvasSizeRef.current;
    const lc = createEmptyCanvas(w, h);
    const lid = uid();
    const firstFrame = createFrame();
    frameOrderRef.current = [firstFrame.id];
    frameMetaRef.current.set(firstFrame.id, firstFrame);
    framesRef.current.set(lid, new Map([[firstFrame.id, lc]]));
    frameCountRef.current = 1;
    currentFrameRef.current = 0;

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
  useEffect(() => { renderComposite(); }, [currentFrame, onionPrev, onionNext, onionOpacity, renderComposite]);

  const {
    snapshot,
    pushHistory,
    undo,
    redo,
    clearLassoState,
    commitLasso,
    cancelLasso,
  } = useHistory({
    framesRef,
    historyRef,
    redoRef,
    activeLayerIdRef,
    lassoPathRef,
    lassoPolyRef,
    lassoBufferRef,
    lassoBBoxRef,
    lassoOffsetRef,
    lassoModeRef,
    lassoMoveStartRef,
    lassoPreSnapshotRef,
    getCurrentFrameId,
    getFrameCanvasById,
    renderComposite,
    bumpThumbs,
    bumpTimeline,
    setHasSelection,
  });

  /* ─── Image transform commit/cancel ─── */
  const onCommitImageTransform = useCallback(() => {
    const t = imageTransform;
    if (!t) return;
    const lid = activeLayerIdRef.current;
    const fid = frameOrderRef.current[currentFrameRef.current];
    if (!lid || !fid) {
      setImageTransform(null);
      hasImageTransformRef.current = false;
      return;
    }
    const layer = (() => {
      for (const l of layersRef.current) if (l.id === lid) return l;
      return null;
    })();
    if (!layer || layer.locked || !layer.visible) {
      setImageTransform(null);
      hasImageTransformRef.current = false;
      return;
    }
    const lc = framesRef.current.get(lid)?.get(fid);
    if (!lc) {
      setImageTransform(null);
      hasImageTransformRef.current = false;
      return;
    }
    const ctx = lc.getContext('2d');
    if (!ctx) {
      setImageTransform(null);
      hasImageTransformRef.current = false;
      return;
    }

    const before = snapshot(lid, fid);
    ctx.drawImage(t.canvas, t.x, t.y, t.w, t.h);
    const after = snapshot(lid, fid);
    if (before && after) pushHistory(lid, fid, before, after, 'Import image');

    setImageTransform(null);
    hasImageTransformRef.current = false;
    renderComposite();
    bumpThumbs(); bumpTimeline();
  }, [
    imageTransform, layersRef, framesRef, frameOrderRef, currentFrameRef,
    snapshot, pushHistory, renderComposite, bumpThumbs, bumpTimeline,
  ]);

  const onCancelImageTransform = useCallback(() => {
    setImageTransform(null);
    hasImageTransformRef.current = false;
  }, []);

  /* ─── Image loaded (через useProjectOps → onImageLoaded) ─── */
  const onImageLoaded = useCallback((img: HTMLImageElement) => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width || 1;
    c.height = img.naturalHeight || img.height || 1;
    const ctx = c.getContext('2d');
    if (ctx) ctx.drawImage(img, 0, 0);

    const { w, h } = canvasSizeRef.current;
    const scale = Math.min(w / c.width, h / c.height);
    const dw = c.width * scale;
    const dh = c.height * scale;

    setImageTransform({
      canvas: c,
      x: (w - dw) / 2,
      y: (h - dh) / 2,
      w: dw,
      h: dh,
    });
    hasImageTransformRef.current = true;
    setShowLayers(false);
  }, []);

  /* ─── Hotkeys ─── */
  const onToolShortcut = useCallback((tool: Tool) => {
    if (lassoModeRef.current !== null && tool !== 'lasso') {
      commitLasso('Lasso');
    }
    setActivePopover(null);
    setIsShapeMenuOpen(false);
    if (isShapeTool(tool)) {
      setLastShapeTool(tool);
      lastShapeToolRef.current = tool;
    }
    if (tool === 'eyedropper') {
      setPrevTool(activeTool === 'eyedropper' ? prevTool : activeTool);
    }
    setActiveTool(tool);
    activeToolRef.current = tool;
  }, [activeTool, prevTool, commitLasso, isShapeTool]);

  const onNewProjectShortcut = useCallback(() => {
    setShowNewProject(true);
    setActiveMenu(null);
  }, []);

  const {
    findLayer,
    addLayer,
    deleteLayer,
    moveLayerTo,
    setLayerProp,
    selectFrame,
    addFrame,
    duplicateFrame,
    deleteFrame,
    clearFrame,
    advanceFrame,
    onPlayPause,
    onStopPlayback,
    renderImage,
    renderAnimation,
    saveProject,
    openProject,
    handleOpenProject,
    createNewProject,
  } = useProjectOps({
    layersRef,
    framesRef,
    frameOrderRef,
    frameMetaRef,
    frameCountRef,
    currentFrameRef,
    activeLayerIdRef,
    historyRef,
    redoRef,
    canvasSizeRef,
    canvasBgRef,
    baseCanvasRef,
    overlayCanvasRef,
    containerRef,
    canvasWrapperRef,
    zoomRef,
    panRef,
    fileInputRef,
    projectInputRef,
    lassoModeRef,
    fpsRef,
    onionSettingsRef,
    setActiveLayerId,
    setCurrentFrame,
    setCanvasSize,
    setCanvasBg,
    setIsPlaying,
    setShowNewProject,
    setActiveMenu,
    setFps,
    setOnionPrev,
    setOnionNext,
    setOnionOpacity,
    bumpLayers,
    bumpThumbs,
    bumpTimeline,
    snapshot,
    pushHistory,
    commitLasso,
    renderComposite,
    getCurrentFrameId,
    getFrameCanvasById,
    onImageLoaded,
  });

  const {
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  } = usePointerInput({
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
    onCommitImageTransform,
    onCancelImageTransform,
    onToolShortcut,
    onNewProjectShortcut,
    setSelectedColor, setHexInput, setRgbInput, setHsv, setActiveTool,
    setActiveMenu, setActivePopover, setIsShapeMenuOpen,
    setShowSettings, setShowNewProject, setExportOpen: () => {},
    setHasSelection,
    onTogglePlayback: onPlayPause,
  });

  useEffect(() => {
    if (lastActiveLayerIdRef.current !== activeLayerId) {
      if (lassoModeRef.current !== null) commitLasso('Lasso');
      lastActiveLayerIdRef.current = activeLayerId;
    }
  }, [activeLayerId, commitLasso]);

  usePlayback({
    isPlaying,
    fpsRef,
    frameCountRef,
    currentFrameRef,
    onAdvance: advanceFrame,
  });

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
          setActivePopover(null);
          setActiveTool(s);
          activeToolRef.current = s;
          setLastShapeTool(s);
          lastShapeToolRef.current = s;
        }
        setIsShapeMenuOpen(false);
        setHoveredShape(null);
        hoveredShapeRef.current = null;
        shapeWasMenuOpenedRef.current = false;
      } else if (shapePressActiveRef.current) {
        setActivePopover(null);
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
      setRenderImageOpen(false);
      setRenderAnimOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [activeMenu]);

  /* ─── Drop image onto canvas ─── */
  const onMainDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (imageTransform) return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => onImageLoaded(img);
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [imageTransform, onImageLoaded]);

  const onMainDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const t = (key: keyof typeof T.en) => T[lang][key];

  const currentFrameLayerCanvases = useMemo(() => {
    const map = new Map<string, HTMLCanvasElement>();
    const fid = frameOrderRef.current[currentFrame];
    if (!fid) return map;
    for (const layer of layersRef.current) {
      const c = framesRef.current.get(layer.id)?.get(fid);
      if (c) map.set(layer.id, c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrame, layersVersion, thumbsVersion]);

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
        .scroll-thin::-webkit-scrollbar { width: 4px; height: 4px; }
        .scroll-thin::-webkit-scrollbar-track { background: transparent; }
        .scroll-thin::-webkit-scrollbar-thumb { background: ${isDark ? '#27272a' : '#d4d4d8'}; border-radius: 2px; }
      `}</style>

      <TopBar
        isDark={isDark}
        activeMenu={activeMenu}
        showLayers={showLayers}
        panel={panel}
        border={border}
        textSoft={textSoft}
        hover={hover}
        btnBase={btnBase}
        t={t}
        renderImageOpen={renderImageOpen}
        renderAnimOpen={renderAnimOpen}
        mp4Supported={mp4Supported}
        onToggleMenu={(menu) => {
          setActiveMenu(menu);
          setRenderImageOpen(false);
          setRenderAnimOpen(false);
        }}
        onToggleLayers={() => setShowLayers(s => !s)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenNewProject={() => { setShowNewProject(true); setActiveMenu(null); }}
        onSaveProject={saveProject}
        onOpenProject={() => { projectInputRef.current?.click(); setActiveMenu(null); }}
        onOpenImageLayer={() => { fileInputRef.current?.click(); setActiveMenu(null); }}
        onRenderImage={renderImage}
        onRenderAnimation={renderAnimation}
        onSetRenderImageOpen={setRenderImageOpen}
        onSetRenderAnimOpen={setRenderAnimOpen}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleOpenProject}
        className="hidden"
      />

      <input
        ref={projectInputRef}
        type="file"
        accept=".draft,application/json"
        onChange={openProject}
        className="hidden"
      />

      <main
        ref={containerRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        onDrop={onMainDrop}
        onDragOver={onMainDragOver}
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
          brushOpacity={brushOpacity}
          eraserSize={eraserSize}
          eraserShape={eraserShape}
          isShapeFilled={isShapeFilled}
          brushType={brushType}
          fillOpacity={fillOpacity}
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
              if (activeTool !== tool) {
                setActiveTool(tool);
                activeToolRef.current = tool;
                setActivePopover(null);
              }
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
          setBrushOpacity={setBrushOpacity}
          setEraserSize={setEraserSize}
          setEraserShape={setEraserShape}
          setIsShapeFilled={setIsShapeFilled}
          setBrushType={setBrushType}
          setFillOpacity={setFillOpacity}
          updateFromHsv={updateFromHsv}
          handleHex={handleHex}
          handleRgb={handleRgb}
          onShowPreview={showPreviewAtCanvasCenter}
          onHidePreview={hidePreview}
          onUndo={undo}
          onRedo={redo}
        />

        <div
          ref={canvasWrapperRef}
          onPointerEnter={() => setIsInsideCanvas(true)}
          onPointerLeave={() => setIsInsideCanvas(false)}
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
          {imageTransform && (
            <ImageTransformOverlay
              transform={imageTransform}
              canvasSize={canvasSize}
              wrapperRef={canvasWrapperRef}
              onChange={setImageTransform}
              isDark={isDark}
            />
          )}
          {imageTransform && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md text-[11px] font-mono z-20 bg-blue-600 text-white shadow-lg pointer-events-none">
              Enter — apply · Esc — cancel
            </div>
          )}
        </div>
      </main>

      <Timeline
        isDark={isDark}
        panel={panel}
        border={border}
        muted={muted}
        btnBase={btnBase}
        activeLayerId={activeLayerId}
        frameOrder={frameOrderRef.current}
        frameMeta={frameMetaRef.current}
        currentFrame={currentFrame}
        fps={fps}
        isPlaying={isPlaying}
        onionPrev={onionPrev}
        onionNext={onionNext}
        onionOpacity={onionOpacity}
        canvasSize={canvasSize}
        getFrameCanvas={getFrameCanvasById}
        timelineVersion={timelineVersion}
        t={t}
        onSelectFrame={selectFrame}
        onPlayPause={onPlayPause}
        onStop={onStopPlayback}
        onFirst={() => selectFrame(0)}
        onPrev={() => selectFrame(Math.max(0, currentFrameRef.current - 1))}
        onNext={() => selectFrame(Math.min(frameOrderRef.current.length - 1, currentFrameRef.current + 1))}
        onLast={() => selectFrame(frameOrderRef.current.length - 1)}
        onAddFrame={addFrame}
        onDuplicateFrame={duplicateFrame}
        onDeleteFrame={deleteFrame}
        onClearFrame={clearFrame}
        onSetFps={setFps}
        onSetOnionPrev={setOnionPrev}
        onSetOnionNext={setOnionNext}
        onSetOnionOpacity={setOnionOpacity}
      />

      {(activeTool === 'pencil' || activeTool === 'eraser') && isInsideCanvas && ringSize > 0 && !imageTransform && (
        <div
          ref={cursorRingRef}
          className="fixed top-0 left-0 pointer-events-none z-[100] rounded-full"
          style={{
            width: `${ringSize * zoomRef.current}px`,
            height: `${ringSize * zoomRef.current}px`,
            transform: 'translate3d(-9999px, -9999px, 0)',
            border: `1px solid ${activeTool === 'eraser' ? 'rgba(239,68,68,0.55)' : 'rgba(59,130,246,0.7)'}`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.6)',
            willChange: 'transform',
          }}
        />
      )}

      <div
        ref={previewCircleRef}
        className="fixed pointer-events-none z-[105] rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          border: `1.5px solid ${activeTool === 'eraser' ? 'rgba(239,68,68,0.55)' : '#3b82f6'}`,
          backgroundColor: activeTool === 'pencil' ? `${selectedColor}33` : 'transparent',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.55)',
          display: 'none',
        }}
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
          layerCanvases={currentFrameLayerCanvases}
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