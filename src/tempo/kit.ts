// Tempo's look, as canvas drawing primitives: the tokens from the app's theme
// (warm ground, white raised cards r24, one orange accent, fixed metric hues,
// the SF type ramp) and the iOS chrome every screen shares — status bar,
// large title, compact nav bar, tab bar, home indicator, touch indicator and
// scroll indicator.
//
// Screens draw in iPhone points on a 390pt-wide canvas; `Kit.s` converts to
// device pixels for the few things the canvas transform does not scale
// (shadow blur and offset).

import { clamp, roundRectPath } from "../compose/canvas";
import { wrapText } from "../compose/layout";

export const C = {
  ground: "#F4F2EE",
  surface: "#FFFFFF",
  sunken: "#ECE9E3",
  border: "#E6E2DA",
  text: "#1B1A17",
  text2: "#6E6A62",
  text3: "#A39E94",
  accent: "#FF5A1F",
  accentSoft: "#FFE6DB",
  primary: "#1B1A17",
  distance: "#2F6FEB",
  pace: "#0E9F6E",
  heart: "#E5484D",
  elevation: "#8E4EC6",
  recovery: "#D98E04",
} as const;

const FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Helvetica Neue", Arial, sans-serif';
const DISPLAY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, "Helvetica Neue", Arial, sans-serif';

export const F = {
  display: `800 40px ${DISPLAY}`,
  hero: `800 28px ${DISPLAY}`,
  largeTitle: `800 32px ${DISPLAY}`,
  title: `700 22px ${DISPLAY}`,
  headline: `600 17px ${FAMILY}`,
  body: `400 16px ${FAMILY}`,
  callout: `500 15px ${FAMILY}`,
  footnote: `500 13px ${FAMILY}`,
  caption: `600 12px ${FAMILY}`,
  eyebrow: `700 11px ${FAMILY}`,
  tab: `500 10px ${FAMILY}`,
  status: `600 17px ${FAMILY}`,
  custom: (weight: number, px: number, display = false) => `${weight} ${px}px ${display ? DISPLAY : FAMILY}`,
} as const;

export const SCREEN_W = 390;
export const STATUS_H = 54;
export const TAB_H = 83;

export interface Kit {
  ctx: CanvasRenderingContext2D;
  /** Device pixels per point. */
  s: number;
  /** Screen height in points. */
  H: number;
}

export function makeKit(ctx: CanvasRenderingContext2D, w: number, h: number): Kit {
  const s = w / SCREEN_W;
  return { ctx, s, H: h / s };
}

// ---- text ------------------------------------------------------------------

type Align = CanvasTextAlign;

export function text(
  k: Kit,
  str: string,
  x: number,
  y: number,
  font: string,
  colour: string,
  align: Align = "left",
  baseline: CanvasTextBaseline = "alphabetic",
): number {
  const g = k.ctx;
  g.font = font;
  g.fillStyle = colour;
  g.textAlign = align;
  g.textBaseline = baseline;
  g.fillText(str, x, y);
  return g.measureText(str).width;
}

export function measure(k: Kit, str: string, font: string): number {
  k.ctx.font = font;
  return k.ctx.measureText(str).width;
}

/** Sentence-case eyebrow with tracking (canvas letterSpacing where supported). */
export function eyebrow(k: Kit, str: string, x: number, y: number, colour: string = C.text3, align: Align = "left") {
  const g = k.ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = g.letterSpacing;
  if (prev !== undefined) g.letterSpacing = "0.8px";
  text(k, str.toUpperCase(), x, y, F.eyebrow, colour, align);
  if (prev !== undefined) g.letterSpacing = prev;
}

/**
 * Numbers set with tabular figures: every digit takes the width of "0" so a
 * counting value does not jitter. Returns the total width.
 */
export function tabular(k: Kit, str: string, x: number, y: number, font: string, colour: string, align: Align = "left"): number {
  const g = k.ctx;
  g.font = font;
  const cell = g.measureText("0").width;
  const widths = Array.from(str).map((ch) => (/[0-9]/.test(ch) ? cell : g.measureText(ch).width));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === "center" ? x - total / 2 : align === "right" || align === "end" ? x - total : x;
  g.fillStyle = colour;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  Array.from(str).forEach((ch, i) => {
    g.fillText(ch, cx + widths[i] / 2, y);
    cx += widths[i];
  });
  return total;
}

