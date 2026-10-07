import type { HistoryRegion } from './types';

export function packHistoryPair(
  before: ImageData | null,
  after: ImageData | null,
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

  const w = before.width;
  const h = before.height;
  const b32 = new Uint32Array(before.data.buffer, before.data.byteOffset, w * h);
  const a32 = new Uint32Array(after.data.buffer, after.data.byteOffset, w * h);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
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
    const srcRow = (minY + y) * w + minX;
    const dstRow = y * bw;
    bOut32.set(b32.subarray(srcRow, srcRow + bw), dstRow);
    aOut32.set(a32.subarray(srcRow, srcRow + bw), dstRow);
  }

  return {
    before: { data: beforeRegion, x: minX, y: minY },
    after: { data: afterRegion, x: minX, y: minY },
  };
}