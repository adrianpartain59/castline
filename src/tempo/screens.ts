// Tempo, the fictional running app the demo ads advertise, drawn as an
// animated screen recording. Each screen plays its own little story in the
// first ~3.5 seconds (numbers count in, bars grow, a tap, a scroll) and then
// rests, so it reads as a real recording at any app-half length.
//
// Fixture data comes from the Tempo "Today" context: Maya, Saturday Oct 4,
// Week 7 of 16, Lakeshore Marathon in 63 days, 4 × 1.6 km at 4:55/km.

import type { TempoScreenKey } from "../contracts";
import {
  clamp,
  easeInOutCubic,
  easeOutCubic,
  easeSpring,
  lerp,
  progress,
  roundRectPath,
} from "../compose/canvas";
import {
  C,
  F,
  SCREEN_W,
  STATUS_H,
  TAB_H,
  card,
  chip,
  compactNav,
  eyebrow,
  hairline,
  hexAlpha,
  homeIndicator,
  icon,
  largeTitle,
  makeKit,
  measure,
  pace,
  pill,
  scrollIndicator,
  statusBar,
  tabBar,
  tabular,
  text,
  touch,
  wrap,
  type Kit,
} from "./kit";

export const TEMPO_SCREENS: { key: TempoScreenKey; label: string }[] = [
  { key: "pace", label: "Pace chart" },
  { key: "plan", label: "Weekly plan" },
  { key: "coach", label: "Coach message" },
];

/**
 * Draw one frame of a Tempo screen recording at `t` seconds into the
 * `w`×`h` frame at the context origin (any aspect; laid out on a 390pt-wide
 * iPhone canvas).
 */
export function drawTempoScreen(
  ctx: CanvasRenderingContext2D,
  key: TempoScreenKey,
  t: number,
  w: number,
  h: number,
): void {
  const k = makeKit(ctx, w, h);
  const time = Math.max(0, t);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.scale(k.s, k.s);
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, SCREEN_W, k.H);
  if (key === "plan") planScreen(k, time);
  else if (key === "coach") coachScreen(k, time);
  else paceScreen(k, time);
  ctx.restore();
}

/** Run `draw` faded and lifted by an entrance progress 0..1. */
function enter(k: Kit, p: number, lift: number, draw: () => void) {
  if (p <= 0) return;
  const g = k.ctx;
  g.save();
  g.globalAlpha *= clamp(p);
  g.translate(0, (1 - p) * lift);
  draw();
  g.restore();
}

function scrollChrome(k: Kit, t: number, start: number, dur: number, scrollY: number, maxScroll: number) {
  const visible = progress(t, start - 0.05, 0.12) * (1 - progress(t, start + dur + 0.35, 0.4));
  scrollIndicator(k, visible, maxScroll ? scrollY / maxScroll : 0, STATUS_H + 50, k.H - TAB_H - 8);
}

// ---- pace chart --------------------------------------------------------------

const WEEK_PACES = [322, 317, 312, 309, 305, 301, 298];

function segmented(k: Kit, labels: string[], selected: number, x: number, y: number, w: number) {
  const g = k.ctx;
  pill(k, x, y, w, 34, C.sunken);
  const seg = w / labels.length;
  g.save();
  roundRectPath(g, x + 3 + seg * selected, y + 3, seg - 6, 28, 14);
  g.shadowColor = "rgba(27,26,23,0.10)";
  g.shadowBlur = 4 * k.s;
  g.shadowOffsetY = 1 * k.s;
  g.fillStyle = C.surface;
  g.fill();
  g.restore();
  labels.forEach((label, i) =>
    text(k, label, x + seg * i + seg / 2, y + 22, i === selected ? F.custom(600, 14) : F.custom(500, 14), i === selected ? C.text : C.text2, "center"),
  );
}

