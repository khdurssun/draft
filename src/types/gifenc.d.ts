declare module 'gifenc' {
  export function GIFEncoder(opts?: Record<string, unknown>): {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: {
      palette?: number[][];
      delay?: number;
      first?: boolean;
      transparent?: boolean;
    }): void;
    finish(): void;
    bytes(): Uint8Array;
  };

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      oneBitAlpha?: boolean | number;
      clearAlpha?: boolean;
      clearAlphaThreshold?: number;
      clearAlphaColor?: number;
    }
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array;
}