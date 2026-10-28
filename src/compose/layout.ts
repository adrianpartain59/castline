// Hook-text layout: wrap, auto-size and balance a hook so it always fits the
// platform safe zone. Pure: the caller supplies the text measurer, so this runs
// (and is tested) without a canvas.

/** Width in px of `text` set at `fontPx`. */
export type MeasureFn = (text: string, fontPx: number) => number;

export interface HookLayoutOptions {
  /** Largest size to try. Default: maxWidth / 11. */
  maxFontPx?: number;
  /** Smallest size allowed before the hook is truncated. Default: 55% of max. */
  minFontPx?: number;
  /** Most lines the block may take. Default 5. */
  maxLines?: number;
  /** Tallest the block may be, in px. Default unbounded. */
  maxHeight?: number;
  /** Line height as a multiple of the font size. Default 1.22. */
  lineHeight?: number;
  /**
   * Even out line lengths at the chosen size (the way the apps' own text
   * tools set a caption), instead of a long first line and a one-word tail.
   * Default true.
   */
  balance?: boolean;
}

export interface HookLayout {
  fontPx: number;
  lineHeightPx: number;
  lines: string[];
  /** Measured width of each line at fontPx. */
  widths: number[];
  /** Widest line. */
  width: number;
  /** lines.length * lineHeightPx. */
  height: number;
  /** True when even the minimum size could not fit and the hook was cut with an ellipsis. */
  truncated: boolean;
}

function words(text: string): string[][] {
  return String(text ?? "")
    .split(/\r?\n/)
    // Split on ordinary spaces only, so a no-break space keeps "4 × 1.6 km" together.
    .map((p) => p.split(/[ \t\f\v]+/).filter(Boolean))
    .filter((p) => p.length > 0);
}

/** Split a single word that is wider than the line into chunks that fit. */
function breakWord(word: string, maxWidth: number, px: number, measure: MeasureFn): string[] {
  const out: string[] = [];
  let chunk = "";
  for (const ch of Array.from(word)) {
    const test = chunk + ch;
    if (chunk && measure(test, px) > maxWidth) {
      out.push(chunk);
      chunk = ch;
    } else {
      chunk = test;
    }
  }
  if (chunk) out.push(chunk);
  return out;
}

/** Greedy wrap of every paragraph at one size. */
export function wrapText(text: string, maxWidth: number, px: number, measure: MeasureFn): string[] {
  const lines: string[] = [];
  for (const para of words(text)) {
    let line = "";
    for (const raw of para) {
      const pieces = measure(raw, px) > maxWidth ? breakWord(raw, maxWidth, px, measure) : [raw];
      for (const word of pieces) {
        const test = line ? `${line} ${word}` : word;
        if (line && measure(test, px) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function ellipsize(line: string, maxWidth: number, px: number, measure: MeasureFn): string {
  let s = line.replace(/[\s.,;:!?-]+$/, "");
  while (s.length > 1 && measure(`${s}…`, px) > maxWidth) {
    s = s.slice(0, -1).replace(/\s+$/, "");
  }
  return `${s}…`;
}

/**
 * Lay a hook out inside `maxWidth`: the largest size whose wrap fits the line
 * and height limits, then balanced so lines are of similar length. If nothing
 * fits at the minimum size the hook is cut to the allowed lines with an
 * ellipsis (never overflowing the safe zone).
 */
export function layoutHook(
  text: string,
  maxWidth: number,
  measure: MeasureFn,
  options: HookLayoutOptions = {},
): HookLayout {
  const maxFontPx = Math.max(1, options.maxFontPx ?? Math.round(maxWidth / 11));
  const minFontPx = Math.max(1, Math.min(maxFontPx, options.minFontPx ?? Math.round(maxFontPx * 0.55)));
  const maxLines = Math.max(1, Math.floor(options.maxLines ?? 5));
  const maxHeight = options.maxHeight ?? Number.POSITIVE_INFINITY;
  const lh = options.lineHeight ?? 1.22;
  const balance = options.balance ?? true;

  const finish = (px: number, lines: string[], truncated: boolean): HookLayout => {
    const lineHeightPx = Math.round(px * lh * 100) / 100;
    const widths = lines.map((l) => measure(l, px));
    return {
      fontPx: px,
      lineHeightPx,
      lines,
      widths,
      width: widths.length ? Math.max(...widths) : 0,
      height: lines.length * lineHeightPx,
      truncated,
    };
  };

  if (words(text).length === 0) return finish(maxFontPx, [], false);

  const fits = (lines: string[], px: number) =>
    lines.length <= maxLines && lines.length * px * lh <= maxHeight + 0.001;

  // Step down roughly 3% at a time: fine enough to look continuous, few enough
  // iterations to run every frame.
  const step = Math.max(1, Math.round(maxFontPx * 0.03));
  for (let px = maxFontPx; px >= minFontPx; px -= step) {
    const lines = wrapText(text, maxWidth, px, measure);
    if (fits(lines, px)) {
      return finish(px, balance ? balanceLines(text, maxWidth, px, lines.length, measure) ?? lines : lines, false);
    }
  }
  // Exact minimum (the loop may have stepped past it).
  const px = minFontPx;
  const lines = wrapText(text, maxWidth, px, measure);
  if (fits(lines, px)) {
    return finish(px, balance ? balanceLines(text, maxWidth, px, lines.length, measure) ?? lines : lines, false);
  }
  const allowed = Math.max(1, Math.min(maxLines, Math.floor((maxHeight + 0.001) / (px * lh)) || 1));
  const kept = lines.slice(0, allowed);
  kept[kept.length - 1] = ellipsize(kept[kept.length - 1], maxWidth, px, measure);
  return finish(px, kept, true);
}

/**
 * The narrowest width that still wraps into `count` lines, found by bisection,
 * then the wrap at that width. Null when balancing cannot help (one line).
 */
function balanceLines(
  text: string,
  maxWidth: number,
  px: number,
  count: number,
  measure: MeasureFn,
): string[] | null {
  if (count < 2) return null;
  // Never narrower than the longest word that fit whole, or balancing would
  // start splitting words the plain wrap kept intact.
  const longest = Math.max(
    0,
    ...words(text)
      .flat()
      .map((w) => measure(w, px))
      .filter((w) => w <= maxWidth),
  );
  let lo = Math.max(maxWidth * 0.4, longest);
  let hi = maxWidth;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (wrapText(text, mid, px, measure).length <= count) hi = mid;
    else lo = mid;
  }
  const lines = wrapText(text, hi, px, measure);
  return lines.length === count ? lines : null;
}