function paceScreen(k: Kit, t: number) {
  const g = k.ctx;
  const SCROLL_AT = 2.2;
  const SCROLL_DUR = 0.8;
  const MAX_SCROLL = 196;
  const scrollY = easeInOutCubic(progress(t, SCROLL_AT, SCROLL_DUR)) * MAX_SCROLL;

  g.save();
  g.translate(0, -scrollY);
  let y = largeTitle(k, "Weeks 1–7", "Progress", STATUS_H + 2);
  segmented(k, ["Pace", "Distance", "Heart rate"], 0, 16, y + 2, 358);
  y += 52;

  // Hero card: average tempo pace and the weekly bars.
  const heroTop = y;
  card(k, 16, heroTop, 358, 284);
  eyebrow(k, "Avg tempo pace", 34, heroTop + 32);
  enter(k, progress(t, 0.9, 0.35), 4, () => {
    const cw = measure(k, "12 s faster", F.caption) + 30;
    pill(k, 356 - cw, heroTop + 16, cw, 24, hexAlpha(C.pace, 0.12));
    icon(k, "arrow-down", 356 - cw + 13, heroTop + 28, 12, C.pace, 2.4);
    text(k, "12 s faster", 356 - cw + 22, heroTop + 32.5, F.caption, C.pace);
  });
  const counted = lerp(338, 298, easeOutCubic(progress(t, 0.1, 1.25)));
  const nw = tabular(k, pace(counted), 33, heroTop + 84, F.custom(800, 48, true), C.text);
  text(k, "/km", 33 + nw + 6, heroTop + 84, F.custom(600, 18), C.text2);
  text(k, "Week 7 · your fastest tempo block yet", 34, heroTop + 108, F.footnote, C.text2);

  const x0 = 34;
  const x1 = 356;
  const top = heroTop + 132;
  const bottom = heroTop + 246;
  // Grid and goal line.
  for (let i = 0; i < 3; i++) hairline(k, x0, top + ((bottom - top) * i) / 2, x1, "rgba(27,26,23,0.06)");
  const norm = (p: number) => (345 - p) / (345 - 285);
  const goalY = bottom - (bottom - top) * norm(295);
  g.save();
  g.setLineDash([3, 4]);
  g.strokeStyle = hexAlpha(C.text, 0.28);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x0, goalY);
  g.lineTo(x1, goalY);
  g.stroke();
  g.restore();
  text(k, "Goal 4:55", x1, goalY - 6, F.custom(600, 11), C.text3, "right");

  const slot = (x1 - x0) / WEEK_PACES.length;
  const bw = slot * 0.54;
  const TAP_AT = 1.45;
  const tapK = progress(t, TAP_AT, 0.5);
  const picked = 4;
  const tipK = easeSpring(progress(t, TAP_AT + 0.12, 0.45));
  WEEK_PACES.forEach((p, i) => {
    const grow = easeSpring(progress(t, 0.2 + i * 0.075, 0.7));
    const bh = Math.max(0, (bottom - top) * norm(p) * grow);
    const bx = x0 + slot * i + (slot - bw) / 2;
    const last = i === WEEK_PACES.length - 1;
    const active = i === picked && tipK > 0;
    const fill = last ? C.pace : active ? hexAlpha(C.pace, lerp(0.26, 0.7, tipK)) : hexAlpha(C.pace, 0.26);
    if (bh > 0.5) {
      roundRectPath(g, bx, bottom - bh, bw, bh, Math.min(7, bw / 2));
      g.fillStyle = fill;
      g.fill();
    }
    text(k, `W${i + 1}`, bx + bw / 2, bottom + 22, last ? F.custom(700, 12) : F.custom(500, 12), last ? C.text : C.text3, "center");
  });
  // Tooltip on the tapped bar.
  if (tipK > 0) {
    const p = WEEK_PACES[picked];
    const bx = x0 + slot * picked + slot / 2;
    const by = bottom - (bottom - top) * norm(p) - 10;
    const label = `Week ${picked + 1} · ${pace(p)} /km`;
    const tw = measure(k, label, F.custom(600, 13)) + 22;
    g.save();
    g.globalAlpha = clamp(tipK);
    g.translate(bx, by);
    g.scale(0.85 + 0.15 * tipK, 0.85 + 0.15 * tipK);
    roundRectPath(g, -tw / 2, -36, tw, 28, 9);
    g.fillStyle = C.primary;
    g.fill();
    g.beginPath();
    g.moveTo(-6, -8.5);
    g.lineTo(0, -2);
    g.lineTo(6, -8.5);
    g.fill();
    text(k, label, 0, -17.5, F.custom(600, 13), "#FFFFFF", "center");
    g.restore();
  }
  const tapX = x0 + slot * picked + slot / 2;
  const tapY = bottom - (bottom - top) * norm(WEEK_PACES[picked]) * 0.5;

  // Today's reps.
  y = heroTop + 284 + 16;
  const repsTop = y;
  card(k, 16, repsTop, 358, 254);
  text(k, "Today's reps", 34, repsTop + 36, F.headline, C.text);
  text(k, "4 × 1.6 km · target 4:55 /km", 34, repsTop + 57, F.footnote, C.text2);
  chip(k, "Tempo", 356, repsTop + 20, C.pace, "right");
  const reps = [297, 294, 295, 291];
  reps.forEach((p, i) => {
    const rk = easeOutCubic(progress(t, SCROLL_AT + 0.35 + i * 0.13, 0.5));
    const ry = repsTop + 92 + i * 38;
    enter(k, rk, 8, () => {
      text(k, `Rep ${i + 1}`, 34, ry + 5, F.callout, C.text2);
      const tx = 98;
      const tw = 150;
      pill(k, tx, ry - 4, tw, 8, C.sunken);
      // Faster than target fills past the target tick.
      const fillK = clamp(0.72 + (295 - p) * 0.04, 0.2, 1);
      pill(k, tx, ry - 4, Math.max(8, tw * fillK * rk), 8, C.pace);
      g.fillStyle = hexAlpha(C.text, 0.35);
      g.fillRect(tx + tw * 0.72 - 0.75, ry - 8, 1.5, 16);
      const shown = lerp(330, p, rk);
      tabular(k, pace(shown), 356, ry + 6, F.custom(700, 17), C.text, "right");
      const d = p - 295;
      const delta = d === 0 ? "on pace" : d < 0 ? `${d} s` : `+${d} s`;
      text(k, delta, 300, ry + 5, F.custom(600, 12), d <= 0 ? C.pace : C.text3, "right");
    });
  });
  hairline(k, 34, repsTop + 212, 356);
  enter(k, progress(t, SCROLL_AT + 0.9, 0.4), 4, () => {
    icon(k, "heart", 42, repsTop + 233, 16, C.heart, 2);
    text(k, "Avg 4:54 /km · heart rate 162", 58, repsTop + 238, F.footnote, C.text2);
  });

  // Peek of the next card.
  y = repsTop + 254 + 16;
  card(k, 16, y, 358, 150);
  eyebrow(k, "Weekly distance", 34, y + 32);
  tabular(k, "32.4", 34, y + 74, F.custom(800, 34, true), C.text);
  text(k, "of 48 km", 112, y + 74, F.custom(600, 15), C.text2);
  g.restore();

  compactNav(k, "Progress", progress(scrollY, 48, 36));
  statusBar(k);
  touch(k, tapX, tapY - scrollY, tapK);
  scrollChrome(k, t, SCROLL_AT, SCROLL_DUR, scrollY, MAX_SCROLL);
  tabBar(k, "progress");
}

