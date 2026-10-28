// The stand-in reaction shown until real footage is rendered: a soft,
// out-of-focus room for the take's setting and a stylized head-and-shoulders
// figure of the cast member, filmed "handheld" — tiny drift, breathing, a
// blink, a reaction beat and a nod — plus an honest tag saying what it is.
//
// The figure's colours and hair come from the member's written description
// via looks.ts, so the placeholder for a member matches their portrait in the
// cast grid.

import type { CastMember } from "../contracts";
import {
  clamp,
  easeInOutCubic,
  hashString,
  mix,
  mulberry32,
  progress,
  rgba,
  shade,
  tint,
  wobble,
} from "./canvas";
import { drawTag } from "./hook-text";
import { lookFor, settingLookFor, type PersonLook, type SettingLook } from "./looks";

export const PLACEHOLDER_TAG = "Placeholder until the library is rendered";

// ---- offscreen helpers (lazily created, browser only) ----------------------

type Canvas2D = HTMLCanvasElement;

function makeCanvas(w: number, h: number): Canvas2D {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const backdropCache = new Map<string, Canvas2D>();
let grainCanvas: Canvas2D | null = null;

function grain(): Canvas2D {
  if (grainCanvas) return grainCanvas;
  const size = 160;
  const c = makeCanvas(size, size);
  const g = c.getContext("2d");
  if (g) {
    const img = g.createImageData(size, size);
    const rnd = mulberry32(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.round(rnd() * 255);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  grainCanvas = c;
  return c;
}

// ---- room backdrop ---------------------------------------------------------

/**
 * The room is drawn small and scaled up with smoothing, which reads as a
 * shallow-depth-of-field blur on every browser (canvas `filter` is not
 * universal) and costs one drawImage per frame.
 */
function backdrop(look: SettingLook, w: number, h: number, seed: number): Canvas2D {
  const key = `${look.kind}|${look.lightSide}|${Math.round(w)}x${Math.round(h)}|${seed % 97}`;
  const hit = backdropCache.get(key);
  if (hit) return hit;
  const small = makeCanvas(w / 7, h / 7);
  const g = small.getContext("2d");
  if (g) paintRoom(g, look, small.width, small.height, seed);
  // Second, gentler pass so the upscale has no blocky stepping.
  const mid = makeCanvas(w / 2.5, h / 2.5);
  const m = mid.getContext("2d");
  if (m) {
    m.imageSmoothingEnabled = true;
    m.imageSmoothingQuality = "high";
    m.drawImage(small, 0, 0, mid.width, mid.height);
  }
  if (backdropCache.size > 24) backdropCache.clear();
  backdropCache.set(key, mid);
  return mid;
}

function paintRoom(g: CanvasRenderingContext2D, look: SettingLook, w: number, h: number, seed: number) {
  const rnd = mulberry32(seed * 31 + 11);
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, look.wall[0]);
  wall.addColorStop(1, look.wall[1]);
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);

  const lx = look.lightSide < 0 ? w * 0.08 : w * 0.92;
  const glow = (x: number, y: number, r: number, colour: string, a: number) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, rgba(colour, a));
    rg.addColorStop(1, rgba(colour, 0));
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const rect = (x: number, y: number, rw: number, rh: number, colour: string, a = 1) => {
    g.fillStyle = rgba(colour, a);
    g.fillRect(x, y, rw, rh);
  };

  switch (look.kind) {
    case "kitchen": {
      rect(0, h * 0.02, w, h * 0.2, shade(look.prop, 0.05));
      for (let i = 0; i < 4; i++) rect(w * (0.02 + i * 0.25), h * 0.04, w * 0.22, h * 0.16, tint(look.prop, 0.12));
      for (let y = h * 0.26; y < h * 0.6; y += h * 0.035)
        for (let x = (Math.round(y) % 2) * w * 0.04; x < w; x += w * 0.08) rect(x, y, w * 0.075, h * 0.03, tint(look.wall[0], 0.4), 0.5);
      rect(0, h * 0.6, w, h * 0.06, shade(look.prop, 0.2));
      rect(lx - w * 0.16, h * 0.18, w * 0.32, h * 0.32, look.light, 0.9);
      glow(lx, h * 0.3, w * 0.6, look.light, 0.7);
      glow(w * (look.lightSide < 0 ? 0.8 : 0.2), h * 0.52, w * 0.12, look.accent, 0.8);
      break;
    }
    case "living": {
      rect(w * (look.lightSide < 0 ? 0.62 : 0.12), h * 0.16, w * 0.26, h * 0.18, shade(look.wall[1], 0.18));
      rect(w * (look.lightSide < 0 ? 0.64 : 0.14), h * 0.175, w * 0.22, h * 0.15, mix(look.accent, look.wall[0], 0.4));
      glow(lx, h * 0.28, w * 0.7, look.light, 0.75);
      glow(w * (look.lightSide < 0 ? 0.86 : 0.14), h * 0.38, w * 0.16, "#FFD39A", 0.9);
      g.fillStyle = look.prop;
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.78, w * 0.75, h * 0.18, 0, 0, Math.PI * 2);
      g.fill();
      glow(w * (look.lightSide < 0 ? 0.12 : 0.88), h * 0.6, w * 0.16, "#6F8F5E", 0.9);
      break;
    }
    case "bedroom": {
      glow(lx, h * 0.25, w * 0.75, look.light, 0.8);
      g.fillStyle = shade(look.accent, 0.05);
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.62, w * 0.62, h * 0.3, 0, Math.PI, 0);
      g.fill();
      rect(0, h * 0.62, w, h * 0.38, look.prop);
      for (let i = 0; i < 9; i++) glow(w * (0.08 + i * 0.105), h * (0.09 + 0.03 * Math.sin(i * 1.3)), w * 0.035, "#FFD08A", 0.9);
      break;
    }
    case "car": {
      rect(0, 0, w, h, look.wall[1]);
      const winX = look.lightSide < 0 ? 0 : w * 0.55;
      const sky = g.createLinearGradient(0, h * 0.12, 0, h * 0.5);
      sky.addColorStop(0, "#DCE8F2");
      sky.addColorStop(1, "#A7BFA0");
      g.fillStyle = sky;
      g.fillRect(winX, h * 0.12, w * 0.45, h * 0.42);
      for (let i = 0; i < 6; i++) glow(winX + rnd() * w * 0.45, h * (0.3 + rnd() * 0.2), w * 0.09, "#6E8F5E", 0.8);
      glow(winX + w * 0.22, h * 0.22, w * 0.4, look.light, 0.6);
      rect(0, 0, w, h * 0.1, shade(look.wall[0], 0.2));
      g.fillStyle = shade(look.prop, 0.1);
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.5, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "gym": {
      for (let i = 0; i < 5; i++) glow(w * (0.1 + i * 0.2), h * 0.05, w * 0.12, look.light, 0.85);
      rect(w * (look.lightSide < 0 ? 0.05 : 0.6), h * 0.2, w * 0.35, h * 0.5, tint(look.wall[1], 0.12));
      for (let i = 0; i < 5; i++) rect(w * (0.08 + i * 0.2), h * 0.25, w * 0.02, h * 0.5, "#141416");
      rect(0, h * 0.72, w, h * 0.28, shade(look.prop, 0.1));
      glow(w * 0.75, h * 0.45, w * 0.12, look.accent, 0.7);
      break;
    }
    case "outdoor": {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.5);
      sky.addColorStop(0, "#AFCBE2");
      sky.addColorStop(1, "#E8EEE6");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h * 0.55);
      glow(lx, h * 0.12, w * 0.6, look.light, 0.9);
      for (let i = 0; i < 14; i++) {
        const x = rnd() * w;
        const y = h * (0.28 + rnd() * 0.25);
        glow(x, y, w * (0.12 + rnd() * 0.12), mix(look.prop, "#3E5A36", rnd() * 0.6), 0.95);
      }
      rect(0, h * 0.6, w, h * 0.4, mix(look.prop, "#7A8A62", 0.5));
      for (let i = 0; i < 6; i++) glow(rnd() * w, h * (0.15 + rnd() * 0.3), w * 0.03, "#FFF7DD", 0.8);
      break;
    }
    case "track": {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.4);
      sky.addColorStop(0, "#B8D2E6");
      sky.addColorStop(1, "#EEF2F2");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h * 0.4);
      for (let i = 0; i < 5; i++) rect(0, h * (0.2 + i * 0.035), w, h * 0.02, i % 2 ? "#8C96A0" : "#B7BEC5");
      rect(0, h * 0.38, w, h * 0.08, "#6F8F5E");
      rect(0, h * 0.46, w, h * 0.54, look.prop);
      for (let i = 0; i < 6; i++) rect(0, h * (0.5 + i * 0.08), w, h * 0.006, look.accent, 0.9);
      glow(lx, h * 0.1, w * 0.6, look.light, 0.9);
      break;
    }
    case "bathroom": {
      for (let y = 0; y < h; y += h * 0.06) for (let x = 0; x < w; x += w * 0.12) rect(x + 1, y + 1, w * 0.12 - 2, h * 0.06 - 2, tint(look.wall[0], 0.3), 0.6);
      rect(w * 0.15, h * 0.05, w * 0.7, h * 0.4, tint(look.accent, 0.5), 0.8);
      glow(w * 0.5, h * 0.06, w * 0.5, look.light, 0.9);
      rect(0, h * 0.68, w, h * 0.32, look.prop);
      break;
    }
    case "office": {
      for (let i = 0; i < 3; i++) rect(w * (look.lightSide < 0 ? 0.55 : 0.05), h * (0.18 + i * 0.14), w * 0.4, h * 0.012, shade(look.prop, 0.1));
      for (let i = 0; i < 10; i++) rect(w * (look.lightSide < 0 ? 0.57 : 0.07) + i * w * 0.035, h * 0.12 + (i % 3) * h * 0.14, w * 0.025, h * 0.06, mix(look.accent, look.prop, rnd()), 0.9);
      glow(lx, h * 0.3, w * 0.65, look.light, 0.75);
      rect(0, h * 0.7, w, h * 0.3, look.prop);
      break;
    }
  }
  // Soft overall falloff away from the key light.
  const fall = g.createLinearGradient(look.lightSide < 0 ? 0 : w, 0, look.lightSide < 0 ? w : 0, 0);
  fall.addColorStop(0, "rgba(0,0,0,0)");
  fall.addColorStop(1, "rgba(20,14,10,0.22)");
  g.fillStyle = fall;
  g.fillRect(0, 0, w, h);
}

