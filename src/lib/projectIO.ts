import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type {
  DraftProjectData,
  DraftLayerData,
  DraftFrameMeta,
  LayerMeta,
} from './types';
import type { AnimationFrame } from '../animation/types';

/* ─────────────────────────────────────────────────────────────────
 * Сериализация проекта в .draft (JSON + base64 PNG)
 * ───────────────────────────────────────────────────────────────── */

export interface SerializeInput {
  canvasSize: { w: number; h: number };
  canvasBg: string;
  frameOrder: string[];
  frameMeta: Map<string, AnimationFrame>;
  layers: LayerMeta[];
  activeLayerId: string;
  currentFrame: number;
  fps: number;
  onion: { prev: number; next: number; opacity: number };
  /** framesRef: layerId → frameId → canvas */
  canvases: Map<string, Map<string, HTMLCanvasElement>>;
}

export function serializeProject(input: SerializeInput): DraftProjectData {
  const layers: DraftLayerData[] = input.layers.map(l => ({
    id: l.id,
    name: l.name,
    visible: l.visible,
    locked: l.locked,
  }));

  const frameMeta: DraftFrameMeta[] = input.frameOrder
    .map(fid => input.frameMeta.get(fid))
    .filter((f): f is AnimationFrame => !!f)
    .map(f => ({ id: f.id, duration: f.duration }));

  const canvases: Record<string, Record<string, string>> = {};
  for (const layer of input.layers) {
    const layerMap = input.canvases.get(layer.id);
    if (!layerMap) continue;
    const out: Record<string, string> = {};
    for (const fid of input.frameOrder) {
      const c = layerMap.get(fid);
      if (!c) continue;
      out[fid] = c.toDataURL('image/png');
    }
    canvases[layer.id] = out;
  }

  return {
    format: 'zuno-draft',
    version: 1,
    savedAt: new Date().toISOString(),
    canvasSize: input.canvasSize,
    canvasBg: input.canvasBg,
    frameOrder: [...input.frameOrder],
    frameMeta,
    layers,
    activeLayerId: input.activeLayerId,
    currentFrame: input.currentFrame,
    fps: input.fps,
    onion: { ...input.onion },
    canvases,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveProjectToFile(data: DraftProjectData, filename = `draft-${Date.now()}.draft`) {
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/* ─────────────────────────────────────────────────────────────────
 * Десериализация .draft
 * ───────────────────────────────────────────────────────────────── */

export interface DeserializeResult {
  data: DraftProjectData;
  /** Готовые canvas-ы: layerId → frameId → canvas */
  canvases: Map<string, Map<string, HTMLCanvasElement>>;
}

/** Восстанавливает canvas-ы из base64-строк. Асинхронно, потому что Image.onload. */
export async function deserializeProject(data: DraftProjectData): Promise<DeserializeResult> {
  if (data.format !== 'zuno-draft') {
    throw new Error('Invalid .draft file');
  }
  const { w, h } = data.canvasSize;
  const canvases = new Map<string, Map<string, HTMLCanvasElement>>();

  for (const layer of data.layers) {
    const layerMap = new Map<string, HTMLCanvasElement>();
    const srcLayer = data.canvases[layer.id];
    for (const fid of data.frameOrder) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const src = srcLayer?.[fid];
      if (src) {
        const img = await loadImage(src);
        const ctx = c.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
      }
      layerMap.set(fid, c);
    }
    canvases.set(layer.id, layerMap);
  }

  return { data, canvases };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ─────────────────────────────────────────────────────────────────
 * Рендер composite-кадра на offscreen canvas
 * ───────────────────────────────────────────────────────────────── */

function renderFrameToCanvas(
  out: HTMLCanvasElement,
  fid: string,
  layers: LayerMeta[],
  canvases: Map<string, Map<string, HTMLCanvasElement>>,
  canvasBg: string,
) {
  const ctx = out.getContext('2d');
  if (!ctx) return;
  const { w, h } = { w: out.width, h: out.height };
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = canvasBg;
  ctx.fillRect(0, 0, w, h);
  for (const layer of layers) {
    if (!layer.visible) continue;
    const lc = canvases.get(layer.id)?.get(fid);
    if (!lc) continue;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lc, 0, 0);
  }
}

/* ─────────────────────────────────────────────────────────────────
 * Экспорт анимации — видео (WebM / MP4 через MediaRecorder)
 * ───────────────────────────────────────────────────────────────── */

export type VideoFormat = 'webm' | 'mp4';

export function isVideoFormatSupported(format: VideoFormat): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  const mime = format === 'webm' ? 'video/webm' : 'video/mp4';
  return MediaRecorder.isTypeSupported(mime);
}

export interface ExportAnimationVideoInput {
  format: VideoFormat;
  fps: number;
  canvasSize: { w: number; h: number };
  canvasBg: string;
  frameOrder: string[];
  layers: LayerMeta[];
  canvases: Map<string, Map<string, HTMLCanvasElement>>;
  onProgress?: (ratio: number) => void;
}

export async function exportAnimationVideo(input: ExportAnimationVideoInput): Promise<Blob> {
  const { format, fps, canvasSize, canvasBg, frameOrder, layers, canvases, onProgress } = input;
  const { w, h } = canvasSize;

  if (frameOrder.length === 0) throw new Error('No frames');
  if (!isVideoFormatSupported(format)) {
    throw new Error(`Format ${format} is not supported by this browser`);
  }

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;

  const mime = format === 'webm' ? 'video/webm' : 'video/mp4';
  const stream = out.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  const frameDelay = 1000 / Math.max(1, fps);
  for (let i = 0; i < frameOrder.length; i++) {
    const fid = frameOrder[i];
    renderFrameToCanvas(out, fid, layers, canvases, canvasBg);
    onProgress?.((i + 1) / frameOrder.length);
    await new Promise(r => setTimeout(r, frameDelay));
  }

  // Небольшая задержка, чтобы последний кадр попал в поток.
  await new Promise(r => setTimeout(r, frameDelay * 1.5));

  recorder.stop();

  return done;
}

/* ─────────────────────────────────────────────────────────────────
 * Экспорт анимации — GIF через gifenc
 * ───────────────────────────────────────────────────────────────── */

export interface ExportAnimationGifInput {
  fps: number;
  canvasSize: { w: number; h: number };
  canvasBg: string;
  frameOrder: string[];
  layers: LayerMeta[];
  canvases: Map<string, Map<string, HTMLCanvasElement>>;
  onProgress?: (ratio: number) => void;
}

export async function exportAnimationGif(input: ExportAnimationGifInput): Promise<Blob> {
  const { fps, canvasSize, canvasBg, frameOrder, layers, canvases, onProgress } = input;
  const { w, h } = canvasSize;

  if (frameOrder.length === 0) throw new Error('No frames');

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Cannot get 2d context');

  const encoder = GIFEncoder();
  const delay = Math.round(1000 / Math.max(1, fps));

  // Квантуем палитру по первому кадру — используем её для всех кадров.
  // Это стандартный компромисс: одна общая палитра даёт меньший размер файла,
  // но чуть меньше точности цвета в отдельных кадрах.
  let globalPalette: number[][] | null = null;

  for (let i = 0; i < frameOrder.length; i++) {
    const fid = frameOrder[i];
    renderFrameToCanvas(out, fid, layers, canvases, canvasBg);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = new Uint8ClampedArray(imageData.data.buffer);

    if (!globalPalette) {
      globalPalette = quantize(data, 256);
    }

    const index = applyPalette(data, globalPalette);
    encoder.writeFrame(index, w, h, {
      palette: globalPalette,
      delay,
    });

    onProgress?.((i + 1) / frameOrder.length);

    // Даём браузеру дыхание между кадрами, чтобы UI не замирал.
    if (i % 3 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  encoder.finish();
  const bytes = encoder.bytes();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: 'image/gif' });
}