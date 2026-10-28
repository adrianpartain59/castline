// The ad's sound bed, synthesized with WebAudio (no audio files ship):
//
//   lofi    soft Rhodes-ish chord pads with tape wobble, vinyl hiss and
//           crackle, a gentle kick and brushed snare, 76 bpm
//   upbeat  bright plucked arpeggio, offbeat bass, four-on-the-floor kick,
//           claps and open hats, 120 bpm
//   room    filtered room tone only, as if the selfie clip kept its own air
//
// Presets are rendered once per length into an AudioBuffer with an
// OfflineAudioContext (deterministic: seeded noise), measured, and gained once
// toward the loudness target; playback then runs through a limiter. An
// uploaded file is decoded and treated the same way.

import type { SoundChoice, SoundKey } from "../contracts";
import { mulberry32 } from "../compose/canvas";
import { FADE_OUT_S } from "../compose/timeline";
import { MUSIC_TARGET_DB, PEAK_CEILING_DB, ROOM_TARGET_DB, measureLevels, normalizeGain } from "./levels";

export const SOUNDS: { key: SoundKey; label: string }[] = [
  { key: "lofi", label: "Lo-fi bed" },
  { key: "upbeat", label: "Upbeat" },
  { key: "room", label: "Room tone only" },
];

export interface SoundNodes {
  /** Start playing at context time `at`, from `offset` seconds into the bed. Restartable. */
  start(at: number, offset: number): void;
  /** Stop whatever is playing. */
  stop(): void;
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ---- building blocks -------------------------------------------------------

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number, colour: "white" | "pink" | "brown"): AudioBuffer {
  const len = Math.max(1, Math.ceil(seconds * ctx.sampleRate));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = mulberry32(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
    if (colour === "white") d[i] = w;
    else if (colour === "brown") {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      // Paul Kellet's pink filter.
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

function crackleBuffer(ctx: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const len = Math.max(1, Math.ceil(seconds * ctx.sampleRate));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const rnd = mulberry32(seed);
  const perSample = 9 / ctx.sampleRate; // ~9 pops a second
  for (let i = 0; i < len; i++) {
    if (rnd() < perSample) {
      const amp = 0.25 + rnd() * 0.75;
      const decay = 20 + rnd() * 60;
      for (let j = 0; j < 200 && i + j < len; j++) d[i + j] += (rnd() * 2 - 1) * amp * Math.exp(-j / decay);
    }
  }
  return buf;
}

interface Graph {
  ctx: BaseAudioContext;
  out: AudioNode;
  len: number;
}

function env(g: GainNode, at: number, peak: number, attack: number, decay: number, sustain = 0, release = 0.05, hold = 0) {
  const p = g.gain;
  // A GainNode sits at 1 until its first event: silence it from time zero, or
  // a voice started before its envelope blasts at full level.
  p.value = 0;
  p.setValueAtTime(0, 0);
  p.setValueAtTime(0.0001, at);
  p.linearRampToValueAtTime(peak, at + attack);
  if (sustain > 0) {
    p.setTargetAtTime(peak * sustain, at + attack, decay / 3);
    p.setValueAtTime(peak * sustain, at + attack + hold);
    p.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  } else {
    p.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }
}

function kick(G: Graph, at: number, level: number, punch: number) {
  const { ctx } = G;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(punch, at);
  o.frequency.exponentialRampToValueAtTime(46, at + 0.11);
  env(g, at, level, 0.003, 0.32);
  o.connect(g).connect(G.out);
  o.start(at);
  o.stop(at + 0.4);
}

function noiseHit(G: Graph, noise: AudioBuffer, at: number, level: number, type: BiquadFilterType, freq: number, q: number, decay: number) {
  const { ctx } = G;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, at, level, 0.002, decay);
  src.connect(f).connect(g).connect(G.out);
  src.start(at, (at * 0.37) % Math.max(0.01, noise.duration - decay - 0.1));
  src.stop(at + decay + 0.05);
}

// ---- presets ---------------------------------------------------------------

function lofi(G: Graph) {
  const { ctx, len } = G;
  const bpm = 76;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const chords = [
    [53, 57, 60, 64], // Fmaj7
    [52, 55, 59, 62], // Em7
    [50, 53, 57, 60], // Dm7
    [48, 52, 55, 59], // Cmaj7
  ];
  // Warm the whole bed: everything lofi passes a gentle lowpass.
  const warm = ctx.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 7200;
  warm.Q.value = 0.4;
  warm.connect(G.out);
  const bus: Graph = { ...G, out: warm };

  // Tape wobble shared by every pad voice.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.55;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 7;
  lfo.connect(lfoDepth);
  lfo.start(0);
  lfo.stop(len);

  const padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 1500;
  padFilter.Q.value = 0.6;
  padFilter.connect(warm);

  for (let b = 0; b * bar < len; b++) {
    const at = b * bar;
    const chord = chords[b % chords.length];
    chord.forEach((m, i) => {
      for (const [type, detune, lvl] of [["triangle", 0, 0.05], ["sine", 6, 0.04]] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = midiHz(m);
        o.detune.value = detune;
        lfoDepth.connect(o.detune);
        const g = ctx.createGain();
        // Slightly strummed entry, long sustain, overlap into the next chord.
        env(g, at + i * 0.018, lvl, 0.06, 0.9, 0.55, 0.7, bar - 0.2);
        o.connect(g).connect(padFilter);
        o.start(at);
        o.stop(Math.min(len, at + bar + 0.8));
      }
    });
    // Sub bass on the root, beats 1 and the "and" of 3.
    for (const pos of [0, 2.5]) {
      const t0 = at + pos * beat;
      if (t0 >= len) continue;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = midiHz(chord[0] - 12);
      const g = ctx.createGain();
      env(g, t0, 0.2, 0.01, 0.5, 0.5, 0.3, beat * 0.9);
      o.connect(g).connect(warm);
      o.start(t0);
      o.stop(Math.min(len, t0 + beat * 1.4 + 0.3));
    }
  }

  const white = noiseBuffer(ctx, 2, 101, "white");
  for (let i = 0; i * beat < len; i++) {
    const at = i * beat;
    const inBar = i % 4;
    if (inBar === 0 || inBar === 2) kick(bus, at, 0.55, 105);
    if (inBar === 1 && i % 8 === 5) kick(bus, at + beat * 0.5, 0.32, 95);
    if (inBar === 1 || inBar === 3) noiseHit(bus, white, at, 0.11, "bandpass", 1900, 0.7, 0.16);
    // Swung, brushed hats.
    noiseHit(bus, white, at, 0.028, "highpass", 7000, 0.5, 0.05);
    noiseHit(bus, white, at + beat * 0.58, 0.02, "highpass", 7500, 0.5, 0.04);
  }

  // Vinyl: hiss plus crackle, both band-limited.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer(ctx, len, 202, "pink");
  const hf = ctx.createBiquadFilter();
  hf.type = "bandpass";
  hf.frequency.value = 3800;
  hf.Q.value = 0.35;
  const hg = ctx.createGain();
  hg.gain.value = 0.018;
  hiss.connect(hf).connect(hg).connect(G.out);
  hiss.start(0);
  const crackle = ctx.createBufferSource();
  crackle.buffer = crackleBuffer(ctx, len, 303);
  const cf = ctx.createBiquadFilter();
  cf.type = "highpass";
  cf.frequency.value = 1400;
  const cg = ctx.createGain();
  cg.gain.value = 0.05;
  crackle.connect(cf).connect(cg).connect(G.out);
  crackle.start(0);
}

function upbeat(G: Graph) {
  const { ctx, len } = G;
  const bpm = 120;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const chords = [
    [57, 61, 64], // A
    [52, 56, 59], // E
    [54, 57, 61], // F#m
    [50, 54, 57], // D
  ];
  const white = noiseBuffer(ctx, 2, 404, "white");

  // Pluck bus with a little stereo-free "room": a short feedback delay.
  const pluckBus = ctx.createGain();
  pluckBus.gain.value = 1;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = beat * 0.75;
  const fb = ctx.createGain();
  fb.gain.value = 0.22;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  pluckBus.connect(G.out);
  pluckBus.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(G.out);

  for (let b = 0; b * bar < len; b++) {
    const chord = chords[b % chords.length];
    const arp = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 24, chord[2] + 12, chord[1] + 12, chord[0] + 24, chord[2] + 12];
    for (let s = 0; s < 16; s++) {
      const at = b * bar + s * (beat / 4);
      if (at >= len) break;
      if (s % 2 === 1 && s % 4 !== 3) continue; // a syncopated 16th pattern
      const m = arp[s % arp.length];
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = midiHz(m);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = 2;
      f.frequency.setValueAtTime(5200, at);
      f.frequency.exponentialRampToValueAtTime(700, at + 0.16);
      const g = ctx.createGain();
      env(g, at, 0.055, 0.002, 0.2);
      o.connect(f).connect(g).connect(pluckBus);
      o.start(at);
      o.stop(at + 0.25);
    }
    // Offbeat bass.
    for (let q = 0; q < 4; q++) {
      const at = b * bar + q * beat + beat / 2;
      if (at >= len) break;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = midiHz(chord[0] - 24);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 520;
      const g = ctx.createGain();
      env(g, at, 0.13, 0.004, 0.22);
      o.connect(f).connect(g).connect(G.out);
      o.start(at);
      o.stop(at + 0.26);
    }
  }
  for (let i = 0; i * beat < len; i++) {
    const at = i * beat;
    kick(G, at, 0.85, 150);
    if (i % 2 === 1) {
      for (const dt of [0, 0.011, 0.023]) noiseHit(G, white, at + dt, 0.16, "bandpass", 1500, 0.9, 0.12);
    }
    noiseHit(G, white, at + beat / 2, 0.06, "highpass", 8500, 0.6, 0.11);
    noiseHit(G, white, at + beat / 4, 0.018, "highpass", 9500, 0.6, 0.03);
  }
}

function room(G: Graph) {
  const { ctx, len } = G;
  const low = ctx.createBufferSource();
  low.buffer = noiseBuffer(ctx, len, 505, "brown");
  const lf = ctx.createBiquadFilter();
  lf.type = "lowpass";
  lf.frequency.value = 420;
  const lg = ctx.createGain();
  lg.gain.value = 0.6;
  low.connect(lf).connect(lg).connect(G.out);
  low.start(0);
  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, len, 606, "pink");
  const af = ctx.createBiquadFilter();
  af.type = "bandpass";
  af.frequency.value = 900;
  af.Q.value = 0.4;
  const ag = ctx.createGain();
  ag.gain.value = 0.12;
  // A slow swell so it breathes like a real room, not a flat hiss.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const depth = ctx.createGain();
  depth.gain.value = 0.04;
  lfo.connect(depth).connect(ag.gain);
  lfo.start(0);
  lfo.stop(len);
  air.connect(af).connect(ag).connect(G.out);
  air.start(0);
}