export function wrap(k: Kit, str: string, maxWidth: number, font: string): string[] {
  const g = k.ctx;
  g.font = font;
  return wrapText(str, maxWidth, 1, (s) => g.measureText(s).width);
}

// ---- formatting ------------------------------------------------------------

/** 298 → "4:58". */
export function pace(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---- surfaces --------------------------------------------------------------

export function card(k: Kit, x: number, y: number, w: number, h: number, r = 24, fill: string = C.surface) {
  const g = k.ctx;
  g.save();
  roundRectPath(g, x, y, w, h, r);
  g.shadowColor = "rgba(27,26,23,0.07)";
  g.shadowBlur = 18 * k.s;
  g.shadowOffsetY = 6 * k.s;
  g.fillStyle = fill;
  g.fill();
  g.shadowColor = "rgba(27,26,23,0.04)";
  g.shadowBlur = 2 * k.s;
  g.shadowOffsetY = 1 * k.s;
  g.fill();
  g.restore();
}

export function pill(k: Kit, x: number, y: number, w: number, h: number, fill: string) {
  roundRectPath(k.ctx, x, y, w, h, h / 2);
  k.ctx.fillStyle = fill;
  k.ctx.fill();
}

/** A metric chip: tinted pill, metric-hue label. Returns its width. */
export function chip(k: Kit, label: string, x: number, y: number, hue: string, align: Align = "left"): number {
  const w = measure(k, label, F.caption) + 16;
  const left = align === "right" ? x - w : x;
  pill(k, left, y, w, 22, hexAlpha(hue, 0.12));
  text(k, label, left + w / 2, y + 15.5, F.caption, hue, "center");
  return w;
}

export function hairline(k: Kit, x1: number, y: number, x2: number, colour: string = C.border) {
  const g = k.ctx;
  g.fillStyle = colour;
  g.fillRect(x1, y, x2 - x1, 1 / k.s < 0.5 ? 0.5 : 1 / k.s);
}

export function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
}

// ---- icons (stroked, 24pt grid like Feather) --------------------------------

