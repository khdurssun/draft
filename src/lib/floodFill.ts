import { hexToRgb } from './color';

/**
 * Заливка области.
 * - opacity: непрозрачность итоговых пикселей (0..1). По умолчанию 1.
 * - После основной заливки делается проход «дилатации» — закрывает
 *   anti-aliased пиксели по краям (иначе остаётся 1-2 px незалитыми).
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  refData: Uint8ClampedArray,
  sx: number,
  sy: number,
  fillColor: string,
  W: number,
  H: number,
  opacity: number = 1,
) {
  sx = Math.round(sx); sy = Math.round(sy);
  if (sx < 0 || sx >= W || sy < 0 || sy >= H) return;

  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const target = hexToRgb(fillColor);
  if (!target) return;

  const sp = (sy * W + sx) * 4;
  const sR = refData[sp], sG = refData[sp + 1], sB = refData[sp + 2], sA = refData[sp + 3];

  const TOL = 32;        // основной порог
  const EDGE_TOL = 96;   // порог для пикселей, граничащих с уже залитыми (anti-aliasing)
  const fillA = Math.max(0, Math.min(255, Math.round(255 * Math.max(0, Math.min(1, opacity)))));

  const match = (pos: number) =>
    Math.abs(refData[pos] - sR) <= TOL &&
    Math.abs(refData[pos + 1] - sG) <= TOL &&
    Math.abs(refData[pos + 2] - sB) <= TOL &&
    Math.abs(refData[pos + 3] - sA) <= TOL;

  const stack: number[] = [sx, sy];
  const visited = new Uint8Array(W * H);

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    let cx = x;
    while (cx >= 0 && !visited[cx + y * W] && match((y * W + cx) * 4)) cx--;
    cx++;
    let spanAbove = false, spanBelow = false;
    while (cx < W && !visited[cx + y * W] && match((y * W + cx) * 4)) {
      const p = (y * W + cx) * 4;
      d[p] = target.r;
      d[p + 1] = target.g;
      d[p + 2] = target.b;
      d[p + 3] = fillA;
      visited[cx + y * W] = 1;

      if (y > 0) {
        const ai = cx + (y - 1) * W;
        const ok = !visited[ai] && match(ai * 4);
        if (ok && !spanAbove) { stack.push(cx, y - 1); spanAbove = true; }
        else if (!ok) spanAbove = false;
      }
      if (y < H - 1) {
        const bi = cx + (y + 1) * W;
        const ok = !visited[bi] && match(bi * 4);
        if (ok && !spanBelow) { stack.push(cx, y + 1); spanBelow = true; }
        else if (!ok) spanBelow = false;
      }
      cx++;
    }
  }

  /* ─── Проход «дилатации» для anti-aliased края ───
   * Заполняем пиксели, которые граничат с уже залитыми и близки по цвету
   * (но не прошли основной TOL). Проходим 2 раза — этого хватает на сглаженный
   * 1-2px край. Не пропускает через чёткие контуры: слишком далёкие по цвету
   * пиксели отбрасываются EDGE_TOL.
   */
  const edgeMatch = (pos: number) =>
    Math.abs(refData[pos] - sR) <= EDGE_TOL &&
    Math.abs(refData[pos + 1] - sG) <= EDGE_TOL &&
    Math.abs(refData[pos + 2] - sB) <= EDGE_TOL &&
    Math.abs(refData[pos + 3] - sA) <= EDGE_TOL;

  for (let pass = 0; pass < 2; pass++) {
    let changed = false;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (visited[idx]) continue;
        const pos = idx * 4;
        if (!edgeMatch(pos)) continue;
        // Есть ли рядом залитый пиксель?
        const nb =
          (x > 0 && visited[idx - 1]) ||
          (x < W - 1 && visited[idx + 1]) ||
          (y > 0 && visited[idx - W]) ||
          (y < H - 1 && visited[idx + W]);
        if (!nb) continue;
        d[pos] = target.r;
        d[pos + 1] = target.g;
        d[pos + 2] = target.b;
        d[pos + 3] = fillA;
        visited[idx] = 1;
        changed = true;
      }
    }
    if (!changed) break;
  }

  ctx.putImageData(img, 0, 0);
}