const PRESETS: Record<SoundKey, (g: Graph) => void> = { lofi, upbeat, room };

const renderCache = new Map<string, Promise<AudioBuffer>>();

/** Render a preset bed of `duration` seconds (cached per length and rate). */
export function renderPreset(key: SoundKey, duration: number, sampleRate = 48000): Promise<AudioBuffer> {
  const len = Math.max(0.5, duration) + 0.1;
  const cacheKey = `${key}|${len.toFixed(2)}|${sampleRate}`;
  const hit = renderCache.get(cacheKey);
  if (hit) return hit;
  const job = (async () => {
    const off = new OfflineAudioContext(2, Math.ceil(len * sampleRate), sampleRate);
    // Bus compression glues the mix; the limiter after normalization guards peaks.
    const glue = off.createDynamicsCompressor();
    glue.threshold.value = -14;
    glue.knee.value = 8;
    glue.ratio.value = 3;
    glue.attack.value = 0.01;
    glue.release.value = 0.2;
    glue.connect(off.destination);
    (PRESETS[key] ?? lofi)({ ctx: off, out: glue, len });
    return off.startRendering();
  })();
  renderCache.set(cacheKey, job);
  job.catch(() => renderCache.delete(cacheKey));
  return job;
}

async function decodeUpload(ctx: BaseAudioContext, file: File): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  // Safari's older decodeAudioData is callback-only; wrap both shapes.
  return new Promise<AudioBuffer>((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && typeof (p as Promise<AudioBuffer>).then === "function") (p as Promise<AudioBuffer>).then(resolve, reject);
  });
}

