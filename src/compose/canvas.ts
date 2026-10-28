// Small drawing and motion helpers shared by the compositor, the placeholder
// reaction and the Tempo screens. Pure functions over a 2D context; nothing
// here touches the DOM at import time, so the pure parts stay testable.

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** 0..1 progress of `t` through the window [start, start + dur]. */
export function progress(t: number, start: number, dur: number): number {
  if (dur <= 0) return t >= start ? 1 : 0;
  return clamp((t - start) / dur);
}

export const easeOutCubic = (k: number): number => 1 - Math.pow(1 - clamp(k), 3);
export const easeInOutCubic = (k: number): number => {
  const x = clamp(k);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutQuint = (k: number): number => 1 - Math.pow(1 - clamp(k), 5);
/** A damped spring settle: overshoots a touch, then rests at 1. */
export function easeSpring(k: number): number {
  const x = clamp(k);
  if (x === 0 || x === 1) return x;
  return 1 - Math.exp(-6.5 * x) * Math.cos(x * 9.5);
}

/** Rounded-rect path (not filled). Radius is clamped to the shorter side. */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Deterministic 32-bit string hash (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded PRNG (mulberry32): same seed, same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth pseudo-random wobble in -1..1: a sum of incommensurate sines. */
export function wobble(t: number, seed: number): number {
  const p = (seed % 1000) * 0.37;
  return (
    0.55 * Math.sin(t * 0.83 + p) +
    0.3 * Math.sin(t * 1.71 + p * 1.9) +
    0.15 * Math.sin(t * 3.13 + p * 0.7)
  );
}

// ---- colour ---------------------------------------------------------------

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix two hex colours; k=0 gives a, k=1 gives b. */
export function mix(a: string, b: string, k: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: lerp(x.r, y.r, k), g: lerp(x.g, y.g, k), b: lerp(x.b, y.b, k) });
}

export const shade = (hex: string, k: number): string => mix(hex, "#000000", k);
export const tint = (hex: string, k: number): string => mix(hex, "#ffffff", k);

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(alpha)})`;
}

/** Relative luminance 0..1 (sRGB, WCAG formula). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}