export function icon(k: Kit, name: IconName, cx: number, cy: number, size: number, colour: string, width = 1.8) {
  const g = k.ctx;
  g.save();
  g.translate(cx - size / 2, cy - size / 2);
  g.scale(size / 24, size / 24);
  g.strokeStyle = colour;
  g.fillStyle = colour;
  g.lineWidth = (width * 24) / size;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  switch (name) {
    case "today":
      roundRectPath(g, 3, 4, 18, 17, 3);
      g.moveTo(3, 9);
      g.lineTo(21, 9);
      g.moveTo(8, 2);
      g.lineTo(8, 5);
      g.moveTo(16, 2);
      g.lineTo(16, 5);
      g.stroke();
      g.beginPath();
      g.arc(12, 15, 2, 0, Math.PI * 2);
      g.fill();
      break;
    case "plan":
      for (const y of [6, 12, 18]) {
        g.moveTo(9, y);
        g.lineTo(21, y);
      }
      g.stroke();
      g.beginPath();
      for (const y of [6, 12, 18]) {
        g.moveTo(5.2, y);
        g.arc(4, y, 1.2, 0, Math.PI * 2);
      }
      g.fill();
      break;
    case "progress":
      g.moveTo(6, 20);
      g.lineTo(6, 13);
      g.moveTo(12, 20);
      g.lineTo(12, 5);
      g.moveTo(18, 20);
      g.lineTo(18, 10);
      g.stroke();
      break;
    case "club":
      g.arc(9, 8, 3.5, 0, Math.PI * 2);
      g.moveTo(2.5, 20);
      g.bezierCurveTo(2.5, 15, 15.5, 15, 15.5, 20);
      g.moveTo(16, 4.6);
      g.bezierCurveTo(19.5, 5.5, 19.5, 10.5, 16, 11.4);
      g.moveTo(18, 15);
      g.bezierCurveTo(20.5, 15.8, 21.5, 17.6, 21.5, 20);
      g.stroke();
      break;
    case "chevron-left":
      g.moveTo(15, 5);
      g.lineTo(8, 12);
      g.lineTo(15, 19);
      g.stroke();
      break;
    case "chevron-right":
      g.moveTo(9, 5);
      g.lineTo(16, 12);
      g.lineTo(9, 19);
      g.stroke();
      break;
    case "check":
      g.moveTo(5, 12.5);
      g.lineTo(10, 17.5);
      g.lineTo(19.5, 7);
      g.stroke();
      break;
    case "flag":
      g.moveTo(5, 21);
      g.lineTo(5, 4);
      g.bezierCurveTo(9, 2, 12, 6, 19, 4);
      g.lineTo(19, 13);
      g.bezierCurveTo(12, 15, 9, 11, 5, 13);
      g.stroke();
      break;
    case "arrow-down":
      g.moveTo(12, 5);
      g.lineTo(12, 19);
      g.moveTo(6, 13);
      g.lineTo(12, 19);
      g.lineTo(18, 13);
      g.stroke();
      break;
    case "info":
      g.arc(12, 12, 9, 0, Math.PI * 2);
      g.moveTo(12, 11);
      g.lineTo(12, 16.5);
      g.stroke();
      g.beginPath();
      g.arc(12, 7.6, 1.1, 0, Math.PI * 2);
      g.fill();
      break;
    case "send":
      g.moveTo(12, 19);
      g.lineTo(12, 6);
      g.moveTo(6.5, 11);
      g.lineTo(12, 5.5);
      g.lineTo(17.5, 11);
      g.stroke();
      break;
    case "mic":
      roundRectPath(g, 9, 3, 6, 11, 3);
      g.moveTo(5.5, 11);
      g.bezierCurveTo(5.5, 19, 18.5, 19, 18.5, 11);
      g.moveTo(12, 17.5);
      g.lineTo(12, 21);
      g.stroke();
      break;
    case "heart":
      g.moveTo(12, 20);
      g.bezierCurveTo(4, 14.5, 2.5, 10, 4.5, 7);
      g.bezierCurveTo(6.5, 4, 10.5, 4.5, 12, 7.5);
      g.bezierCurveTo(13.5, 4.5, 17.5, 4, 19.5, 7);
      g.bezierCurveTo(21.5, 10, 20, 14.5, 12, 20);
      g.stroke();
      break;
    case "bolt":
      g.moveTo(13, 2.5);
      g.lineTo(5, 13.5);
      g.lineTo(11.5, 13.5);
      g.lineTo(10.5, 21.5);
      g.lineTo(19, 10);
      g.lineTo(12.5, 10);
      g.closePath();
      g.stroke();
      break;
  }
  g.restore();
}

export type IconName =
  | "today"
  | "plan"
  | "progress"
  | "club"
  | "chevron-left"
  | "chevron-right"
  | "check"
  | "flag"
  | "arrow-down"
  | "info"
  | "send"
  | "mic"
  | "heart"
  | "bolt";

// ---- chrome ----------------------------------------------------------------

export function statusBar(k: Kit, time = "7:12", dark = C.text) {
  const g = k.ctx;
  text(k, time, 54, 36, F.status, dark, "center");
  // Signal.
  g.fillStyle = dark;
  for (let i = 0; i < 4; i++) {
    roundRectPath(g, 293 + i * 5, 34 - (4 + i * 2.6), 3.2, 4 + i * 2.6, 0.9);
    g.fill();
  }
  // Wi-Fi: three arcs and a dot.
  g.strokeStyle = dark;
  g.lineWidth = 1.9;
  g.lineCap = "round";
  for (const r of [3.6, 7, 10.4]) {
    g.beginPath();
    g.arc(325, 35, r, Math.PI * 1.25, Math.PI * 1.75);
    g.stroke();
  }
  // Battery.
  g.lineWidth = 1;
  g.strokeStyle = hexAlpha(dark, 0.4);
  roundRectPath(g, 339.5, 25.5, 24.5, 12, 3.6);
  g.stroke();
  g.fillStyle = hexAlpha(dark, 0.4);
  roundRectPath(g, 365.2, 29.4, 1.6, 4.2, 0.8);
  g.fill();
  g.fillStyle = dark;
  roundRectPath(g, 341.5, 27.5, 16.5, 8, 2.2);
  g.fill();
}