// ---- the figure ------------------------------------------------------------

interface Motion {
  /** Head roll in radians. */
  roll: number;
  /** Nod: 0 rest, positive = chin down (in head units of vertical shift). */
  nod: number;
  /** Breathing lift of the shoulders, head units. */
  breathe: number;
  /** 0 open … 1 closed. */
  blink: number;
  smile: number;
  open: number;
  brow: number;
  /** Gaze offset, head units. */
  gazeX: number;
}

function motionAt(t: number, seed: number): Motion {
  const rnd = mulberry32(seed);
  const beat = 0.45 + rnd() * 0.35; // when the "wait, what" lands
  const nodAt = beat + 0.75 + rnd() * 0.3;
  const blinkEvery = 2.6 + rnd() * 1.4;
  const blinkPhase = rnd() * blinkEvery;
  const surprise = progress(t, beat, 0.22) * (1 - progress(t, beat + 0.9, 0.5));
  const grin = easeInOutCubic(progress(t, beat + 0.55, 0.5));
  const bt = (t + blinkPhase) % blinkEvery;
  const blink = bt < 0.14 ? Math.sin((bt / 0.14) * Math.PI) : 0;
  const nodK = progress(t, nodAt, 0.55);
  const nod = Math.sin(nodK * Math.PI) * 0.035 + Math.sin(clamp(nodK * 2 - 1, 0, 1) * Math.PI) * 0.012;
  return {
    roll: wobble(t * 0.6, seed) * 0.03 + grin * 0.025 * (seed % 2 ? 1 : -1),
    nod,
    breathe: Math.sin((t / 3.6) * Math.PI * 2) * 0.012,
    blink,
    smile: 0.25 + grin * 0.65 - surprise * 0.2,
    open: surprise * 0.55 + grin * 0.25,
    brow: surprise * 0.04 + grin * 0.012,
    gazeX: wobble(t * 0.4, seed + 5) * 0.01,
  };
}

