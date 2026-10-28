// Timeline math for one ad: reaction, then a hard cut to the app recording.
// Pure, so the preview, the export and the tests agree on every boundary.

import type { ComposeSpec } from "../contracts";

/** Shortest a half may be; anything shorter is treated as a typo, not a cut. */
export const MIN_SEGMENT_S = 0.5;
/** The bed fades out over the last half second, as the real assembler does. */
export const FADE_OUT_S = 0.5;

export type SegmentKind = "reaction" | "app";

export interface SegmentAt {
  segment: SegmentKind;
  /** Seconds since this segment started. */
  local: number;
  /** Seconds left in this segment. */
  remaining: number;
}

type Durations = Pick<ComposeSpec, "reactionSeconds" | "appSeconds">;

function safe(v: number): number {
  return Number.isFinite(v) ? Math.max(MIN_SEGMENT_S, v) : MIN_SEGMENT_S;
}

export function reactionDuration(spec: Durations): number {
  return safe(spec.reactionSeconds);
}

export function appDuration(spec: Durations): number {
  return safe(spec.appSeconds);
}

/** Whole ad length in seconds. */
export function totalDuration(spec: Durations): number {
  return reactionDuration(spec) + appDuration(spec);
}

/** Where the hard cut lands. */
export function cutTime(spec: Durations): number {
  return reactionDuration(spec);
}

/**
 * Which half is on screen at `t`. Times before 0 clamp to the first frame and
 * times at or after the end clamp to the last frame of the app half; the cut
 * frame itself (t === reaction length) already belongs to the app.
 */
export function segmentAt(spec: Durations, t: number): SegmentAt {
  const r = reactionDuration(spec);
  const a = appDuration(spec);
  const x = Number.isFinite(t) ? Math.max(0, t) : 0;
  if (x < r) return { segment: "reaction", local: x, remaining: r - x };
  const local = Math.min(x - r, a);
  return { segment: "app", local, remaining: a - local };
}

/** Wrap a playhead into [0, duration) for looping preview. */
export function wrapTime(t: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(t)) return 0;
  const m = t % duration;
  return m < 0 ? m + duration : m;
}

/** Clamp a seek target into [0, duration]. */
export function clampTime(t: number, duration: number): number {
  if (!Number.isFinite(t)) return 0;
  return Math.min(Math.max(0, t), Math.max(0, duration));
}
