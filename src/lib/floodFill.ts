import { hexToRgb } from './color';

export function floodFill(
  ctx: CanvasRenderingContext2D,
  refData: Uint8ClampedArray,
  sx: number,
  sy: number,
  fillColor: string,
  W: number,
  H: number
) {
  sx = Math.round(sx); sy = Math.round(sy);
  if (sx < 0 || sx >= W || sy < 0 || sy >= H) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const target = hexToRgb(fillColor);
  if (!target) return;
  const sp = (sy * W + sx) * 4;
  const sR = refData[sp], sG = refData[sp+1], sB = refData[sp+2], sA = refData[sp+3];
  const TOL = 32;
  const match = (pos: number) =>
    Math.abs(refData[pos]-sR) <= TOL && Math.abs(refData[pos+1]-sG) <= TOL &&
    Math.abs(refData[pos+2]-sB) <= TOL && Math.abs(refData[pos+3]-sA) <= TOL;
  const stack: number[] = [sx, sy];
  const visited = new Uint8Array(W * H);
  while (stack.length > 0) {
    const y = stack.pop()!; const x = stack.pop()!;
    let cx = x;
    while (cx >= 0 && !visited[cx + y*W] && match((y*W + cx)*4)) cx--;
    cx++;
    let spanAbove = false, spanBelow = false;
    while (cx < W && !visited[cx + y*W] && match((y*W + cx)*4)) {
      const p = (y*W + cx) * 4;
      d[p] = target.r; d[p+1] = target.g; d[p+2] = target.b; d[p+3] = 255;
      visited[cx + y*W] = 1;
      if (y > 0) {
        const ai = cx + (y-1)*W;
        const ok = !visited[ai] && match(ai*4);
        if (ok && !spanAbove) { stack.push(cx, y-1); spanAbove = true; }
        else if (!ok) spanAbove = false;
      }
      if (y < H-1) {
        const bi = cx + (y+1)*W;
        const ok = !visited[bi] && match(bi*4);
        if (ok && !spanBelow) { stack.push(cx, y+1); spanBelow = true; }
        else if (!ok) spanBelow = false;
      }
      cx++;
    }
  }
  ctx.putImageData(img, 0, 0);
}