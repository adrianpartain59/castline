// Export: render the ad on an offscreen canvas in real time and record it
// with MediaRecorder (canvas.captureStream + the bed through a
// MediaStreamDestination). The result is what the preview shows, frame for
// frame, at delivery size.
//
// Real time means a 10 s ad takes about 10 s to export, and the tab should
// stay visible: background tabs throttle timers, which drops frames.

import type { ComposeSpec } from "../contracts";
import { createSoundNodes } from "../audio/sounds";
import { renderFrame } from "./frame";
import { containerType, pickRecorderFormat } from "./recording";
import { segmentAt, totalDuration } from "./timeline";

export interface ExportOptions {
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (p: number) => void;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  extension: "mp4" | "webm";
}

function waitFor(target: EventTarget, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      target.removeEventListener(event, on);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const on = () => {
      clearTimeout(timer);
      target.removeEventListener(event, on);
      resolve();
    };
    target.addEventListener(event, on);
  });
}

async function loadVideo(src: string): Promise<HTMLVideoElement> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.crossOrigin = "anonymous";
  v.src = src;
  if (v.readyState < 3) await waitFor(v, "canplay", 20000);
  if (v.currentTime !== 0) {
    v.currentTime = 0;
    await waitFor(v, "seeked", 5000).catch(() => undefined);
  }
  return v;
}

const nextFrame = (fps: number) =>
  new Promise<void>((resolve) => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 1000 / fps);
  });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function exportVideo(spec: ComposeSpec, opts: ExportOptions = {}): Promise<ExportResult> {
  const width = Math.round(opts.width ?? 1080);
  const height = Math.round(opts.height ?? 1920);
  const fps = Math.max(1, Math.round(opts.fps ?? 30));
  const onProgress = opts.onProgress ?? (() => undefined);

  if (typeof MediaRecorder === "undefined") throw new Error("This browser cannot record video (no MediaRecorder).");
  const format = pickRecorderFormat((t) => MediaRecorder.isTypeSupported(t));
  if (!format) throw new Error("This browser cannot record MP4 or WebM video.");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D canvas context unavailable");
  if (typeof canvas.captureStream !== "function") throw new Error("This browser cannot capture a canvas stream.");

  const duration = totalDuration(spec);
  const video = spec.reaction.kind === "video" ? await loadVideo(spec.reaction.src) : null;

  const actx = new AudioContext({ latencyHint: "playback" });
  await actx.resume().catch(() => undefined);
  const dest = actx.createMediaStreamDestination();
  const sound = await createSoundNodes(actx, spec.sound, duration, dest);

  renderFrame(ctx, spec, 0, width, height, { video });
  const stream = canvas.captureStream(fps);
  for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    // ~0.18 bits per pixel per frame: about 11 Mbps at 1080×1920@30.
    videoBitsPerSecond: Math.round(width * height * fps * 0.18),
    audioBitsPerSecond: 192_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (e) => reject((e as unknown as { error?: Error }).error ?? new Error("Recording failed"));
  });

  const cleanup = () => {
    sound.stop();
    for (const track of stream.getTracks()) track.stop();
    void actx.close().catch(() => undefined);
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  };

  try {
    recorder.start(250);
    // Audio leads the picture by a scheduled margin; the audio clock is the
    // master when the context runs, since that is what gets recorded.
    const lead = 0.12;
    const audioClock = actx.state === "running";
    const audioStart = actx.currentTime + lead;
    const wallStart = performance.now() + lead * 1000;
    sound.start(audioStart, 0);
    const clock = () => (audioClock ? actx.currentTime - audioStart : (performance.now() - wallStart) / 1000);

    for (;;) {
      await nextFrame(fps);
      const t = clock();
      if (t >= duration) break;
      const time = Math.max(0, t);
      if (video) {
        const seg = segmentAt(spec, time);
        if (seg.segment === "reaction" && t >= 0) {
          if (video.paused) void video.play().catch(() => undefined);
          if (Math.abs(video.currentTime - seg.local) > 0.25) video.currentTime = seg.local;
        } else if (!video.paused) {
          video.pause();
        }
      }
      renderFrame(ctx, spec, time, width, height, { video });
      onProgress(Math.min(0.99, time / duration));
    }
    renderFrame(ctx, spec, duration - 1e-3, width, height, { video });
    // Give the encoder a couple of frames to take the last picture.
    await sleep((2000 / fps) | 0);
    recorder.stop();
    await stopped;
  } finally {
    cleanup();
  }

  const type = containerType(format.mimeType);
  const blob = new Blob(chunks, { type });
  onProgress(1);
  return { blob, mimeType: format.mimeType, extension: format.extension };
}