// ---- weekly plan -------------------------------------------------------------

type DayState = "done" | "rest" | "today" | "planned";

const WEEK: Array<{ day: string; date: string; title: string; sub: string; tag?: [string, string]; state: DayState }> = [
  { day: "Mon", date: "29", title: "Easy run", sub: "7.8 km · 5:48 /km", tag: ["Easy", C.distance], state: "done" },
  { day: "Tue", date: "30", title: "Intervals", sub: "8.0 km · 6 × 800 m", tag: ["Speed", C.heart], state: "done" },
  { day: "Wed", date: "1", title: "Recovery run", sub: "6.4 km · easy effort", tag: ["Recovery", C.recovery], state: "done" },
  { day: "Thu", date: "2", title: "Easy run", sub: "10.2 km · 5:42 /km", tag: ["Easy", C.distance], state: "done" },
  { day: "Fri", date: "3", title: "Rest day", sub: "Mobility, 15 min", state: "rest" },
  { day: "Today", date: "4", title: "Progressive tempo", sub: "11.2 km · ~58 min", tag: ["Tempo", C.pace], state: "today" },
  { day: "Sun", date: "5", title: "Long run", sub: "22 km · easy", tag: ["Long", C.elevation], state: "planned" },
];

/** The workout's structure as one segmented bar (warm-up, reps, MP, cool-down). */
function structureBar(k: Kit, x: number, y: number, w: number, p: number) {
  const g = k.ctx;
  const parts: Array<[number, string]> = [
    [2, "#D6D1C8"],
    [1.6, C.pace], [0.35, "#E6E2DA"],
    [1.6, C.pace], [0.35, "#E6E2DA"],
    [1.6, C.pace], [0.35, "#E6E2DA"],
    [1.6, C.pace],
    [1.6, C.distance],
    [1.2, "#D6D1C8"],
  ];
  const total = parts.reduce((a, [d]) => a + d, 0);
  const gap = 2;
  const usable = w - gap * (parts.length - 1);
  let cx = x;
  g.save();
  g.beginPath();
  g.rect(x, y - 2, w * clamp(p), 14);
  g.clip();
  roundRectPath(g, x, y, w, 10, 5);
  g.clip();
  for (const [d, colour] of parts) {
    const pw = (usable * d) / total;
    g.fillStyle = colour;
    g.fillRect(cx, y, pw, 10);
    cx += pw + gap;
  }
  g.restore();
}

