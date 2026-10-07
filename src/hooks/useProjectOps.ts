import { useCallback } from 'react';
import type { MutableRefObject, ChangeEvent } from 'react';
import type { LayerMeta, HistoryEntry, Point, DraftProjectData } from '../lib/types';
import type { AnimationFrame } from '../animation/types';
import { uid } from '../lib/constants';
import { createEmptyCanvas, cloneCanvas, createFrame } from '../animation/frameManager';
import {
  serializeProject,
  saveProjectToFile,
  deserializeProject,
  exportAnimationVideo,
  exportAnimationGif,
  downloadBlob,
} from '../lib/projectIO';

type CanvasMap = Map<string, Map<string, HTMLCanvasElement>>;
type LassoMode = 'draw' | 'selected' | 'move' | null;
type ActiveMenu = 'file' | 'render' | null;

export interface UseProjectOpsArgs {
  layersRef: MutableRefObject<LayerMeta[]>;
  framesRef: MutableRefObject<CanvasMap>;
  frameOrderRef: MutableRefObject<string[]>;
  frameMetaRef: MutableRefObject<Map<string, AnimationFrame>>;
  frameCountRef: MutableRefObject<number>;
  currentFrameRef: MutableRefObject<number>;
  activeLayerIdRef: MutableRefObject<string>;
  historyRef: MutableRefObject<HistoryEntry[]>;
  redoRef: MutableRefObject<HistoryEntry[]>;
  canvasSizeRef: MutableRefObject<{ w: number; h: number }>;
  canvasBgRef: MutableRefObject<string>;
  baseCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  canvasWrapperRef: MutableRefObject<HTMLDivElement | null>;
  zoomRef: MutableRefObject<number>;
  panRef: MutableRefObject<Point>;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  projectInputRef: MutableRefObject<HTMLInputElement | null>;
  lassoModeRef: MutableRefObject<LassoMode>;
  fpsRef: MutableRefObject<number>;
  onionSettingsRef: MutableRefObject<{ enabled: boolean; prev: number; next: number; opacity: number }>;

  setActiveLayerId: (id: string) => void;
  setCurrentFrame: (n: number) => void;
  setCanvasSize: (n: { w: number; h: number }) => void;
  setCanvasBg: (v: string) => void;
  setIsPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
  setShowNewProject: (v: boolean) => void;
  setActiveMenu: (v: ActiveMenu) => void;
  setFps: (n: number) => void;
  setOnionPrev: (n: number) => void;
  setOnionNext: (n: number) => void;
  setOnionOpacity: (n: number) => void;

  bumpLayers: () => void;
  bumpThumbs: () => void;
  bumpTimeline: () => void;

  snapshot: (layerId: string, frameId: string) => ImageData | null;
  pushHistory: (
    layerId: string,
    frameId: string,
    before: ImageData | null,
    after: ImageData | null,
    label: string,
    bounds?: { x: number; y: number; w: number; h: number } | null,
  ) => void;
  commitLasso: (label?: string) => void;

  renderComposite: () => void;
  getCurrentFrameId: () => string | null;
  getFrameCanvasById: (layerId: string, frameId: string) => HTMLCanvasElement | null;

  /** Колбэк, вызываемый после декодирования импортируемого изображения. */
  onImageLoaded: (img: HTMLImageElement) => void;
}

