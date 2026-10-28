// Which container/codec MediaRecorder should use. Pure: pass the browser's
// isTypeSupported in, so the preference order is unit-tested.

export interface RecorderFormat {
  mimeType: string;
  extension: "mp4" | "webm";
}

/** Most preferred first: H.264 MP4 (Safari, recent Chrome), then VP9/Opus WebM, then any WebM. */
export const RECORDER_CANDIDATES: readonly RecorderFormat[] = [
  { mimeType: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
  { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
];

export function pickRecorderFormat(isSupported: (mimeType: string) => boolean): RecorderFormat | null {
  for (const f of RECORDER_CANDIDATES) {
    try {
      if (isSupported(f.mimeType)) return f;
    } catch {
      // Some engines throw on unknown strings; treat as unsupported.
    }
  }
  return null;
}

/** The container type for the finished Blob (no codec parameters). */
export const containerType = (mimeType: string): string => mimeType.split(";")[0].trim();