function dayDot(k: Kit, state: DayState, cx: number, cy: number, pop: number, t: number) {
  const g = k.ctx;
  const r = 15;
  if (state === "done") {
    if (pop <= 0) {
      g.beginPath();
      g.arc(cx, cy, r - 0.75, 0, Math.PI * 2);
      g.strokeStyle = C.border;
      g.lineWidth = 1.5;
      g.stroke();
      return;
    }
    g.save();
    g.translate(cx, cy);
    g.scale(0.55 + 0.45 * pop, 0.55 + 0.45 * pop);
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = C.primary;
    g.fill();
    g.restore();
    icon(k, "check", cx, cy, 15 * clamp(pop * 1.1), "#FFFFFF", 2.6);
  } else if (state === "rest") {
    g.save();
    g.setLineDash([2.5, 3]);
    g.beginPath();
    g.arc(cx, cy, r - 0.75, 0, Math.PI * 2);
    g.strokeStyle = C.text3;
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  } else if (state === "today") {
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    g.beginPath();
    g.arc(cx, cy, r + 3 + pulse * 2, 0, Math.PI * 2);
    g.fillStyle = hexAlpha(C.accent, 0.1 * pop);
    g.fill();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = C.accentSoft;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = C.accent;
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 4, 0, Math.PI * 2);
    g.fillStyle = C.accent;
    g.fill();
  } else {
    g.beginPath();
    g.arc(cx, cy, r - 0.75, 0, Math.PI * 2);
    g.strokeStyle = C.border;
    g.lineWidth = 1.5;
    g.stroke();
  }
}