export function useProjectOps({
  layersRef, framesRef, frameOrderRef, frameMetaRef, frameCountRef, currentFrameRef,
  activeLayerIdRef, historyRef, redoRef,
  canvasSizeRef, canvasBgRef, baseCanvasRef, overlayCanvasRef,
  containerRef, canvasWrapperRef, zoomRef, panRef,
  fileInputRef, projectInputRef, lassoModeRef,
  fpsRef, onionSettingsRef,
  setActiveLayerId, setCurrentFrame, setCanvasSize, setCanvasBg, setIsPlaying,
  setShowNewProject, setActiveMenu, setFps,
  setOnionPrev, setOnionNext, setOnionOpacity,
  bumpLayers, bumpThumbs, bumpTimeline,
  snapshot, pushHistory, commitLasso,
  renderComposite, getCurrentFrameId, getFrameCanvasById,
  onImageLoaded,
}: UseProjectOpsArgs) {
  const findLayer = useCallback((id: string): LayerMeta | null => {
    for (const l of layersRef.current) if (l.id === id) return l;
    return null;
  }, [layersRef]);

  const addLayer = useCallback(() => {
    const { w, h } = canvasSizeRef.current;
    const id = uid();
    const frameMap = new Map<string, HTMLCanvasElement>();
    for (const fid of frameOrderRef.current) {
      frameMap.set(fid, createEmptyCanvas(w, h));
    }
    framesRef.current.set(id, frameMap);
    layersRef.current.push({
      id,
      name: `Layer ${layersRef.current.length + 1}`,
      visible: true,
      locked: false,
    });
    setActiveLayerId(id);
    activeLayerIdRef.current = id;
    bumpLayers(); renderComposite(); bumpThumbs(); bumpTimeline();
  }, [
    canvasSizeRef, frameOrderRef, framesRef, layersRef,
    setActiveLayerId, activeLayerIdRef,
    bumpLayers, renderComposite, bumpThumbs, bumpTimeline,
  ]);

  const deleteLayer = useCallback((id: string) => {
    const idx = layersRef.current.findIndex(l => l.id === id);
    if (idx < 0) return;
    if (layersRef.current.length <= 1) return;
    layersRef.current.splice(idx, 1);
    framesRef.current.delete(id);
    historyRef.current = historyRef.current.filter(e => e.layerId !== id);
    redoRef.current = redoRef.current.filter(e => e.layerId !== id);
    if (activeLayerIdRef.current === id) {
      const next = layersRef.current[Math.min(idx, layersRef.current.length - 1)];
      setActiveLayerId(next.id);
      activeLayerIdRef.current = next.id;
    }
    bumpLayers(); renderComposite(); bumpTimeline();
  }, [
    layersRef, framesRef, historyRef, redoRef, activeLayerIdRef,
    setActiveLayerId, bumpLayers, renderComposite, bumpTimeline,
  ]);

  const moveLayerTo = useCallback((dragId: string, targetId: string, position: 'above' | 'below') => {
    const dragIdx = layersRef.current.findIndex(l => l.id === dragId);
    if (dragIdx < 0) return;
    const [drag] = layersRef.current.splice(dragIdx, 1);
    const tIdx = layersRef.current.findIndex(l => l.id === targetId);
    if (tIdx < 0) { layersRef.current.splice(dragIdx, 0, drag); return; }
    layersRef.current.splice(position === 'above' ? tIdx + 1 : tIdx, 0, drag);
    bumpLayers(); renderComposite();
  }, [layersRef, bumpLayers, renderComposite]);

  const setLayerProp = useCallback((id: string, patch: Partial<LayerMeta>) => {
    const l = findLayer(id);
    if (!l) return;
    Object.assign(l, patch);
    bumpLayers(); renderComposite();
  }, [findLayer, bumpLayers, renderComposite]);

  const selectFrame = useCallback((idx: number) => {
    if (idx < 0 || idx >= frameOrderRef.current.length) return;
    if (lassoModeRef.current !== null) commitLasso('Lasso');
    currentFrameRef.current = idx;
    setCurrentFrame(idx);
    const o = overlayCanvasRef.current;
    if (o) {
      const { w, h } = canvasSizeRef.current;
      o.getContext('2d')?.clearRect(0, 0, w, h);
    }
    renderComposite();
    bumpTimeline();
  }, [
    frameOrderRef, lassoModeRef, commitLasso,
    currentFrameRef, setCurrentFrame, overlayCanvasRef, canvasSizeRef,
    renderComposite, bumpTimeline,
  ]);

  const addFrame = useCallback(() => {
    const { w, h } = canvasSizeRef.current;
    const frame = createFrame();
    for (const layer of layersRef.current) {
      if (!framesRef.current.has(layer.id)) framesRef.current.set(layer.id, new Map());
      framesRef.current.get(layer.id)!.set(frame.id, createEmptyCanvas(w, h));
    }
    const insertAt = currentFrameRef.current + 1;
    frameOrderRef.current.splice(insertAt, 0, frame.id);
    frameMetaRef.current.set(frame.id, frame);
    frameCountRef.current = frameOrderRef.current.length;
    currentFrameRef.current = insertAt;
    setCurrentFrame(insertAt);
    renderComposite();
    bumpTimeline();
  }, [
    canvasSizeRef, layersRef, framesRef, currentFrameRef,
    frameOrderRef, frameMetaRef, frameCountRef,
    setCurrentFrame, renderComposite, bumpTimeline,
  ]);

  const duplicateFrame = useCallback(() => {
    const { w, h } = canvasSizeRef.current;
    const srcId = frameOrderRef.current[currentFrameRef.current];
    if (!srcId) return;
    const frame = createFrame();
    for (const layer of layersRef.current) {
      if (!framesRef.current.has(layer.id)) framesRef.current.set(layer.id, new Map());
      const src = framesRef.current.get(layer.id)?.get(srcId);
      const dst = src ? cloneCanvas(src) : createEmptyCanvas(w, h);
      framesRef.current.get(layer.id)!.set(frame.id, dst);
    }
    const insertAt = currentFrameRef.current + 1;
    frameOrderRef.current.splice(insertAt, 0, frame.id);
    frameMetaRef.current.set(frame.id, frame);
    frameCountRef.current = frameOrderRef.current.length;
    currentFrameRef.current = insertAt;
    setCurrentFrame(insertAt);
    renderComposite();
    bumpTimeline();
  }, [
    canvasSizeRef, frameOrderRef, currentFrameRef, layersRef, framesRef,
    frameMetaRef, frameCountRef, setCurrentFrame, renderComposite, bumpTimeline,
  ]);

  const deleteFrame = useCallback(() => {
    if (frameOrderRef.current.length <= 1) return;
    const idx = currentFrameRef.current;
    const fid = frameOrderRef.current[idx];
    if (!fid) return;
    for (const layer of layersRef.current) {
      framesRef.current.get(layer.id)?.delete(fid);
    }
    frameMetaRef.current.delete(fid);
    frameOrderRef.current.splice(idx, 1);
    historyRef.current = historyRef.current.filter(e => e.frameId !== fid);
    redoRef.current = redoRef.current.filter(e => e.frameId !== fid);
    frameCountRef.current = frameOrderRef.current.length;
    const nextIdx = Math.max(0, Math.min(idx, frameOrderRef.current.length - 1));
    currentFrameRef.current = nextIdx;
    setCurrentFrame(nextIdx);
    renderComposite();
    bumpTimeline();
  }, [
    frameOrderRef, currentFrameRef, layersRef, framesRef, frameMetaRef,
    historyRef, redoRef, frameCountRef,
    setCurrentFrame, renderComposite, bumpTimeline,
  ]);

  const clearFrame = useCallback(() => {
    const fid = frameOrderRef.current[currentFrameRef.current];
    if (!fid) return;

    const lid = activeLayerIdRef.current;
    const layer = findLayer(lid);
    if (!layer || layer.locked || !layer.visible) return;

    const c = framesRef.current.get(lid)?.get(fid);
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const before = snapshot(lid, fid);
    ctx.clearRect(0, 0, c.width, c.height);
    const after = snapshot(lid, fid);

    if (before && after) pushHistory(lid, fid, before, after, 'Clear frame');

    renderComposite();
    bumpTimeline(); bumpThumbs();
  }, [
    frameOrderRef, currentFrameRef, activeLayerIdRef, findLayer, framesRef,
    snapshot, pushHistory, renderComposite, bumpTimeline, bumpThumbs,
  ]);

  const advanceFrame = useCallback((next: number) => {
    currentFrameRef.current = next;
    setCurrentFrame(next);
    renderComposite();
  }, [currentFrameRef, setCurrentFrame, renderComposite]);

  const onPlayPause = useCallback(() => {
    setIsPlaying(p => !p);
  }, [setIsPlaying]);

  const onStopPlayback = useCallback(() => {
    setIsPlaying(false);
    selectFrame(0);
  }, [setIsPlaying, selectFrame]);

  const renderImage = useCallback((fmt: 'png' | 'jpeg', onlyActive: boolean = false) => {
    const comp = document.createElement('canvas');
    const { w, h } = canvasSizeRef.current;
    comp.width = w;
    comp.height = h;
    const ctx = comp.getContext('2d')!;
    const fid = getCurrentFrameId();
    if (onlyActive) {
      if (fid) {
        const lc = getFrameCanvasById(activeLayerIdRef.current, fid);
        if (lc) ctx.drawImage(lc, 0, 0);
      }
    } else {
      ctx.fillStyle = canvasBgRef.current;
      ctx.fillRect(0, 0, w, h);
      if (fid) {
        for (const layer of layersRef.current) {
          if (!layer.visible) continue;
          const lc = framesRef.current.get(layer.id)?.get(fid);
          if (!lc) continue;
          ctx.drawImage(lc, 0, 0);
        }
      }
    }
    const mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    const quality = fmt === 'png' ? undefined : 0.92;
    const link = document.createElement('a');
    link.download = `draft-${Date.now()}.${fmt}`;
    link.href = comp.toDataURL(mime, quality);
    link.click();
    setActiveMenu(null);
  }, [
    canvasSizeRef, getCurrentFrameId, getFrameCanvasById, activeLayerIdRef,
    canvasBgRef, layersRef, framesRef, setActiveMenu,
  ]);

  const renderAnimation = useCallback(async (fmt: 'webm' | 'mp4' | 'gif') => {
    const { w, h } = canvasSizeRef.current;
    if (frameOrderRef.current.length === 0) return;

    const input = {
      fps: fpsRef.current || 12,
      canvasSize: { w, h },
      canvasBg: canvasBgRef.current,
      frameOrder: [...frameOrderRef.current],
      layers: [...layersRef.current],
      canvases: framesRef.current,
    };

    try {
      if (fmt === 'gif') {
        const blob = await exportAnimationGif(input);
        downloadBlob(blob, `draft-${Date.now()}.gif`);
      } else {
        const blob = await exportAnimationVideo({ ...input, format: fmt });
        downloadBlob(blob, `draft-${Date.now()}.${fmt}`);
      }
    } catch (err) {
      console.error('Animation export failed:', err);
    }
    setActiveMenu(null);
  }, [
    canvasSizeRef, canvasBgRef, frameOrderRef, layersRef, framesRef,
    fpsRef, setActiveMenu,
  ]);

  const saveProject = useCallback(() => {
    const data = serializeProject({
      canvasSize: canvasSizeRef.current,
      canvasBg: canvasBgRef.current,
      frameOrder: frameOrderRef.current,
      frameMeta: frameMetaRef.current,
      layers: layersRef.current,
      activeLayerId: activeLayerIdRef.current,
      currentFrame: currentFrameRef.current,
      fps: fpsRef.current,
      onion: {
        prev: onionSettingsRef.current.prev,
        next: onionSettingsRef.current.next,
        opacity: onionSettingsRef.current.opacity,
      },
      canvases: framesRef.current,
    });
    saveProjectToFile(data);
    setActiveMenu(null);
  }, [
    canvasSizeRef, canvasBgRef, frameOrderRef, frameMetaRef, layersRef,
    activeLayerIdRef, currentFrameRef, fpsRef, onionSettingsRef, framesRef,
    setActiveMenu,
  ]);

  const openProject = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = ev.target?.result as string;
        const data = JSON.parse(raw) as DraftProjectData;

        if (data.format !== 'zuno-draft') {
          console.warn('Not a .draft file');
          return;
        }

        const { canvases } = await deserializeProject(data);

        layersRef.current = data.layers.map(l => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          locked: l.locked,
        }));

        const newMeta = new Map<string, AnimationFrame>();
        for (const fm of data.frameMeta) {
          newMeta.set(fm.id, { id: fm.id, duration: fm.duration });
        }

        framesRef.current = canvases;
        frameOrderRef.current = [...data.frameOrder];
        frameMetaRef.current = newMeta;
        frameCountRef.current = data.frameOrder.length;
        currentFrameRef.current = Math.max(0, Math.min(data.currentFrame, data.frameOrder.length - 1));
        activeLayerIdRef.current = data.activeLayerId;

        historyRef.current = [];
        redoRef.current = [];

        if (baseCanvasRef.current) {
          baseCanvasRef.current.width = data.canvasSize.w;
          baseCanvasRef.current.height = data.canvasSize.h;
        }
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = data.canvasSize.w;
          overlayCanvasRef.current.height = data.canvasSize.h;
        }

        canvasSizeRef.current = data.canvasSize;
        setCanvasSize(data.canvasSize);
        canvasBgRef.current = data.canvasBg;
        setCanvasBg(data.canvasBg);
        setActiveLayerId(data.activeLayerId);
        setCurrentFrame(currentFrameRef.current);
        setFps(data.fps);
        fpsRef.current = data.fps;
        setOnionPrev(data.onion.prev);
        setOnionNext(data.onion.next);
        setOnionOpacity(data.onion.opacity);
        setIsPlaying(false);

        setTimeout(() => {
          renderComposite();
          if (containerRef.current && canvasWrapperRef.current) {
            const r = containerRef.current.getBoundingClientRect();
            const { w, h } = data.canvasSize;
            const sx = (r.width * 0.85) / w;
            const sy = (r.height * 0.85) / h;
            const z = Math.min(Math.max(Math.min(sx, sy), 0.2), 1);
            zoomRef.current = z;
            const np = { x: (r.width - w * z) / 2, y: Math.max(20, (r.height - h * z) / 2) };
            panRef.current = np;
            canvasWrapperRef.current.style.transform = `translate3d(${np.x}px, ${np.y}px, 0) scale(${z})`;
          }
        }, 50);

        bumpLayers(); bumpTimeline(); bumpThumbs();
      } catch (err) {
        console.error('Failed to open project:', err);
      }
    };
    reader.readAsText(file);

    setActiveMenu(null);
    if (projectInputRef.current) projectInputRef.current.value = '';
  }, [
    layersRef, framesRef, frameOrderRef, frameMetaRef, frameCountRef,
    currentFrameRef, activeLayerIdRef, historyRef, redoRef,
    baseCanvasRef, overlayCanvasRef, canvasSizeRef, canvasBgRef,
    containerRef, canvasWrapperRef, zoomRef, panRef, fpsRef,
    setCanvasSize, setCanvasBg, setActiveLayerId, setCurrentFrame,
    setFps, setOnionPrev, setOnionNext, setOnionOpacity, setIsPlaying,
    renderComposite, bumpLayers, bumpTimeline, bumpThumbs,
    setActiveMenu, projectInputRef,
  ]);

  /**
   * Open Image — теперь только читает файл и передаёт <img> наружу.
   * Логика создания image-layer'а и трансформации — в App.tsx.
   */
  const handleOpenProject = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        onImageLoaded(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    setActiveMenu(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [setActiveMenu, fileInputRef, onImageLoaded]);

  const createNewProject = useCallback((w: number, h: number) => {
    const lid = uid();
    const firstFrame = createFrame();
    framesRef.current.clear();
    framesRef.current.set(lid, new Map([[firstFrame.id, createEmptyCanvas(w, h)]]));
    frameOrderRef.current = [firstFrame.id];
    frameMetaRef.current = new Map([[firstFrame.id, firstFrame]]);
    frameCountRef.current = 1;
    currentFrameRef.current = 0;
    setCurrentFrame(0);

    layersRef.current = [{ id: lid, name: 'Layer 1', visible: true, locked: false }];
    activeLayerIdRef.current = lid;
    setActiveLayerId(lid);
    historyRef.current = [];
    redoRef.current = [];
    if (baseCanvasRef.current) { baseCanvasRef.current.width = w; baseCanvasRef.current.height = h; }
    if (overlayCanvasRef.current) { overlayCanvasRef.current.width = w; overlayCanvasRef.current.height = h; }
    canvasSizeRef.current = { w, h };
    setCanvasSize({ w, h });
    setIsPlaying(false);
    bumpLayers(); bumpTimeline();
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
  }, [
    framesRef, frameOrderRef, frameMetaRef, frameCountRef, currentFrameRef,
    setCurrentFrame, layersRef, activeLayerIdRef, setActiveLayerId,
    historyRef, redoRef, baseCanvasRef, overlayCanvasRef,
    canvasSizeRef, setCanvasSize, setIsPlaying,
    bumpLayers, bumpTimeline, renderComposite,
    containerRef, canvasWrapperRef, zoomRef, panRef,
    setShowNewProject, setActiveMenu,
  ]);

  return {
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
  };
}