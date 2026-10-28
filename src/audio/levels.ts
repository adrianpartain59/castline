// Level math for the sound bed. Pure so it is unit-tested.
//
// The real assembler measures the bed segment that actually plays and applies
// one static gain toward a loudness target plus a true-peak limiter (dynamic
// loudnorm on a 4 s clip shipped near-silence). The browser has no LUFS meter,
// so this measures RMS over the window that plays — close to integrated
// loudness for a steady music bed — and moves it once, capped by the peak.

/** Music beds aim here (dBFS RMS ≈ LUFS for a steady bed; the pipeline targeted ~-16 LUFS). */
export const MUSIC_TARGET_DB = -16;
/** Room tone sits far under the music, as it would under a real selfie clip. */
export const ROOM_TARGET_DB = -34;
/** Peak ceiling before the playback limiter (headroom for codec overshoot). */
export const PEAK_CEILING_DB = -1.5;

export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const gainToDb = (g: number): number => (g > 0 ? 20 * Math.log10(g) : Number.NEGATIVE_INFINITY);

export interface Levels {
  rms: number;
  peak: number;
}

/** Minimal shape of an AudioBuffer, so tests can pass plain objects. */
export interface ChannelSource {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

/** RMS and sample peak across all channels over [startS, startS + durS). */
export function measureLevels(buf: ChannelSource, startS = 0, durS = Number.POSITIVE_INFINITY): Levels {
  const from = Math.max(0, Math.floor(startS * buf.sampleRate));
  const to = Math.min(buf.length, Number.isFinite(durS) ? from + Math.ceil(durS * buf.sampleRate) : buf.length);
  let sum = 0;
  let peak = 0;
  let n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    for (let i = from; i < to; i++) {
      const v = data[i];
      sum += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      n++;
    }
  }
  return { rms: n ? Math.sqrt(sum / n) : 0, peak };
}

/**
 * The one static gain that brings `levels` to `targetDb` RMS without pushing
 * the peak over `ceilingDb`. Silence gets unity gain (nothing to normalize).
 */
export function normalizeGain(levels: Levels, targetDb: number, ceilingDb: number = PEAK_CEILING_DB): number {
  if (!(levels.rms > 1e-6)) return 1;
  const toTarget = dbToGain(targetDb) / levels.rms;
  const peakCap = levels.peak > 0 ? dbToGain(ceilingDb) / levels.peak : toTarget;
  return Math.min(toTarget, peakCap);
}