const REST: Motion = { roll: 0, nod: 0, breathe: 0, blink: 0, smile: 0.45, open: 0.05, brow: 0.004, gazeX: 0 };

function headPath(g: CanvasRenderingContext2D, hw: number, male: boolean) {
  const jaw = male ? 0.74 : 0.64;
  g.beginPath();
  g.moveTo(0, -0.5);
  g.bezierCurveTo(hw * 0.58, -0.5, hw, -0.38, hw, -0.1);
  g.bezierCurveTo(hw, 0.14, hw * 0.94, 0.28, hw * jaw, 0.4);
  g.bezierCurveTo(hw * 0.42, 0.5, hw * 0.22, 0.52, 0, 0.52);
  g.bezierCurveTo(-hw * 0.22, 0.52, -hw * 0.42, 0.5, -hw * jaw, 0.4);
  g.bezierCurveTo(-hw * 0.94, 0.28, -hw, 0.14, -hw, -0.1);
  g.bezierCurveTo(-hw, -0.38, -hw * 0.58, -0.5, 0, -0.5);
  g.closePath();
}

/** A bumpy blob outline for curly volumes: circles along an ellipse. */
function curlCloud(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, bumps: number, r: number) {
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    g.moveTo(cx + Math.cos(a) * rx + r, cy + Math.sin(a) * ry);
    g.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r, 0, Math.PI * 2);
  }
}

function hairFill(g: CanvasRenderingContext2D, look: PersonLook, side: number): CanvasGradient {
  const grad = g.createLinearGradient(side * 0.6, -0.7, -side * 0.5, 0.9);
  grad.addColorStop(0, tint(look.hair, 0.16));
  grad.addColorStop(0.45, look.hair);
  grad.addColorStop(1, shade(look.hair, 0.28));
  return grad;
}