function makeLimiter(ctx: BaseAudioContext): DynamicsCompressorNode {
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = PEAK_CEILING_DB;
  lim.knee.value = 0;
  lim.ratio.value = 20;
  lim.attack.value = 0.002;
  lim.release.value = 0.08;
  return lim;
}

/**
 * Build the bed for an ad of `duration` seconds, wired into `destination`
 * (a speaker, or a MediaStreamDestination for export). The bed fades out
 * over the last half second of the ad, like the real assembler.
 */
export async function createSoundNodes(
  ctx: BaseAudioContext,
  choice: SoundChoice,
  duration: number,
  destination: AudioNode,
): Promise<SoundNodes> {
  const total = Math.max(0.5, duration);
  const buffer = choice.kind === "upload" ? await decodeUpload(ctx, choice.file) : await renderPreset(choice.key, total, ctx.sampleRate);
  const target = choice.kind === "preset" && choice.key === "room" ? ROOM_TARGET_DB : MUSIC_TARGET_DB;
  const gain = normalizeGain(measureLevels(buffer, 0, total), target);

  const norm = ctx.createGain();
  norm.gain.value = gain;
  const limiter = makeLimiter(ctx);
  norm.connect(limiter).connect(destination);

  let current: { src: AudioBufferSourceNode; env: GainNode } | null = null;

  const stop = () => {
    if (!current) return;
    const { src, env: e } = current;
    current = null;
    try {
      src.stop();
    } catch {
      // Already stopped or never started.
    }
    src.disconnect();
    e.disconnect();
  };

  return {
    start(at: number, offset: number) {
      stop();
      const from = Math.min(Math.max(0, offset), total);
      const left = total - from;
      if (left <= 0.01) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      // A short upload loops to cover the ad; a preset was rendered to length.
      if (buffer.duration < total) src.loop = true;
      const e = ctx.createGain();
      const fadeStart = Math.max(0, left - FADE_OUT_S);
      e.gain.setValueAtTime(0, at);
      e.gain.linearRampToValueAtTime(1, at + 0.012);
      if (fadeStart > 0.012) e.gain.setValueAtTime(1, at + fadeStart);
      e.gain.linearRampToValueAtTime(0, at + left);
      src.connect(e).connect(norm);
      src.start(at, src.loop ? from % buffer.duration : Math.min(from, Math.max(0, buffer.duration - 0.01)));
      src.stop(at + left + 0.05);
      current = { src, env: e };
      src.onended = () => {
        if (current?.src === src) current = null;
      };
    },
    stop,
  };
}
