import type { CanvasAction } from './types';
import { drawStrokeToCtx } from './brushes';
import { drawShapeToCtx } from './shapes';
import { tracePolygon } from './geometry';

export function drawActionToCtx(ctx: CanvasRenderingContext2D, action: CanvasAction) {
  if (action.type === 'stroke') {
    if (action.points.length < 1) return;
    drawStrokeToCtx(ctx, action, action.tool === 'eraser');
  } else if (action.type === 'shape') {
    drawShapeToCtx(ctx, action);
  } else if (action.type === 'lasso') {
    ctx.save();
    tracePolygon(ctx, action.polygon);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, 99999, 99999);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    if (!action.deleteOnly && action.buffer) {
      ctx.drawImage(action.buffer, action.bboxX + action.offset.x, action.bboxY + action.offset.y);
    }
  }
}