function planScreen(k: Kit, t: number) {
  const g = k.ctx;
  const SCROLL_AT = 1.5;
  const SCROLL_DUR = 0.75;
  const MAX_SCROLL = 232;
  const scrollY = easeInOutCubic(progress(t, SCROLL_AT, SCROLL_DUR)) * MAX_SCROLL;
  const TAP_AT = 2.35;
  const expand = easeInOutCubic(progress(t, TAP_AT + 0.18, 0.45));

  g.save();
  g.translate(0, -scrollY);
  let y = largeTitle(k, "Week 7 of 16", "Plan", STATUS_H + 2);
  icon(k, "flag", 28, y + 4, 15, C.text2, 1.9);
  text(k, "Lakeshore Marathon in 63 days", 42, y + 9, F.callout, C.text2);
  y += 28;

  // This week.
  const wk = y;
  card(k, 16, wk, 358, 190);
  text(k, "This week", 34, wk + 36, F.headline, C.text);
  text(k, "4 of 5 runs", 356, wk + 36, F.footnote, C.text2, "right");
  const km = 32.4 * easeOutCubic(progress(t, 0.1, 1.1));
  const nw = tabular(k, km.toFixed(1), 33, wk + 84, F.custom(800, 40, true), C.text);
  text(k, "/ 48 km", 33 + nw + 8, wk + 84, F.custom(600, 17), C.text2);
  pill(k, 34, wk + 100, 322, 8, C.sunken);
  const fillW = 322 * (32.4 / 48) * easeOutCubic(progress(t, 0.2, 1.1));
  if (fillW > 1) pill(k, 34, wk + 100, Math.max(8, fillW), 8, C.distance);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dx0 = 34 + 15;
  const gap = (356 - 15 - dx0) / 6;
  labels.forEach((label, i) => {
    const cx = dx0 + gap * i;
    const pop = easeSpring(progress(t, 0.35 + i * 0.1, 0.5));
    dayDot(k, WEEK[i].state, cx, wk + 140, pop, t);
    const today = WEEK[i].state === "today";
    text(k, label, cx, wk + 175, today ? F.custom(700, 12) : F.custom(500, 12), today ? C.text : C.text3, "center");
  });

  // The week list: one row per day.
  y = wk + 190 + 16;
  const listTop = y;
  const ROW = 62;
  const extra = 104 * expand;
  card(k, 16, listTop, 358, ROW * WEEK.length + extra + 8);
  let tapY = 0;
  WEEK.forEach((d, i) => {
    const ry = listTop + 4 + i * ROW + (i > 5 ? extra : 0);
    const rk = easeOutCubic(progress(t, 0.45 + i * 0.06, 0.45));
    if (d.state === "today") tapY = ry + 31;
    enter(k, rk, 8, () => {
      const today = d.state === "today";
      const pressed = today ? Math.sin(progress(t, TAP_AT, 0.3) * Math.PI) : 0;
      if (pressed > 0) {
        g.fillStyle = hexAlpha(C.text, 0.04 * pressed);
        g.fillRect(16, ry, 358, ROW);
      }
      text(k, d.day, 34, ry + 25, F.custom(600, 12), today ? C.accent : C.text3);
      text(k, d.date, 34, ry + 46, F.custom(700, 17, true), d.state === "done" ? C.text2 : C.text);
      const muted = d.state === "rest";
      text(k, d.title, 90, ry + 28, F.headline, muted ? C.text2 : C.text);
      text(k, d.sub, 90, ry + 47, F.footnote, C.text2);
      let right = 356;
      if (d.state === "done") {
        g.beginPath();
        g.arc(right - 11, ry + 31, 11, 0, Math.PI * 2);
        g.fillStyle = hexAlpha(C.pace, 0.12);
        g.fill();
        icon(k, "check", right - 11, ry + 31, 13, C.pace, 2.6);
        right -= 30;
      } else if (today) {
        icon(k, "chevron-right", right - 8, ry + 31, 16, C.text3, 2);
        right -= 24;
      }
      if (d.tag) chip(k, d.tag[0], right, ry + 20, d.tag[1], "right");
      if (i < WEEK.length - 1) hairline(k, 90, ry + ROW + (today ? extra : 0), 356);

      if (today && expand > 0) {
        g.save();
        g.beginPath();
        g.rect(16, ry + ROW - 4, 358, extra + 4);
        g.clip();
        g.globalAlpha *= clamp(expand * 1.4 - 0.2);
        structureBar(k, 90, ry + 66, 266, easeOutCubic(progress(t, TAP_AT + 0.3, 0.6)));
        text(k, "4 × 1.6 km @ 4:55 /km", 90, ry + 94, F.footnote, C.text2);
        text(k, "1.6 km @ 5:10", 356, ry + 94, F.footnote, C.distance, "right");
        const by = ry + 110;
        g.save();
        roundRectPath(g, 90, by, 266, 46, 23);
        g.shadowColor = "rgba(255,90,31,0.28)";
        g.shadowBlur = 12 * k.s;
        g.shadowOffsetY = 4 * k.s;
        g.fillStyle = C.accent;
        g.fill();
        g.restore();
        text(k, "Start run", 223, by + 29, F.custom(600, 16), "#FFFFFF", "center");
        g.restore();
      }
    });
  });
  g.restore();

  compactNav(k, "Plan", progress(scrollY, 48, 36));
  statusBar(k);
  touch(k, 230, tapY - scrollY, progress(t, TAP_AT, 0.5));
  scrollChrome(k, t, SCROLL_AT, SCROLL_DUR, scrollY, MAX_SCROLL);
  tabBar(k, "plan");
}

