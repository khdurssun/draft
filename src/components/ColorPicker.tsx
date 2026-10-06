import { useEffect } from 'react';

interface Props {
  isDark: boolean;
  border: string;
  muted: string;
  inputBg: string;
  textMain: string;
  hsv: { h: number; s: number; v: number };
  hexInput: string;
  rgbInput: { r: string; g: string; b: string };
  selectedColor: string;
  updateFromHsv: (n: { h: number; s: number; v: number }) => void;
  handleHex: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRgb: (ch: 'r' | 'g' | 'b', v: string) => void;
  satValRef: React.RefObject<HTMLCanvasElement | null>;
  hueRef: React.RefObject<HTMLCanvasElement | null>;
}

export default function ColorPicker({
  isDark, border, muted, inputBg, textMain,
  hsv, hexInput, rgbInput, selectedColor,
  updateFromHsv, handleHex, handleRgb, satValRef, hueRef,
}: Props) {
  useEffect(() => {
    const s = satValRef.current, h = hueRef.current;
    if (!s || !h) return;
    const sc = s.getContext('2d');
    if (sc) {
      sc.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
      sc.fillRect(0, 0, s.width, s.height);
      const wg = sc.createLinearGradient(0, 0, s.width, 0);
      wg.addColorStop(0, 'rgba(255,255,255,1)');
      wg.addColorStop(1, 'rgba(255,255,255,0)');
      sc.fillStyle = wg; sc.fillRect(0, 0, s.width, s.height);
      const bg = sc.createLinearGradient(0, 0, 0, s.height);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(1, 'rgba(0,0,0,1)');
      sc.fillStyle = bg; sc.fillRect(0, 0, s.width, s.height);
    }
    const hc = h.getContext('2d');
    if (hc) {
      const g = hc.createLinearGradient(0, 0, h.width, 0);
      g.addColorStop(0, '#F00'); g.addColorStop(0.17, '#FF0');
      g.addColorStop(0.33, '#0F0'); g.addColorStop(0.5, '#0FF');
      g.addColorStop(0.67, '#00F'); g.addColorStop(0.83, '#F0F');
      g.addColorStop(1, '#F00');
      hc.fillStyle = g; hc.fillRect(0, 0, h.width, h.height);
    }
  }, [hsv.h, satValRef, hueRef]);

  return (
    <div className={`absolute left-11 bottom-0 ${isDark ? 'bg-[#0f0f10]' : 'bg-white'} border ${border} rounded-xl p-3 shadow-2xl w-56 z-50 flex flex-col gap-2`}>
      <div className={`relative w-full h-32 rounded-md overflow-hidden border ${border} cursor-crosshair`}>
        <canvas
          ref={satValRef}
          width={216}
          height={128}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect();
            const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
            const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
            updateFromHsv({ ...hsv, s: (x/r.width)*100, v: (1-y/r.height)*100 });
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0) return;
            const r = e.currentTarget.getBoundingClientRect();
            const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
            const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
            updateFromHsv({ ...hsv, s: (x/r.width)*100, v: (1-y/r.height)*100 });
          }}
          className="w-full h-full block"
        />
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${hsv.s}%`, top: `${100-hsv.v}%`, backgroundColor: selectedColor }}
        />
      </div>
      <div className={`relative w-full h-2.5 rounded-md overflow-hidden border ${border} cursor-pointer`}>
        <canvas
          ref={hueRef}
          width={216}
          height={10}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect();
            const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
            updateFromHsv({ ...hsv, h: (x/r.width)*360 });
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0) return;
            const r = e.currentTarget.getBoundingClientRect();
            const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
            updateFromHsv({ ...hsv, h: (x/r.width)*360 });
          }}
          className="w-full h-full block"
        />
        <div
          className="absolute top-0 bottom-0 w-1 border border-white shadow bg-white pointer-events-none -translate-x-1/2"
          style={{ left: `${(hsv.h/360)*100}%` }}
        />
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className={`w-6 ${muted} font-mono`}>HEX</span>
        <input
          type="text"
          value={hexInput}
          onChange={handleHex}
          className={`flex-1 ${inputBg} border rounded-md px-1.5 py-0.5 font-mono ${textMain} focus:outline-none focus:border-blue-500 uppercase text-[11px]`}
        />
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className={`w-6 ${muted} font-mono`}>RGB</span>
        <div className="flex gap-1 flex-1">
          {(['r','g','b'] as const).map(ch => (
            <input
              key={ch}
              type="text"
              value={rgbInput[ch]}
              onChange={(e) => handleRgb(ch, e.target.value)}
              className={`w-full ${inputBg} border rounded-md px-1 py-0.5 text-center font-mono ${textMain} focus:outline-none focus:border-blue-500 text-[11px]`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}