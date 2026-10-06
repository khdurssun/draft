import { useEffect, useRef } from 'react';

interface Params {
  isPlaying: boolean;
  fpsRef: React.RefObject<number>;
  frameCountRef: React.RefObject<number>;
  currentFrameRef: React.RefObject<number>;
  onAdvance: (next: number) => void;
}

export function usePlayback({
  isPlaying, fpsRef, frameCountRef, currentFrameRef, onAdvance,
}: Params) {
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const accRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    lastRef.current = performance.now();
    accRef.current = 0;

    const tick = (now: number) => {
      const dt = now - lastRef.current;
      lastRef.current = now;
      accRef.current += dt;

      const fps = fpsRef.current ?? 12;
      const interval = 1000 / Math.max(1, fps);
      const total = frameCountRef.current ?? 1;

      if (accRef.current >= interval && total > 0) {
        accRef.current = accRef.current % interval;
        const next = ((currentFrameRef.current ?? 0) + 1) % total;
        onAdvance(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, fpsRef, frameCountRef, currentFrameRef, onAdvance]);
}