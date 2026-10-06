import { uid } from '../lib/constants';
import type { AnimationFrame } from './types';

export function createEmptyCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  if (ctx) ctx.drawImage(src, 0, 0);
  return c;
}

export function createFrame(duration = 100): AnimationFrame {
  return { id: uid(), duration };
}