// ---- coach chat --------------------------------------------------------------

const COACH_OPEN = "Morning Maya! Week 7 is the big one. How did the legs feel after Thursday's 10.2?";
const MAYA_REPLY = "Bit heavy tbh. Still doing the tempo today?";
// No-break spaces keep the numbers whole when the bubble wraps.
const COACH_NOTE = "Yes, and hold the reps honest: 4\u00A0×\u00A01.6\u00A0km at 4:55/km with 90\u00A0s jogs. The last one should feel like 8/10, not 10.";

const BUBBLE_FONT = F.body;
const LINE = 21;
const PAD_X = 14;
const PAD_Y = 10;
const MAX_TEXT = 262;

interface BubbleLayout {
  lines: string[];
  widths: number[];
}

function bubbleLayout(k: Kit, str: string): BubbleLayout {
  const lines = wrap(k, str, MAX_TEXT, BUBBLE_FONT);
  return { lines, widths: lines.map((l) => measure(k, l, BUBBLE_FONT)) };
}

/** Bubble geometry for `chars` revealed characters of the layout. */
function revealed(b: BubbleLayout, chars: number): { lines: string[]; width: number } {
  const out: string[] = [];
  let left = chars;
  let width = 0;
  b.lines.forEach((line, i) => {
    if (left <= 0) return;
    const shown = line.slice(0, Math.max(0, left));
    out.push(shown);
    width = Math.max(width, shown.length === line.length ? b.widths[i] : b.widths[i] * (shown.length / line.length));
    left -= line.length + 1;
  });
  return { lines: out, width };
}

function bubble(k: Kit, lines: string[], textW: number, x: number, y: number, mine: boolean) {
  const g = k.ctx;
  const bw = textW + PAD_X * 2;
  const bh = lines.length * LINE + PAD_Y * 2;
  const left = mine ? x - bw : x;
  g.save();
  // Rounded with the tail-side bottom corner tighter, iMessage-style.
  const r = 19;
  const tail = 6;
  g.beginPath();
  g.moveTo(left + r, y);
  g.arcTo(left + bw, y, left + bw, y + bh, r);
  g.arcTo(left + bw, y + bh, left, y + bh, mine ? tail : r);
  g.arcTo(left, y + bh, left, y, mine ? r : tail);
  g.arcTo(left, y, left + bw, y, r);
  g.closePath();
  if (!mine) {
    g.shadowColor = "rgba(27,26,23,0.06)";
    g.shadowBlur = 8 * k.s;
    g.shadowOffsetY = 2 * k.s;
  }
  g.fillStyle = mine ? C.primary : C.surface;
  g.fill();
  g.restore();
  lines.forEach((line, i) => text(k, line, left + PAD_X, y + PAD_Y + 16 + i * LINE, BUBBLE_FONT, mine ? "#FFFFFF" : C.text));
  return bh;
}

