import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { HistoryEntry, HistoryRegion, Point } from '../lib/types';
import { packHistoryPair } from '../lib/history';

type CanvasMap = Map<string, Map<string, HTMLCanvasElement>>;
type LassoMode = 'draw' | 'selected' | 'move' | null;

export interface UseHistoryArgs {
  framesRef: MutableRefObject<CanvasMap>;
  historyRef: MutableRefObject<HistoryEntry[]>;
  redoRef: MutableRefObject<HistoryEntry[]>;
  activeLayerIdRef: MutableRefObject<string>;

  lassoPathRef: MutableRefObject<Point[]>;
  lassoPolyRef: MutableRefObject<Point[]>;
  lassoBufferRef: MutableRefObject<HTMLCanvasElement | null>;
  lassoBBoxRef: MutableRefObject<Point>;
  lassoOffsetRef: MutableRefObject<Point>;
  lassoModeRef: MutableRefObject<LassoMode>;
  lassoMoveStartRef: MutableRefObject<Point | null>;
  lassoPreSnapshotRef: MutableRefObject<ImageData | null>;

  getCurrentFrameId: () => string | null;
  getFrameCanvasById: (layerId: string, frameId: string) => HTMLCanvasElement | null;
  renderComposite: () => void;
  bumpThumbs: () => void;
  bumpTimeline: () => void;
  setHasSelection: (v: boolean) => void;
}

export function useHistory({
  framesRef, historyRef, redoRef, activeLayerIdRef,
  lassoPathRef, lassoPolyRef, lassoBufferRef, lassoBBoxRef, lassoOffsetRef,
  lassoModeRef, lassoMoveStartRef, lassoPreSnapshotRef,
  getCurrentFrameId, getFrameCanvasById,
  renderComposite, bumpThumbs, bumpTimeline, setHasSelection,
}: UseHistoryArgs) {
  const snapshot = useCallback((layerId: string, frameId: string): ImageData | null => {
    const c = framesRef.current.get(layerId)?.get(frameId);
    if (!c) return null;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    return ctx.getImageData(0, 0, c.width, c.height);
  }, [framesRef]);

  const restoreSnap = useCallback((layerId: string, frameId: string, data: ImageData | null) => {
    if (!data) return;
    const c = framesRef.current.get(layerId)?.get(frameId);
    if (!c) return;
    c.getContext('2d')!.putImageData(data, 0, 0);
  }, [framesRef]);

  const restoreRegion = useCallback((layerId: string, frameId: string, region: HistoryRegion | null) => {
    if (!region) return;
    const c = framesRef.current.get(layerId)?.get(frameId);
    if (!c) return;
    c.getContext('2d')!.putImageData(region.data, region.x, region.y);
  }, [framesRef]);

  const pushHistory = useCallback((
    layerId: string,
    frameId: string,
    before: ImageData | null,
    after: ImageData | null,
    label: string,
  ) => {
    redoRef.current = [];
    const pair = packHistoryPair(before, after);
    if (!pair) return;
    historyRef.current.push({
      layerId, frameId,
      before: pair.before,
      after: pair.after,
      label,
    });
    if (historyRef.current.length > 30) historyRef.current.shift();
  }, [historyRef, redoRef]);

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
  }, [
    lassoPathRef, lassoPolyRef, lassoBufferRef, lassoBBoxRef,
    lassoOffsetRef, lassoModeRef, lassoMoveStartRef, lassoPreSnapshotRef,
    setHasSelection,
  ]);

  const commitLasso = useCallback((label = 'Lasso') => {
    const mode = lassoModeRef.current;
    const lid = activeLayerIdRef.current;
    const fid = getCurrentFrameId();
    const lc = fid ? getFrameCanvasById(lid, fid) : null;
    const buffer = lassoBufferRef.current;
    const poly = lassoPolyRef.current;

    if ((mode === 'selected' || mode === 'move') && lc && buffer && poly.length >= 3) {
      const offset = lassoOffsetRef.current;
      const bbox = lassoBBoxRef.current;
      const ctx = lc.getContext('2d');
      if (ctx) ctx.drawImage(buffer, bbox.x + offset.x, bbox.y + offset.y);
    }

    const before = lassoPreSnapshotRef.current;
    const after = fid ? snapshot(lid, fid) : null;
    if (before && after && fid) pushHistory(lid, fid, before, after, label);

    renderComposite();
    bumpThumbs(); bumpTimeline();
    clearLassoState();
  }, [
    lassoModeRef, activeLayerIdRef, lassoBufferRef, lassoPolyRef,
    lassoOffsetRef, lassoBBoxRef, lassoPreSnapshotRef,
    getCurrentFrameId, getFrameCanvasById, snapshot, pushHistory,
    renderComposite, bumpThumbs, bumpTimeline, clearLassoState,
  ]);

  const cancelLasso = useCallback(() => {
    const snap = lassoPreSnapshotRef.current;
    const fid = getCurrentFrameId();
    if (snap && fid) {
      restoreSnap(activeLayerIdRef.current, fid, snap);
      renderComposite();
      bumpThumbs(); bumpTimeline();
    }
    clearLassoState();
  }, [
    lassoPreSnapshotRef, activeLayerIdRef, getCurrentFrameId,
    restoreSnap, renderComposite, bumpThumbs, bumpTimeline, clearLassoState,
  ]);

  const undo = useCallback(() => {
    if (lassoModeRef.current !== null) {
      const snap = lassoPreSnapshotRef.current;
      const fid = getCurrentFrameId();
      if (snap && fid) restoreSnap(activeLayerIdRef.current, fid, snap);
      clearLassoState();
      renderComposite();
      return;
    }
    const entry = historyRef.current.pop();
    if (!entry) return;
    restoreRegion(entry.layerId, entry.frameId, entry.before);
    redoRef.current.push(entry);
    renderComposite(); bumpThumbs(); bumpTimeline();
  }, [
    lassoModeRef, lassoPreSnapshotRef, activeLayerIdRef, getCurrentFrameId,
    restoreSnap, restoreRegion, clearLassoState,
    historyRef, redoRef, renderComposite, bumpThumbs, bumpTimeline,
  ]);

  const redo = useCallback(() => {
    const entry = redoRef.current.pop();
    if (!entry) return;
    restoreRegion(entry.layerId, entry.frameId, entry.after);
    historyRef.current.push(entry);
    renderComposite(); bumpThumbs(); bumpTimeline();
  }, [
    redoRef, historyRef, restoreRegion,
    renderComposite, bumpThumbs, bumpTimeline,
  ]);

  return {
    snapshot,
    pushHistory,
    undo,
    redo,
    clearLassoState,
    commitLasso,
    cancelLasso,
  };
}