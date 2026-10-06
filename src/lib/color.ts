export const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  if (h.length === 3) return { r: parseInt(h[0]+h[0],16), g: parseInt(h[1]+h[1],16), b: parseInt(h[2]+h[2],16) };
  if (h.length === 6) return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  return null;
};

export const rgbToHex = (r: number, g: number, b: number) => {
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
};

export const rgbToHsv = (r: number, g: number, b: number) => {
  r/=255; g/=255; b/=255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  const d = max - min; let h = 0; const v = max;
  const s = max === 0 ? 0 : d / max;
  if (d !== 0) {
    if (max === r) h = ((g-b)/d + (g<b?6:0));
    else if (max === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h /= 6;
  }
  return { h: h*360, s: s*100, v: v*100 };
};

export const hsvToRgb = (h: number, s: number, v: number) => {
  h = ((h%360)+360)%360 / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;
  const i = Math.floor(h*6); const f = h*6 - i;
  const p = v*(1-s); const q = v*(1-f*s); const t = v*(1-(1-f)*s);
  let r=0,g=0,b=0;
  switch (i%6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
};