// The hook caption, drawn the way each platform's own text tool sets it.
//
//   tiktok   TikTok's classic "background" text: black bold type on white
//            line-boxes that merge into one shape with concave joins, centred
//            in the upper third.
//   reels    Instagram's classic text: white bold type with a soft shadow.
//   minimal  Small lowercase sans, top-left, like a creator's quiet caption.
//
// Everything is laid out by layoutHook inside the 9:16 safe zone: clear of
// the top tabs (top 10%), the caption/nav stack (bottom 22%) and the action
// rail (right 16% of the lower half).

import type { TextStyle } from "../contracts";
import { roundRectPath } from "./canvas";
import { layoutHook, type HookLayout } from "./layout";

/** The safe zone as fractions of the frame. */
export const SAFE_ZONE = { top: 0.1, bottom: 0.78, left: 0.08, right: 0.92 } as const;

interface StyleSpec {
  family: string;
  weight: number;
  /** Max/min font size as a fraction of frame width. */
  maxFont: number;
  minFont: number;
  lineHeight: number;
  maxLines: number;
  /** Text box width as a fraction of frame width (before box padding). */
  width: number;
  /** Vertical centre of the block as a fraction of frame height (centred styles). */
  centreY: number;
  /** Tallest block as a fraction of frame height. */
  maxHeight: number;
  lowercase: boolean;
}

const STYLES: Record<TextStyle, StyleSpec> = {
  tiktok: {
    family: '"TikTok Sans", "Proxima Nova", "Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 700,
    maxFont: 0.06,
    minFont: 0.038,
    lineHeight: 1.28,
    maxLines: 5,
    width: 0.72,
    centreY: 0.3,
    maxHeight: 0.34,
    lowercase: false,
  },
  reels: {
    family: '"Instagram Sans", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    weight: 700,
    maxFont: 0.064,
    minFont: 0.04,
    lineHeight: 1.2,
    maxLines: 5,
    width: 0.8,
    centreY: 0.33,
    maxHeight: 0.36,
    lowercase: false,
  },
  minimal: {
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    weight: 500,
    maxFont: 0.041,
    minFont: 0.03,
    lineHeight: 1.32,
    maxLines: 4,
    width: 0.62,
    centreY: 0,
    maxHeight: 0.22,
    lowercase: true,
  },
};

const fontString = (spec: StyleSpec, px: number) => `${spec.weight} ${px}px ${spec.family}`;

// Layout is deterministic per (text, style, frame size); cache it so a 60fps
// preview does not re-wrap every frame.
const layoutCache = new Map<string, HookLayout>();

