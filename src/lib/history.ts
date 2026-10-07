import type { HistoryRegion } from './types';

export interface DiffBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clampBounds(b: DiffBounds, W: number, H: number): DiffBounds | null {
  const x0 = Math.max(0, Math.floor(b.x));
  const y0 = Math.max(0, Math.floor(b.y));
  const x1 = Math.min(W, Math.ceil(b.x + b.w));
  const y1 = Math.min(H, Math.ceil(b.y + b.h));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Упаковка пары ImageData в history-регион.
 *
 * Если bounds передан — diff ищется только внутри этого прямоугольника.
 * Если нет — по всему canvas (как раньше).
 */
export function packHistoryPair(
  before: ImageData | null,
  after: ImageData | null,
  bounds?: DiffBounds | null,
): { before: HistoryRegion | null; after: HistoryRegion | null } | null {
  if (!before && !after) return null;

  if (!before || !after) {
    return {
      before: before ? { data: before, x: 0, y: 0 } : null,
      after: after ? { data: after, x: 0, y: 0 } : null,
    };
  }

  if (before.width !== after.width || before.height !== after.height) {
    return {
      before: { data: before, x: 0, y: 0 },
      after: { data: after, x: 0, y: 0 },
    };
  }

  const W = before.width;
  const H = before.height;

  const scan = bounds ? clampBounds(bounds, W, H) : { x: 0, y: 0, w: W, h: H };
  if (!scan) return null;

  const b32 = new Uint32Array(before.data.buffer, before.data.byteOffset, W * H);
  const a32 = new Uint32Array(after.data.buffer, after.data.byteOffset, W * H);

  let minX = scan.x + scan.w;
  let minY = scan.y + scan.h;
  let maxX = -1;
  let maxY = -1;

  const xEnd = scan.x + scan.w;
  const yEnd = scan.y + scan.h;

  for (let y = scan.y; y < yEnd; y++) {
    const row = y * W;
    for (let x = scan.x; x < xEnd; x++) {
      if (b32[row + x] !== a32[row + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  const beforeRegion = new ImageData(bw, bh);
  const afterRegion = new ImageData(bw, bh);
  const bOut32 = new Uint32Array(beforeRegion.data.buffer);
  const aOut32 = new Uint32Array(afterRegion.data.buffer);

  for (let y = 0; y < bh; y++) {
    const srcRow = (minY + y) * W + minX;
    const dstRow = y * bw;
    bOut32.set(b32.subarray(srcRow, srcRow + bw), dstRow);
    aOut32.set(a32.subarray(srcRow, srcRow + bw), dstRow);
  }

  return {
    before: { data: beforeRegion, x: minX, y: minY },
    after: { data: afterRegion, x: minX, y: minY },
  };
}