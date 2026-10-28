// The live preview: draws a ComposeSpec onto a canvas at the canvas's own
// resolution (9:16, letterboxed if the canvas is another shape), plays the
// sound bed in sync through WebAudio, and loops.
//
// Clock: the playhead runs on performance.now() so visuals never stall on a
// suspended AudioContext (autoplay policy); audio is (re)started at the
// playhead whenever it can actually be heard — on play, seek, loop, and when
// the context unlocks after the first user gesture.
//
// Audio focus: several previews may be on a page (the hero carousel). Only
// the most recently played compositor is audible; the others keep animating.

import type { ComposeSpec, SoundChoice } from "../contracts";
import { createSoundNodes, type SoundNodes } from "../audio/sounds";
import { renderFrame } from "./frame";
import { clampTime, segmentAt, totalDuration } from "./timeline";

// ---- one AudioContext for the whole page ----------------------------------

let sharedCtx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  const Ctor: typeof AudioContext | undefined =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedCtx = new Ctor({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  // Browsers start the context suspended until a gesture; resume on the first one.
  const unlock = () => {
    void sharedCtx?.resume().catch(() => undefined);
    if (sharedCtx?.state === "running") {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("touchend", unlock, true);
    }
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
  window.addEventListener("touchend", unlock, true);
  return sharedCtx;
}

let audioOwner: Compositor | null = null;

const fileIds = new WeakMap<File, number>();
let nextFileId = 1;

function soundId(sound: SoundChoice, duration: number): string {
  if (sound.kind === "preset") return `preset:${sound.key}|${duration.toFixed(3)}`;
  let id = fileIds.get(sound.file);
  if (!id) {
    id = nextFileId++;
    fileIds.set(sound.file, id);
  }
  return `upload:${id}|${duration.toFixed(3)}`;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export class Compositor {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private spec: ComposeSpec | null = null;
  private playing = false;
  private t = 0;
  private anchorWall = 0;
  private anchorT = 0;
  private raf = 0;
  private destroyed = false;
  private video: HTMLVideoElement | null = null;
  private videoSrc = "";
  private readonly listeners = new Set<(t: number) => void>();
  private out: GainNode | null = null;
  private sound: SoundNodes | null = null;
  private soundKey = "";
  private soundToken = 0;
  private audioRunning = false;
  private isMuted = false;
  private readonly onStateChange = () => {
    if (this.playing && audioOwner === this && sharedCtx?.state === "running") this.startAudio(this.currentTime);
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Compositor: 2D canvas context unavailable");
    this.ctx = ctx;
  }

  /** Length of the current ad in seconds (0 before a spec is set). */
  get duration(): number {
    return this.spec ? totalDuration(this.spec) : 0;
  }

  /** The playhead in seconds. */
  get currentTime(): number {
    if (!this.playing) return this.t;
    return this.anchorT + (now() - this.anchorWall) / 1000;
  }

  /** Silence this preview without pausing it. */
  get muted(): boolean {
    return this.isMuted;
  }

  set muted(value: boolean) {
    this.isMuted = value;
    if (this.out && sharedCtx) this.out.gain.setTargetAtTime(value ? 0 : 1, sharedCtx.currentTime, 0.02);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  setSpec(spec: ComposeSpec): void {
    if (this.destroyed) return;
    this.spec = spec;
    const duration = totalDuration(spec);

    // Reaction footage.
    if (spec.reaction.kind === "video") {
      if (spec.reaction.src !== this.videoSrc) this.loadVideo(spec.reaction.src);
    } else {
      this.releaseVideo();
    }

    // Keep the playhead where it was when it still fits.
    const t = clampTime(this.currentTime, duration);
    this.t = t >= duration ? 0 : t;
    if (this.playing) {
      this.anchorT = this.t;
      this.anchorWall = now();
    }

    // Sound bed: rebuild only when the choice or the length changed.
    const key = soundId(spec.sound, duration);
    if (key !== this.soundKey) {
      this.soundKey = key;
      this.prepareSound(spec.sound, duration);
    }
    this.syncVideo(this.t, true);
    this.render(this.t);
  }

  play(): void {
    if (this.destroyed || this.playing) return;
    const duration = this.duration;
    if (this.t >= duration - 1e-3) this.t = 0;
    this.playing = true;
    this.anchorT = this.t;
    this.anchorWall = now();
    if (audioOwner && audioOwner !== this) audioOwner.stopAudio();
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- page-wide audio focus, not a closure alias
    audioOwner = this;
    const ctx = audioContext();
    if (ctx) {
      ctx.addEventListener("statechange", this.onStateChange);
      void ctx.resume().catch(() => undefined);
      if (!this.sound && this.spec && !this.out) this.prepareSound(this.spec.sound, duration);
    }
    this.startAudio(this.t);
    this.syncVideo(this.t, true);
    this.loop();
  }

  pause(): void {
    if (!this.playing) return;
    this.t = clampTime(this.currentTime, this.duration);
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stopAudio();
    this.video?.pause();
    this.render(this.t);
    this.emit(this.t);
  }

  seek(t: number): void {
    const duration = this.duration;
    this.t = clampTime(t, duration);
    if (this.playing) {
      if (this.t >= duration) this.t = 0;
      this.anchorT = this.t;
      this.anchorWall = now();
      this.startAudio(this.t);
    }
    this.syncVideo(this.t, true);
    this.render(this.t);
    this.emit(this.t);
  }

  /** Subscribe to the playhead; returns the unsubscribe. A drop in t means a loop. */
  onTime(cb: (t: number) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.pause();
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.listeners.clear();
    this.stopAudio();
    this.sound = null;
    this.soundToken++;
    this.out?.disconnect();
    this.out = null;
    sharedCtx?.removeEventListener("statechange", this.onStateChange);
    if (audioOwner === this) audioOwner = null;
    this.releaseVideo();
  }

  // ---- internals -------------------------------------------------------------

  private loop = () => {
    if (!this.playing || this.destroyed) return;
    const duration = this.duration;
    let t = this.currentTime;
    if (duration > 0 && t >= duration) {
      // Loop: re-anchor at the wrapped time so the cut stays on beat.
      t = t % duration;
      this.anchorT = t;
      this.anchorWall = now();
      this.startAudio(t);
      this.syncVideo(t, true);
    } else {
      this.syncVideo(t, false);
    }
    this.t = t;
    this.render(t);
    this.emit(t);
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(t: number) {
    if (!this.spec || this.destroyed) return;
    renderFrame(this.ctx, this.spec, t, this.canvas.width, this.canvas.height, { video: this.video });
  }

  private emit(t: number) {
    for (const cb of this.listeners) cb(t);
  }

  private prepareSound(choice: SoundChoice, duration: number) {
    const ctx = audioContext();
    if (!ctx) return;
    if (!this.out) {
      this.out = ctx.createGain();
      this.out.gain.value = this.isMuted ? 0 : 1;
      this.out.connect(ctx.destination);
    }
    this.stopAudio();
    this.sound = null;
    const token = ++this.soundToken;
    const out = this.out;
    createSoundNodes(ctx, choice, duration, out)
      .then((nodes) => {
        if (token !== this.soundToken || this.destroyed) {
          nodes.stop();
          return;
        }
        this.sound = nodes;
        if (this.playing && audioOwner === this) this.startAudio(this.currentTime);
      })
      .catch((err: unknown) => {
        // A bad upload should not take the preview down; it plays silent.
        console.warn("Castline: sound bed unavailable", err);
      });
  }

  private startAudio(offset: number) {
    const ctx = sharedCtx;
    if (!ctx || !this.sound || !this.playing || audioOwner !== this) return;
    if (ctx.state !== "running") return;
    // Schedule a hair ahead and start that far in, so sound and picture line up.
    const lead = 0.03;
    this.sound.start(ctx.currentTime + lead, offset + lead);
    this.audioRunning = true;
  }

  private stopAudio() {
    if (!this.audioRunning) return;
    this.sound?.stop();
    this.audioRunning = false;
  }

  private loadVideo(src: string) {
    this.releaseVideo();
    const v = document.createElement("video");
    v.muted = true; // the format drops the clip's own audio
    v.playsInline = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.setAttribute("playsinline", "");
    const redraw = () => {
      if (!this.playing) this.render(this.t);
    };
    v.addEventListener("loadeddata", redraw);
    v.addEventListener("seeked", redraw);
    v.src = src;
    this.video = v;
    this.videoSrc = src;
  }

  private releaseVideo() {
    if (!this.video) return;
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.video = null;
    this.videoSrc = "";
  }

  /** Keep the clip on the playhead: play through the reaction, park during the app half. */
  private syncVideo(t: number, hard: boolean) {
    const v = this.video;
    if (!v || !this.spec) return;
    const seg = segmentAt(this.spec, t);
    if (seg.segment !== "reaction") {
      if (!v.paused) v.pause();
      return;
    }
    const target = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(seg.local, v.duration - 0.05) : seg.local;
    if (hard || Math.abs(v.currentTime - target) > 0.2) {
      try {
        v.currentTime = Math.max(0, target);
      } catch {
        // Not seekable yet; loadeddata will redraw.
      }
    }
    if (this.playing && v.paused) void v.play().catch(() => undefined);
    if (!this.playing && !v.paused) v.pause();
  }
}