function layoutFor(ctx: CanvasRenderingContext2D, text: string, style: TextStyle, w: number, h: number): HookLayout {
  const key = `${style}|${w}x${h}|${text}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const spec = STYLES[style];
  const maxFontPx = Math.round(w * spec.maxFont);
  const minFontPx = Math.round(w * spec.minFont);
  // The tiktok box adds padding outside the text; reserve it at the largest size.
  const padX = style === "tiktok" ? Math.round(maxFontPx * 0.45) : 0;
  const saved = ctx.font;
  const measure = (s: string, px: number) => {
    ctx.font = fontString(spec, px);
    return ctx.measureText(s).width;
  };
  const layout = layoutHook(text, w * spec.width - padX * 2, measure, {
    maxFontPx,
    minFontPx,
    maxLines: spec.maxLines,
    maxHeight: h * spec.maxHeight,
    lineHeight: spec.lineHeight,
  });
  ctx.font = saved;
  if (layoutCache.size > 64) layoutCache.clear();
  layoutCache.set(key, layout);
  return layout;
}

export interface HookDrawOptions {
  /**
   * The frame under the text is a bright, busy UI (the Tempo screen). The
   * white-type styles lay a soft top scrim under themselves, the way editors
   * keep a caption legible over a screen recording; the type itself does not
   * change at the cut.
   */
  onLight?: boolean;
}

/** Draw the hook for the whole frame `w`×`h` starting at the context origin. */
export function drawHook(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  style: TextStyle,
  w: number,
  h: number,
  opts: HookDrawOptions = {},
): void {
  const spec = STYLES[style] ?? STYLES.tiktok;
  const text = spec.lowercase ? rawText.toLowerCase() : rawText;
  if (!text.trim()) return;
  const layout = layoutFor(ctx, text, style, w, h);
  if (!layout.lines.length) return;

  ctx.save();
  ctx.font = fontString(spec, layout.fontPx);
  ctx.textBaseline = "middle";
  if (style === "tiktok") drawTikTok(ctx, layout, w, h, spec);
  else if (style === "reels") drawReels(ctx, layout, w, h, spec, opts.onLight === true);
  else drawMinimal(ctx, layout, w, h, opts.onLight === true);
  ctx.restore();
}

function blockTop(layout: HookLayout, h: number, spec: StyleSpec, extra = 0): number {
  const ideal = h * spec.centreY - layout.height / 2;
  const min = h * SAFE_ZONE.top + extra;
  const max = h * SAFE_ZONE.bottom - layout.height - extra;
  return Math.round(Math.min(Math.max(ideal, min), Math.max(min, max)));
}

// ---- tiktok ----------------------------------------------------------------

type Corners = [number, number, number, number]; // tl, tr, br, bl

function cornerRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, [tl, tr, br, bl]: Corners) {
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl);
  else ctx.lineTo(x, y);
  ctx.closePath();
}

function drawTikTok(ctx: CanvasRenderingContext2D, layout: HookLayout, w: number, h: number, spec: StyleSpec) {
  const px = layout.fontPx;
  const padX = Math.round(px * 0.45);
  const lineH = layout.lineHeightPx;
  const r = Math.round(px * 0.3);
  const top = blockTop(layout, h, spec, Math.round(px * 0.12));
  const cx = w / 2;

  // Box widths, with near-equal neighbours snapped together so the merged
  // shape has clean steps instead of hairline jogs.
  const widths = layout.widths.map((tw) => Math.round(tw + padX * 2));
  for (let i = 1; i < widths.length; i++) {
    if (Math.abs(widths[i] - widths[i - 1]) < r * 2.2) {
      const m = Math.max(widths[i], widths[i - 1]);
      widths[i] = m;
      widths[i - 1] = m;
    }
  }
  // A second pass catches runs that the first snap made near-equal.
  for (let i = widths.length - 2; i >= 0; i--) {
    if (Math.abs(widths[i] - widths[i + 1]) < r * 2.2) {
      const m = Math.max(widths[i], widths[i + 1]);
      widths[i] = m;
      widths[i + 1] = m;
    }
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  const n = widths.length;
  for (let i = 0; i < n; i++) {
    const bw = widths[i];
    const x = cx - bw / 2;
    const y = top + i * lineH;
    const above = i > 0 ? widths[i - 1] : 0;
    const below = i < n - 1 ? widths[i + 1] : 0;
    const topR = bw > above ? r : 0;
    const botR = bw > below ? r : 0;
    // Overlap by a pixel so stacked boxes read as one shape.
    cornerRectPath(ctx, x, y - (i > 0 ? 1 : 0), bw, lineH + (i > 0 ? 1 : 0), [topR, topR, botR, botR]);
  }
  ctx.fill();

  // Concave fillets where a narrower box meets a wider one.
  ctx.beginPath();
  for (let i = 0; i < n - 1; i++) {
    const a = widths[i];
    const b = widths[i + 1];
    if (a === b) continue;
    const yj = top + (i + 1) * lineH;
    const narrow = Math.min(a, b);
    const fr = Math.min(r, Math.abs(a - b) / 2);
    const upperIsNarrow = a < b;
    for (const side of [-1, 1] as const) {
      const xe = cx + (side * narrow) / 2; // the narrow box's edge
      const xo = xe + side * fr; // fillet's outer x
      const yo = upperIsNarrow ? yj - fr : yj + fr; // fillet's far y on the narrow box
      // The inside corner between the narrow box's side and the wide box's
      // edge, minus a circle centred at (xo, yo): a concave fillet.
      ctx.moveTo(xe, yj);
      ctx.lineTo(xo, yj);
      ctx.arcTo(xe, yj, xe, yo, fr);
      ctx.closePath();
    }
  }
  ctx.fill();

  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  layout.lines.forEach((line, i) => {
    // Optical centre: cap-height text sits a hair high on a middle baseline.
    ctx.fillText(line, cx, top + i * lineH + lineH / 2 + px * 0.04);
  });
}

// ---- reels -----------------------------------------------------------------

/**
 * A top-down darkening that holds under the caption, then ends softly below
 * it: dark enough that the UI under white type recedes instead of clashing.
 */
function topScrim(ctx: CanvasRenderingContext2D, w: number, textBottom: number, h: number) {
  const bottom = Math.min(h, textBottom + h * 0.12);
  const hold = Math.min(0.95, textBottom / bottom);
  const g = ctx.createLinearGradient(0, 0, 0, bottom);
  g.addColorStop(0, "rgba(10,10,12,0.74)");
  g.addColorStop(hold, "rgba(10,10,12,0.62)");
  g.addColorStop(1, "rgba(10,10,12,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, bottom);
}

function drawReels(ctx: CanvasRenderingContext2D, layout: HookLayout, w: number, h: number, spec: StyleSpec, onLight: boolean) {
  const lineH = layout.lineHeightPx;
  const top = blockTop(layout, h, spec);
  const cx = w / 2;
  if (onLight) topScrim(ctx, w, top + layout.height + h * 0.02, h);
  ctx.textAlign = "center";
  // Two passes: a wide soft shadow for separation, a tight one for edge bite.
  const passes: Array<[number, number, string]> = [
    [w * 0.02, w * 0.002, "rgba(0,0,0,0.5)"],
    [w * 0.005, w * 0.0012, "rgba(0,0,0,0.4)"],
  ];
  for (const [blur, dy, colour] of passes) {
    ctx.shadowColor = colour;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetY = dy;
    ctx.fillStyle = "#FFFFFF";
    layout.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineH + lineH / 2));
  }
}

// ---- minimal ---------------------------------------------------------------

function drawMinimal(ctx: CanvasRenderingContext2D, layout: HookLayout, w: number, h: number, onLight: boolean) {
  const lineH = layout.lineHeightPx;
  const x = Math.round(w * 0.075);
  const top = Math.round(h * 0.105);
  if (onLight) topScrim(ctx, w, top + layout.height + h * 0.02, h);
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = w * 0.01;
  ctx.shadowOffsetY = w * 0.0015;
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  layout.lines.forEach((line, i) => ctx.fillText(line, x, top + i * lineH + lineH / 2));
}

/** A tiny tag (used by the placeholder): rounded translucent pill with text. */
export function drawTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number): void {
  ctx.save();
  ctx.font = `600 ${px}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const tw = ctx.measureText(text).width;
  const padX = px * 0.75;
  const bh = px * 2;
  roundRectPath(ctx, x, y, tw + padX * 2 + px * 1.1, bh, bh / 2);
  ctx.fillStyle = "rgba(12,12,14,0.5)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + padX + px * 0.3, y + bh / 2, px * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = "#FFB547";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(text, x + padX + px * 1.0, y + bh / 2 + px * 0.04);
  ctx.restore();
}