/** iOS large-title header: eyebrow + title. Returns the y below it. */
export function largeTitle(k: Kit, eyebrowText: string, title: string, y: number): number {
  eyebrow(k, eyebrowText, 20, y + 14);
  text(k, title, 20, y + 52, F.largeTitle, C.text);
  return y + 66;
}

/** The collapsed nav bar that fades in once the large title scrolls away. */
export function compactNav(k: Kit, title: string, alpha: number) {
  if (alpha <= 0.01) return;
  const g = k.ctx;
  g.save();
  g.globalAlpha = clamp(alpha);
  g.fillStyle = "#F6F4F0";
  g.fillRect(0, 0, SCREEN_W, STATUS_H + 44);
  hairline(k, 0, STATUS_H + 44, SCREEN_W, "rgba(27,26,23,0.08)");
  text(k, title, SCREEN_W / 2, STATUS_H + 28, F.headline, C.text, "center");
  g.restore();
}

export type TabKey = "today" | "plan" | "progress" | "club";

export function tabBar(k: Kit, selected: TabKey) {
  const g = k.ctx;
  const top = k.H - TAB_H;
  g.fillStyle = "rgba(250,249,246,0.96)";
  g.fillRect(0, top, SCREEN_W, TAB_H);
  hairline(k, 0, top, SCREEN_W, "rgba(27,26,23,0.08)");
  const slots: Array<{ key: TabKey | "record"; label: string; x: number }> = [
    { key: "today", label: "Today", x: 39 },
    { key: "plan", label: "Plan", x: 117 },
    { key: "record", label: "", x: 195 },
    { key: "progress", label: "Progress", x: 273 },
    { key: "club", label: "Club", x: 351 },
  ];
  for (const slot of slots) {
    if (slot.key === "record") {
      g.save();
      g.beginPath();
      g.arc(slot.x, top + 26, 23, 0, Math.PI * 2);
      g.shadowColor = "rgba(255,90,31,0.32)";
      g.shadowBlur = 10 * k.s;
      g.shadowOffsetY = 3 * k.s;
      g.fillStyle = C.accent;
      g.fill();
      g.restore();
      g.beginPath();
      g.arc(slot.x, top + 26, 7.5, 0, Math.PI * 2);
      g.fillStyle = "#FFFFFF";
      g.fill();
      continue;
    }
    const on = slot.key === selected;
    const colour = on ? C.text : C.text3;
    icon(k, slot.key, slot.x, top + 21, 24, colour, on ? 2.1 : 1.8);
    text(k, slot.label, slot.x, top + 45, on ? F.custom(600, 10) : F.tab, colour, "center");
  }
  homeIndicator(k);
}

export function homeIndicator(k: Kit, colour: string = C.text) {
  const g = k.ctx;
  roundRectPath(g, SCREEN_W / 2 - 67, k.H - 8.5, 134, 5, 2.5);
  g.fillStyle = colour;
  g.fill();
}

/**
 * The screen-recording touch indicator: a soft grey disc that presses in and
 * lifts away. `k01` runs 0..1 over the tap.
 */
export function touch(k: Kit, x: number, y: number, k01: number) {
  if (k01 <= 0 || k01 >= 1) return;
  const g = k.ctx;
  const press = k01 < 0.35 ? k01 / 0.35 : 1;
  const lift = k01 > 0.6 ? (k01 - 0.6) / 0.4 : 0;
  const r = 19 * (0.82 + press * 0.18) * (1 + lift * 0.35);
  g.save();
  g.globalAlpha = (1 - lift) * 0.9;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = "rgba(120,118,112,0.32)";
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.stroke();
  g.restore();
}

/** The thin scroll indicator iOS shows while content moves. */
export function scrollIndicator(k: Kit, alpha: number, fraction: number, top: number, bottom: number) {
  if (alpha <= 0.01) return;
  const g = k.ctx;
  const span = bottom - top;
  const len = span * 0.32;
  const y = top + (span - len) * clamp(fraction);
  g.save();
  g.globalAlpha = clamp(alpha) * 0.45;
  roundRectPath(g, SCREEN_W - 6, y, 3, len, 1.5);
  g.fillStyle = C.text;
  g.fill();
  g.restore();
}
