import { useEffect, useRef, useState } from 'react';

export interface ImageTransform {
  /** Исходный canvas с картинкой (в оригинальном размере). */
  canvas: HTMLCanvasElement;
  /** Позиция и размер в canvas-координатах. */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  transform: ImageTransform;
  canvasSize: { w: number; h: number };
  /** Родительский wrapper (canvasWrapper в App.tsx) — нужен, чтобы мерить текущий zoom. */
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onChange: (t: ImageTransform) => void;
  isDark: boolean;
}

type HandleCorner = 'nw' | 'ne' | 'sw' | 'se';
type DragMode = 'move' | HandleCorner;

const MIN_SIZE = 20;
const HANDLE_SIZE_PX = 12;

export default function ImageTransformOverlay({
  transform,
  canvasSize,
  wrapperRef,
  onChange,
  isDark,
}: Props) {
  const [scale, setScale] = useState(1);

  const dragRef = useRef<{
    mode: DragMode;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  /* Меряем zoom: canvasWrapper растянут через CSS transform, поэтому
   * отношение его ширины к ширине canvas — это и есть текущий scale. */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (canvasSize.w > 0) {
        const s = r.width / canvasSize.w;
        setScale(s > 0 ? s : 1);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasSize.w, wrapperRef]);

  /* Глобальные pointermove/pointerup во время drag. */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      const dx = (e.clientX - d.startClientX) / scale;
      const dy = (e.clientY - d.startClientY) / scale;

      if (d.mode === 'move') {
        onChange({
          ...transform,
          x: d.startX + dx,
          y: d.startY + dy,
        });
        return;
      }

      let x = d.startX;
      let y = d.startY;
      let w = d.startW;
      let h = d.startH;

      if (d.mode === 'nw') {
        x = d.startX + dx;
        y = d.startY + dy;
        w = Math.max(MIN_SIZE, d.startW - dx);
        h = Math.max(MIN_SIZE, d.startH - dy);
      } else if (d.mode === 'ne') {
        y = d.startY + dy;
        w = Math.max(MIN_SIZE, d.startW + dx);
        h = Math.max(MIN_SIZE, d.startH - dy);
      } else if (d.mode === 'sw') {
        x = d.startX + dx;
        w = Math.max(MIN_SIZE, d.startW - dx);
        h = Math.max(MIN_SIZE, d.startH + dy);
      } else if (d.mode === 'se') {
        w = Math.max(MIN_SIZE, d.startW + dx);
        h = Math.max(MIN_SIZE, d.startH + dy);
      }

      /* Сохраняем пропорции картинки. */
      const aspect = transform.canvas.width / transform.canvas.height;
      const wDelta = Math.abs(w - d.startW);
      const hDelta = Math.abs(h - d.startH);

      if (wDelta >= hDelta) {
        h = w / aspect;
      } else {
        w = h * aspect;
      }

      /* Для nw/sw пересчитываем позицию, чтобы противоположный угол стоял. */
      if (d.mode === 'nw') {
        x = d.startX + d.startW - w;
        y = d.startY + d.startH - h;
      } else if (d.mode === 'ne') {
        y = d.startY + d.startH - h;
      } else if (d.mode === 'sw') {
        x = d.startX + d.startW - w;
      }

      onChange({ ...transform, x, y, w, h });
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [scale, transform, onChange]);

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    /* Стопорим событие, чтобы оно не долетело до <main> с usePointerInput. */
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    dragRef.current = {
      mode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: transform.x,
      startY: transform.y,
      startW: transform.w,
      startH: transform.h,
    };
  };

  const cursorFor = (mode: HandleCorner): string =>
    mode === 'nw' || mode === 'se' ? 'nwse-resize' : 'nesw-resize';

  const dataUrl = transform.canvas.toDataURL('image/png');

  /* Размеры handle и рамки — в canvas-px. Чтобы после общего CSS-scale
   * (zoom wrapper'а) они выглядели одинаково на любом зуме, делим на scale. */
  const handleCss = HANDLE_SIZE_PX / scale;
  const borderCss = 2 / scale;

  return (
    <div
      className="absolute"
      style={{
        left: transform.x,
        top: transform.y,
        width: transform.w,
        height: transform.h,
        pointerEvents: 'auto',
        zIndex: 5,
        touchAction: 'none',
      }}
    >
      {/* Превью картинки */}
      <img
        src={dataUrl}
        onPointerDown={startDrag('move')}
        draggable={false}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'move',
          userSelect: 'none',
          pointerEvents: 'auto',
          outline: `${borderCss}px solid ${isDark ? '#3b82f6' : '#2563eb'}`,
          outlineOffset: 0,
        }}
      />

      {/* Угловые handles */}
      {(['nw', 'ne', 'sw', 'se'] as HandleCorner[]).map((pos) => {
        const isWest = pos === 'nw' || pos === 'sw';
        const isNorth = pos === 'nw' || pos === 'ne';
        return (
          <div
            key={pos}
            onPointerDown={startDrag(pos)}
            style={{
              position: 'absolute',
              width: handleCss,
              height: handleCss,
              left: isWest ? 0 : '100%',
              top: isNorth ? 0 : '100%',
              marginLeft: -handleCss / 2,
              marginTop: -handleCss / 2,
              background: isDark ? '#fafafa' : '#ffffff',
              border: `${borderCss}px solid #3b82f6`,
              borderRadius: 2 / scale,
              cursor: cursorFor(pos),
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
          />
        );
      })}
    </div>
  );
}