function drawBackHair(g: CanvasRenderingContext2D, look: PersonLook, hw: number, side: number) {
  g.fillStyle = hairFill(g, look, side);
  const s = look.shape;
  if (s === "long" || s === "shoulder" || s === "bob" || s === "braids" || s === "locs") {
    const bottom = s === "long" ? 1.55 : s === "shoulder" ? 1.0 : s === "bob" ? 0.5 : 1.45;
    const spread = s === "bob" ? hw + 0.13 : hw + 0.1;
    if (look.curly && s !== "braids" && s !== "locs") {
      curlCloud(g, 0, (bottom - 0.5) / 2 - 0.1, spread + 0.06, (bottom + 0.6) / 2, 16, 0.08);
      g.fill();
      return;
    }
    g.beginPath();
    g.moveTo(-spread * 0.9, -0.2);
    g.bezierCurveTo(-spread * 1.05, -0.62, spread * 1.05, -0.62, spread * 0.9, -0.2);
    g.bezierCurveTo(spread * 1.08, bottom * 0.4, spread * 1.2, bottom * 0.8, spread * (s === "bob" ? 1.02 : 1.25), bottom);
    g.quadraticCurveTo(0, bottom + 0.08, -spread * (s === "bob" ? 1.02 : 1.25), bottom);
    g.bezierCurveTo(-spread * 1.2, bottom * 0.8, -spread * 1.08, bottom * 0.4, -spread * 0.9, -0.2);
    g.fill();
  } else if (s === "curly") {
    curlCloud(g, 0, -0.08, hw + 0.2, 0.62, 18, 0.1);
    g.fill();
  } else if (s === "afro") {
    curlCloud(g, 0, -0.18, hw + 0.34, 0.66, 22, 0.11);
    g.fill();
  } else if (s === "bun") {
    g.beginPath();
    g.arc(0, -0.6, 0.17, 0, Math.PI * 2);
    g.fill();
  } else if (s === "ponytail") {
    g.beginPath();
    g.ellipse(side * -0.32, 0.25, 0.12, 0.42, side * -0.2, 0, Math.PI * 2);
    g.fill();
  }
}