function coachScreen(k: Kit, t: number) {
  const g = k.ctx;
  const HEADER = STATUS_H + 56;
  const COMPOSER = 92;
  const viewTop = HEADER;
  const viewBottom = k.H - COMPOSER;

  const TYPING_AT = 0.25;
  const STREAM_AT = 0.95;
  const STREAM_DUR = 1.45;
  const CARD_AT = STREAM_AT + STREAM_DUR + 0.12;
  const TAP_AT = CARD_AT + 0.75;

  const open = bubbleLayout(k, COACH_OPEN);
  const reply = bubbleLayout(k, MAYA_REPLY);
  const note = bubbleLayout(k, COACH_NOTE);
  const noteChars = Math.round(COACH_NOTE.length * easeInOutCubic(progress(t, STREAM_AT, STREAM_DUR)) * 1.0);
  const noteShown = revealed(note, t >= STREAM_AT ? Math.max(1, noteChars) : 0);
  const typing = t >= TYPING_AT && t < STREAM_AT;
  const typingIn = easeOutCubic(progress(t, TYPING_AT, 0.2));
  const cardIn = easeSpring(progress(t, CARD_AT, 0.55));

  // Content height so far drives the auto-scroll (newest message pinned above the composer).
  const hOf = (lines: number) => lines * LINE + PAD_Y * 2;
  let contentH = 28 + hOf(open.lines.length) + 14 + hOf(reply.lines.length) + 22;
  if (typing) contentH += 40 * typingIn + 8;
  if (t >= STREAM_AT) contentH += hOf(noteShown.lines.length) + 8;
  const CARD_H = 196;
  contentH += (CARD_H + 8) * clamp(cardIn);
  const startY = viewTop + 14;
  const scrollY = Math.max(0, startY + contentH - (viewBottom - 10));

  g.save();
  g.beginPath();
  g.rect(0, viewTop, SCREEN_W, viewBottom - viewTop);
  g.clip();
  g.translate(0, -scrollY);
  let y = startY;
  text(k, "Today 7:12 am", SCREEN_W / 2, y + 14, F.custom(600, 12), C.text3, "center");
  y += 28;
  y += bubble(k, open.lines, Math.max(...open.widths), 16, y, false) + 14;
  y += bubble(k, reply.lines, Math.max(...reply.widths), SCREEN_W - 16, y, true) + 22;
  text(k, "Read 7:13", SCREEN_W - 20, y - 7, F.custom(500, 11), C.text3, "right");
  if (typing) {
    enter(k, typingIn, 6, () => {
      bubble(k, [""], 36, 16, y, false);
      for (let i = 0; i < 3; i++) {
        const b = Math.sin((t - TYPING_AT) * 9 - i * 0.9);
        g.beginPath();
        g.arc(16 + PAD_X + 6 + i * 12, y + 20 - Math.max(0, b) * 3, 4, 0, Math.PI * 2);
        g.fillStyle = hexAlpha(C.text, 0.25 + Math.max(0, b) * 0.35);
        g.fill();
      }
    });
    y += 40 + 8;
  }
  if (t >= STREAM_AT) {
    y += bubble(k, noteShown.lines, Math.max(noteShown.width, 20), 16, y, false) + 8;
  }
  let tapX = 0;
  let tapY = 0;
  if (cardIn > 0) {
    const cy = y;
    const cx = 16;
    const cw = 300;
    g.save();
    g.globalAlpha *= clamp(cardIn * 1.5);
    g.translate(cx, cy + CARD_H / 2);
    g.scale(0.92 + 0.08 * cardIn, 0.92 + 0.08 * cardIn);
    g.translate(-cx, -(cy + CARD_H / 2));
    card(k, cx, cy, cw, CARD_H, 20);
    eyebrow(k, "Today's workout", cx + 18, cy + 30);
    text(k, "Progressive tempo", cx + 18, cy + 56, F.headline, C.text);
    text(k, "11.2 km · ~58 min · 4:55 /km", cx + 18, cy + 77, F.footnote, C.text2);
    structureBar(k, cx + 18, cy + 96, cw - 36, easeOutCubic(progress(t, CARD_AT + 0.2, 0.6)));
    text(k, "Warm-up", cx + 18, cy + 124, F.custom(500, 11), C.text3);
    text(k, "Cool-down", cx + cw - 18, cy + 124, F.custom(500, 11), C.text3, "right");
    const by = cy + 138;
    const bw = cw - 36;
    const press = Math.sin(progress(t, TAP_AT, 0.28) * Math.PI);
    const added = easeOutCubic(progress(t, TAP_AT + 0.22, 0.3));
    g.save();
    g.translate(cx + 18 + bw / 2, by + 21);
    g.scale(1 - press * 0.035, 1 - press * 0.035);
    roundRectPath(g, -bw / 2, -21, bw, 42, 21);
    g.fillStyle = added > 0.5 ? C.accentSoft : C.accent;
    g.fill();
    if (added > 0.5) {
      const lw = measure(k, "Added to today", F.custom(600, 15));
      const startX = -(lw + 22) / 2;
      icon(k, "check", startX + 8, 0, 16, C.accent, 2.6);
      text(k, "Added to today", startX + 22, 5.5, F.custom(600, 15), C.accent);
    } else {
      text(k, "Add to today", 0, 5.5, F.custom(600, 15), "#FFFFFF", "center");
    }
    g.restore();
    g.restore();
    tapX = cx + 18 + bw / 2 + 30;
    tapY = by + 21;
  }
  g.restore();

  // Header.
  g.fillStyle = "rgba(247,245,241,0.96)";
  g.fillRect(0, 0, SCREEN_W, HEADER);
  hairline(k, 0, HEADER, SCREEN_W, "rgba(27,26,23,0.08)");
  statusBar(k);
  icon(k, "chevron-left", 20, STATUS_H + 28, 24, C.text, 2.2);
  g.beginPath();
  g.arc(62, STATUS_H + 28, 18, 0, Math.PI * 2);
  g.fillStyle = C.primary;
  g.fill();
  text(k, "T", 62, STATUS_H + 34.5, F.custom(800, 18, true), "#FFFFFF", "center");
  text(k, "Coach", 90, STATUS_H + 24, F.headline, C.text);
  g.beginPath();
  g.arc(94, STATUS_H + 38, 3.5, 0, Math.PI * 2);
  g.fillStyle = C.pace;
  g.fill();
  text(k, typing || (t >= STREAM_AT && t < STREAM_AT + STREAM_DUR) ? "Typing…" : "Replies in seconds", 102, STATUS_H + 42, F.custom(500, 12), C.text3);
  icon(k, "info", 362, STATUS_H + 28, 22, C.text2, 1.8);

  // Composer.
  const top = k.H - COMPOSER;
  g.fillStyle = "rgba(250,249,246,0.97)";
  g.fillRect(0, top, SCREEN_W, COMPOSER);
  hairline(k, 0, top, SCREEN_W, "rgba(27,26,23,0.08)");
  roundRectPath(g, 16, top + 12, 302, 40, 20);
  g.fillStyle = C.surface;
  g.fill();
  g.strokeStyle = C.border;
  g.lineWidth = 1;
  g.stroke();
  text(k, "Message Coach", 32, top + 37, F.body, C.text3);
  icon(k, "mic", 296, top + 32, 18, C.text3, 1.8);
  g.beginPath();
  g.arc(352, top + 32, 19, 0, Math.PI * 2);
  g.fillStyle = C.sunken;
  g.fill();
  icon(k, "send", 352, top + 32, 18, C.text3, 2.2);
  homeIndicator(k);

  if (tapY) touch(k, tapX, tapY - scrollY, progress(t, TAP_AT, 0.5));
}
