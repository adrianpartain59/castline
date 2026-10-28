// One finished frame of an ad at time t: the reaction (real clip or the
// placeholder) until the cut, then the Tempo screen recording, with the hook
// on top for the whole ad. Shared by the live preview and the export so both
// draw exactly the same picture.

import type { ComposeSpec } from "../contracts";
import { drawTempoScreen } from "../tempo/screens";
import { drawHook } from "./hook-text";
import { drawPlaceholderReaction } from "./placeholder";
import { segmentAt } from "./timeline";

export interface FrameSources {
  /** The reaction clip, when the reaction is real footage. */
  video?: HTMLVideoElement | null;
}

/** The largest 9:16 rectangle centred in w×h. */
export function fitPortrait(w: number, h: number): { x: number; y: number; w: number; h: number } {
  const target = 9 / 16;
  if (w / h > target) {
    const fw = Math.round(h * target);
    return { x: Math.round((w - fw) / 2), y: 0, w: fw, h };
  }
  const fh = Math.round(w / target);
  return { x: 0, y: Math.round((h - fh) / 2), w, h: fh };
}

/** Cover-fit a video frame into fw×fh (centre crop, like the assembler's scale). */
function drawVideoCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, fw: number, fh: number) {
  const vw = video.videoWidth || fw;
  const vh = video.videoHeight || fh;
  const scale = Math.max(fw / vw, fh / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, (fw - dw) / 2, (fh - dh) / 2, dw, dh);
}

function drawLoading(ctx: CanvasRenderingContext2D, fw: number, fh: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, fh);
  g.addColorStop(0, "#1C1C20");
  g.addColorStop(1, "#0E0E10");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, fw, fh);
  const r = fw * 0.035;
  ctx.save();
  ctx.translate(fw / 2, fh / 2);
  ctx.rotate(t * 5);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = fw * 0.006;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 1.4);
  ctx.stroke();
  ctx.restore();
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  spec: ComposeSpec,
  t: number,
  w: number,
  h: number,
  sources: FrameSources = {},
): void {
  const box = fitPortrait(w, h);
  if (box.w !== w || box.h !== h) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.beginPath();
  ctx.rect(0, 0, box.w, box.h);
  ctx.clip();

  const seg = segmentAt(spec, t);
  if (seg.segment === "reaction") {
    const r = spec.reaction;
    if (r.kind === "placeholder") {
      drawPlaceholderReaction(ctx, r.member, r.setting, r.seed, seg.local, box.w, box.h);
    } else if (sources.video && sources.video.readyState >= 2) {
      drawVideoCover(ctx, sources.video, box.w, box.h);
    } else {
      drawLoading(ctx, box.w, box.h, seg.local);
    }
  } else {
    drawTempoScreen(ctx, spec.appScreen, seg.local, box.w, box.h);
  }
  // As in the production assembler, the hook rides the reaction only: the cut
  // to the app is clean, so the product is never hidden behind a caption.
  if (seg.segment === "reaction") drawHook(ctx, spec.hook, spec.textStyle, box.w, box.h, { onLight: false });
  ctx.restore();
}