function drawFrontHair(g: CanvasRenderingContext2D, look: PersonLook, hw: number, side: number) {
  const s = look.shape;
  if (s === "bald") {
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.beginPath();
    g.ellipse(side * 0.1, -0.36, 0.14, 0.07, side * 0.3, 0, Math.PI * 2);
    g.fill();
    return;
  }
  const part = look.seed % 3 === 0 ? 0 : look.seed % 2 ? 0.12 : -0.12;
  const thick = s === "buzz" ? 0.012 : s === "afro" || s === "curly" ? 0.07 : s === "crop" ? 0.06 : 0.045;
  const hairline = s === "buzz" ? -0.27 : s === "short" || s === "crop" ? -0.25 : -0.22;
  const sideDrop = s === "long" || s === "shoulder" || s === "bob" || s === "braids" || s === "locs" ? 0.32 : s === "curly" ? 0.18 : 0.02;
  g.fillStyle = hairFill(g, look, side);
  if (s === "buzz") g.globalAlpha = 0.82;
  g.beginPath();
  g.moveTo(-hw - thick * 0.6, sideDrop);
  g.bezierCurveTo(-hw - thick, -0.4, -hw * 0.6, -0.5 - thick, 0, -0.5 - thick);
  g.bezierCurveTo(hw * 0.6, -0.5 - thick, hw + thick, -0.4, hw + thick * 0.6, sideDrop);
  // Hairline, right temple back to left, with a soft part.
  g.lineTo(hw * 0.86, sideDrop);
  g.bezierCurveTo(hw * 0.92, -0.1, hw * 0.7, hairline, part + 0.05, hairline - 0.03);
  g.quadraticCurveTo(part, hairline - 0.06, part - 0.05, hairline - 0.03);
  g.bezierCurveTo(-hw * 0.7, hairline, -hw * 0.92, -0.1, -hw * 0.86, sideDrop);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;

  if (look.curly || s === "afro" || s === "crop") {
    g.fillStyle = hairFill(g, look, side);
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const x = -hw * 0.82 + k * hw * 1.64;
      const y = hairline + 0.03 - Math.sin(k * Math.PI) * 0.04;
      g.beginPath();
      g.arc(x, y, 0.05, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Sheen.
  if (s !== "buzz") {
    g.strokeStyle = rgba("#FFFFFF", 0.14);
    g.lineWidth = 0.03;
    g.lineCap = "round";
    g.beginPath();
    g.arc(0, -0.05, 0.42, -Math.PI / 2 - side * 0.9 - 0.25, -Math.PI / 2 - side * 0.9 + 0.25);
    g.stroke();
  }
}

function drawSideStrands(g: CanvasRenderingContext2D, look: PersonLook, hw: number, side: number) {
  const s = look.shape;
  if (!(s === "long" || s === "shoulder" || s === "braids" || s === "locs") || look.curly) return;
  const bottom = s === "shoulder" ? 0.98 : 1.3;
  g.fillStyle = hairFill(g, look, side);
  for (const d of [-1, 1]) {
    // Inner edge follows the jaw, drapes over the shoulder, tapers to a soft tip.
    g.beginPath();
    g.moveTo(d * hw * 0.86, -0.02);
    g.bezierCurveTo(d * hw * 0.9, 0.42, d * (hw + 0.04), 0.72, d * (hw + 0.13), bottom - 0.08);
    g.quadraticCurveTo(d * (hw + 0.17), bottom + 0.04, d * (hw + 0.25), bottom - 0.12);
    g.bezierCurveTo(d * (hw + 0.28), 0.78, d * (hw + 0.17), 0.32, d * (hw + 0.07), -0.18);
    g.closePath();
    g.fill();
  }
  // A few strand lines so the hair reads as hair, not a slab.
  const braided = s === "braids" || s === "locs";
  g.strokeStyle = braided ? rgba(shade(look.hair, 0.45), 0.55) : rgba("#FFFFFF", 0.07);
  g.lineWidth = braided ? 0.012 : 0.008;
  g.lineCap = "round";
  for (const d of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const o = 0.035 + i * 0.045;
      g.beginPath();
      g.moveTo(d * (hw * 0.9 + o * 0.6), 0.05);
      g.bezierCurveTo(d * (hw * 0.95 + o), 0.45, d * (hw + 0.06 + o), 0.75, d * (hw + 0.12 + o * 0.9), bottom - 0.14);
      g.stroke();
    }
}

function drawFace(g: CanvasRenderingContext2D, look: PersonLook, hw: number, m: Motion, side: number) {
  const male = look.gender === "male";
  const skinShadow = shade(look.skin, 0.2);
  // Ears (behind the face edge).
  g.fillStyle = shade(look.skin, 0.08);
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(dir * (hw + 0.005), 0.06, 0.05, 0.1, dir * 0.15, 0, Math.PI * 2);
    g.fill();
  }
  if (look.marks.earrings) {
    g.fillStyle = "#E7C77B";
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.arc(dir * (hw + 0.012), 0.16, 0.016, 0, Math.PI * 2);
      g.fill();
    }
  }

  headPath(g, hw, male);
  const face = g.createRadialGradient(side * 0.16, -0.08, 0.05, side * 0.05, 0.05, 0.75);
  face.addColorStop(0, tint(look.skin, 0.1));
  face.addColorStop(0.55, look.skin);
  face.addColorStop(1, skinShadow);
  g.fillStyle = face;
  g.fill();

  // Cheeks.
  for (const dir of [-1, 1]) {
    const cg = g.createRadialGradient(dir * 0.2, 0.17, 0, dir * 0.2, 0.17, 0.12);
    cg.addColorStop(0, rgba("#E07A6E", 0.16 + m.smile * 0.06));
    cg.addColorStop(1, rgba("#E07A6E", 0));
    g.fillStyle = cg;
    g.fillRect(dir * 0.2 - 0.12, 0.05, 0.24, 0.24);
  }

  // Brows.
  const browColour = shade(look.hair, look.shape === "bald" ? 0.1 : 0.12);
  g.strokeStyle = rgba(browColour, 0.92);
  g.lineCap = "round";
  g.lineWidth = male ? 0.032 : 0.024;
  const browY = -0.085 - m.brow;
  const tilt = ((look.seed % 5) - 2) * 0.004;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(dir * 0.07, browY + 0.012 + tilt * dir);
    g.quadraticCurveTo(dir * 0.15, browY - 0.022, dir * 0.23, browY + 0.008);
    g.stroke();
  }

  // Eyes: dark almonds with a catchlight; smiles squint them a touch.
  const eyeY = 0.02;
  const ry = 0.03 * (1 - m.blink) * (1 - m.smile * 0.22) * (1 + m.brow * 4);
  const iris = mix(look.eyes, "#1A1210", 0.35);
  for (const dir of [-1, 1]) {
    const ex = dir * 0.15;
    if (ry < 0.006) {
      g.strokeStyle = shade(look.skin, 0.55);
      g.lineWidth = 0.012;
      g.beginPath();
      g.moveTo(ex - 0.045, eyeY);
      g.quadraticCurveTo(ex, eyeY + 0.012, ex + 0.045, eyeY);
      g.stroke();
      continue;
    }
    g.fillStyle = "#FBF8F4";
    g.beginPath();
    g.ellipse(ex, eyeY, 0.05, ry * 1.05, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.ellipse(ex, eyeY, 0.05, ry * 1.05, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = iris;
    g.beginPath();
    g.arc(ex + m.gazeX, eyeY + 0.002, 0.03, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#120C0A";
    g.beginPath();
    g.arc(ex + m.gazeX, eyeY + 0.002, 0.014, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(ex + m.gazeX + 0.01, eyeY - 0.008, 0.007, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Upper lid line.
    g.strokeStyle = shade(look.skin, 0.62);
    g.lineWidth = 0.012;
    g.beginPath();
    g.ellipse(ex, eyeY, 0.05, ry * 1.05, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
  }

  // Nose: a shadow-side stroke and soft nostrils.
  g.strokeStyle = rgba(shade(look.skin, 0.35), 0.55);
  g.lineWidth = 0.014;
  g.beginPath();
  g.moveTo(-side * 0.012, 0.06);
  g.quadraticCurveTo(-side * 0.04, 0.17, -side * 0.01, 0.2);
  g.stroke();
  g.fillStyle = rgba(shade(look.skin, 0.4), 0.45);
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(dir * 0.03, 0.205, 0.014, 0.008, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Mouth.
  const my = 0.315;
  const mw = 0.1 + m.smile * 0.025;
  const lift = m.smile * 0.028;
  const drop = 0.012 + m.open * 0.07 + m.smile * 0.02;
  const lip = mix(look.skin, "#A8434D", 0.42);
  g.beginPath();
  g.moveTo(-mw, my - lift);
  g.quadraticCurveTo(0, my - 0.012 + m.open * 0.01, mw, my - lift);
  g.quadraticCurveTo(0, my + drop * 1.6, -mw, my - lift);
  g.closePath();
  if (m.open > 0.08 || m.smile > 0.55) {
    g.fillStyle = "#4A1E22";
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = "#F6F1EA";
    g.fillRect(-mw, my - 0.03, mw * 2, 0.03 + drop * 0.35);
    g.restore();
    g.strokeStyle = lip;
    g.lineWidth = 0.014;
    g.stroke();
  } else {
    g.fillStyle = lip;
    g.fill();
  }

  // Marks.
  if (look.marks.freckles) {
    const rnd = mulberry32(look.seed);
    g.fillStyle = rgba(shade(look.skin, 0.32), 0.45);
    for (let i = 0; i < 26; i++) {
      const x = (rnd() - 0.5) * 0.46;
      const y = 0.08 + rnd() * 0.12 - Math.abs(x) * 0.15;
      g.beginPath();
      g.arc(x, y, 0.004 + rnd() * 0.004, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (look.marks.mole) {
    g.fillStyle = shade(look.skin, 0.5);
    g.beginPath();
    g.arc(side * 0.17, 0.27, 0.008, 0, Math.PI * 2);
    g.fill();
  }
  if (look.marks.beard !== "none") {
    const a = look.marks.beard === "stubble" ? 0.26 : 0.9;
    g.fillStyle = rgba(shade(look.hair, 0.05), a);
    if (look.marks.beard === "moustache") {
      g.beginPath();
      g.moveTo(-0.11, my - lift - 0.005);
      g.quadraticCurveTo(0, my - 0.075, 0.11, my - lift - 0.005);
      g.quadraticCurveTo(0, my - 0.03, -0.11, my - lift - 0.005);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(-hw, 0.02);
      g.bezierCurveTo(-hw, 0.2, -hw * 0.8, 0.36, -hw * 0.55, 0.44);
      g.bezierCurveTo(-hw * 0.3, 0.56, hw * 0.3, 0.56, hw * 0.55, 0.44);
      g.bezierCurveTo(hw * 0.8, 0.36, hw, 0.2, hw, 0.02);
      g.lineTo(hw * 0.86, 0.06);
      g.bezierCurveTo(hw * 0.8, 0.22, 0.2, 0.22, 0.1, my - 0.04);
      g.quadraticCurveTo(0, my - 0.06, -0.1, my - 0.04);
      g.bezierCurveTo(-0.2, 0.22, -hw * 0.8, 0.22, -hw * 0.86, 0.06);
      g.closePath();
      g.fill();
      // Keep the mouth readable through the beard.
      g.fillStyle = lip;
      g.globalAlpha = 0.6;
      g.beginPath();
      g.ellipse(0, my + 0.005, mw * 0.85, 0.012 + m.open * 0.03, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  }
  if (look.marks.glasses) {
    g.strokeStyle = "#2A2420";
    g.lineWidth = 0.016;
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.ellipse(dir * 0.15, 0.025, 0.085, 0.065, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-0.068, 0.015);
    g.quadraticCurveTo(0, -0.005, 0.068, 0.015);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.08)";
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.ellipse(dir * 0.15, 0.025, 0.08, 0.06, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawTorso(g: CanvasRenderingContext2D, look: PersonLook, side: number) {
  const male = look.gender === "male";
  const S = (male ? 1.12 : 0.98) * look.buildScale;
  const top = 0.8;
  // Neck.
  const nw = male ? 0.17 : 0.145;
  const neck = g.createLinearGradient(0, 0.3, 0, 0.95);
  neck.addColorStop(0, shade(look.skin, 0.3));
  neck.addColorStop(0.45, shade(look.skin, 0.1));
  neck.addColorStop(1, look.skin);
  g.fillStyle = neck;
  g.beginPath();
  g.moveTo(-nw, 0.3);
  g.lineTo(nw, 0.3);
  g.bezierCurveTo(nw, 0.62, nw * 1.2, 0.76, nw * 1.6, 0.86);
  g.lineTo(-nw * 1.6, 0.86);
  g.bezierCurveTo(-nw * 1.2, 0.76, -nw, 0.62, -nw, 0.3);
  g.fill();

  const shirt = g.createLinearGradient(side * S, top, -side * S, 2.4);
  shirt.addColorStop(0, tint(look.top, 0.14));
  shirt.addColorStop(0.5, look.top);
  shirt.addColorStop(1, shade(look.top, 0.3));
  g.fillStyle = shirt;
  g.beginPath();
  g.moveTo(-0.26, top);
  g.quadraticCurveTo(0, top + 0.16, 0.26, top);
  g.bezierCurveTo(S * 0.62, top + 0.04, S * 0.98, top + 0.1, S, top + 0.42);
  g.bezierCurveTo(S * 1.04, top + 0.9, S * 1.08, 2.0, S * 1.1, 3.4);
  g.lineTo(-S * 1.1, 3.4);
  g.bezierCurveTo(-S * 1.08, 2.0, -S * 1.04, top + 0.9, -S, top + 0.42);
  g.bezierCurveTo(-S * 0.98, top + 0.1, -S * 0.62, top + 0.04, -0.26, top);
  g.fill();
  // Ribbed collar.
  g.strokeStyle = shade(look.top, 0.18);
  g.lineWidth = 0.035;
  g.beginPath();
  g.moveTo(-0.26, top);
  g.quadraticCurveTo(0, top + 0.16, 0.26, top);
  g.stroke();
  // A soft fold toward the shadow side.
  g.strokeStyle = rgba(shade(look.top, 0.4), 0.25);
  g.lineWidth = 0.02;
  g.beginPath();
  g.moveTo(-side * S * 0.55, top + 0.35);
  g.quadraticCurveTo(-side * S * 0.45, top + 0.9, -side * S * 0.6, 2.2);
  g.stroke();
}

/**
 * Draw the person with the head centred at (cx, cy) and a head height of `u`
 * pixels. `side` is which side the key light is on (-1 left, 1 right).
 */
function drawPerson(g: CanvasRenderingContext2D, look: PersonLook, cx: number, cy: number, u: number, m: Motion, side: number) {
  const hw = look.gender === "male" ? 0.385 : 0.365;
  g.save();
  g.translate(cx, cy);
  g.scale(u, u);
  // Body (breathes, does not roll with the head).
  g.save();
  g.translate(0, -m.breathe);
  if (look.shape === "long" || look.shape === "shoulder" || look.shape === "braids" || look.shape === "locs" || look.shape === "bob" || look.shape === "curly") {
    g.save();
    g.translate(0, m.nod * 0.5);
    g.rotate(m.roll * 0.5);
    drawBackHair(g, look, hw, side);
    g.restore();
  }
  drawTorso(g, look, side);
  g.restore();
  // Head: pivots at the neck so a roll reads as a tilt, not a slide.
  g.save();
  g.translate(0, 0.45);
  g.rotate(m.roll);
  g.translate(0, -0.45 + m.nod - m.breathe * 0.5);
  if (!(look.shape === "long" || look.shape === "shoulder" || look.shape === "braids" || look.shape === "locs" || look.shape === "bob" || look.shape === "curly")) {
    drawBackHair(g, look, hw, side);
  }
  drawFace(g, look, hw, m, side);
  drawFrontHair(g, look, hw, side);
  g.restore();
  // Strands that fall in front of the shoulders.
  g.save();
  g.translate(0, m.nod * 0.6 - m.breathe);
  g.rotate(m.roll * 0.6);
  drawSideStrands(g, look, hw, side);
  g.restore();
  g.restore();
}

function vignette(g: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const v = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}

function applyGrain(g: CanvasRenderingContext2D, w: number, h: number, frame: number, alpha: number) {
  const pattern = g.createPattern(grain(), "repeat");
  if (!pattern) return;
  g.save();
  g.globalAlpha = alpha;
  g.globalCompositeOperation = "overlay";
  const rnd = mulberry32(frame + 1);
  g.translate(-rnd() * 160, -rnd() * 160);
  g.fillStyle = pattern;
  g.fillRect(0, 0, w + 160, h + 160);
  g.restore();
}

/**
 * One frame of the placeholder reaction at time `t` seconds, filling the
 * `w`×`h` frame at the context origin.
 */
export function drawPlaceholderReaction(
  ctx: CanvasRenderingContext2D,
  member: CastMember,
  setting: string,
  seed: number,
  t: number,
  w: number,
  h: number,
): void {
  const look = lookFor(member);
  const room = settingLookFor(setting);
  const s = (seed >>> 0) + hashString(member.id);
  const side = room.lightSide;

  // Handheld drift: a slow wander plus a faint fast tremor.
  const dx = (wobble(t * 0.9, s) * 0.009 + wobble(t * 7.3, s + 9) * 0.0012) * w;
  const dy = (wobble(t * 0.75, s + 3) * 0.007 + wobble(t * 6.1, s + 4) * 0.001) * h;
  const rot = wobble(t * 0.5, s + 7) * 0.006;
  const zoom = 1.06 + wobble(t * 0.3, s + 2) * 0.008;

  ctx.save();
  ctx.fillStyle = room.wall[1];
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2 + dx, h / 2 + dy);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);

  // Background moves a little more than the subject: depth.
  const bg = backdrop(room, w, h, s);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bg, -w * 0.04 + dx * 0.6, -h * 0.04 + dy * 0.6, w * 1.08, h * 1.08);

  // Key light wash on the subject side.
  const wash = ctx.createRadialGradient(side < 0 ? 0 : w, h * 0.3, 0, side < 0 ? 0 : w, h * 0.3, w * 1.1);
  wash.addColorStop(0, rgba(room.light, 0.22));
  wash.addColorStop(1, rgba(room.light, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);

  const m = motionAt(t, s);
  const u = Math.min(h * 0.25, w * 0.46);
  // Soft contact shadow behind the figure separates it from the room.
  const sh = ctx.createRadialGradient(w / 2 - side * w * 0.04, h * 0.62, w * 0.05, w / 2, h * 0.62, w * 0.6);
  sh.addColorStop(0, "rgba(0,0,0,0.2)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, h * 0.2, w, h * 0.8);
  drawPerson(ctx, look, w / 2, h * 0.47, u, m, side);
  ctx.restore();

  // Phone-camera finish: gentle vignette and grain (fixed to the sensor, not the scene).
  vignette(ctx, w, h, 0.28);
  applyGrain(ctx, w, h, Math.floor(t * 24), 0.07);

  const px = Math.max(10, Math.round(w * 0.024));
  drawTag(ctx, PLACEHOLDER_TAG, Math.round(w * 0.06), Math.round(h * 0.885), px);
}

// ---- static portrait --------------------------------------------------------

const STUDIO = ["#E9E2D8", "#DCE3E6", "#E5DDE3", "#DFE5DA", "#E8DFD2", "#D9DEE8"] as const;
const portraitCache = new Map<string, string>();

/**
 * A still of the member for cast grids, drawn the same way as the
 * placeholder: a 3:4 frame (`size` wide) on a soft studio backdrop. Rendered
 * at up to 2× for crisp display; cached per member and size.
 */
export function renderPortraitDataUrl(member: CastMember, size: number): string {
  const dpr = typeof window !== "undefined" ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1;
  const key = `${member.id}|${size}|${dpr}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;

  const w = Math.max(16, Math.round(size * dpr));
  const h = Math.round((w * 4) / 3);
  const c = makeCanvas(w, h);
  const g = c.getContext("2d");
  if (!g) return "";
  const look = lookFor(member);
  const base = STUDIO[look.seed % STUDIO.length];
  const side: -1 | 1 = look.seed % 2 ? 1 : -1;

  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, tint(base, 0.25));
  bg.addColorStop(1, shade(base, 0.12));
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const key2 = g.createRadialGradient(side < 0 ? w * 0.15 : w * 0.85, h * 0.2, 0, side < 0 ? w * 0.15 : w * 0.85, h * 0.2, w * 0.9);
  key2.addColorStop(0, "rgba(255,248,236,0.55)");
  key2.addColorStop(1, "rgba(255,248,236,0)");
  g.fillStyle = key2;
  g.fillRect(0, 0, w, h);

  drawPerson(g, look, w / 2, h * 0.42, h * 0.34, REST, side);
  vignette(g, w, h, 0.16);
  applyGrain(g, w, h, look.seed % 24, 0.05);

  const url = c.toDataURL("image/jpeg", 0.9);
  if (portraitCache.size > 200) portraitCache.clear();
  portraitCache.set(key, url);
  return url;
}
