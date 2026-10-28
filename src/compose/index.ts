// Public API of the compositor, the Tempo screens and the sound beds.

export { Compositor } from "./compositor";
export { exportVideo, type ExportOptions, type ExportResult } from "./export";
export { renderFrame, fitPortrait, type FrameSources } from "./frame";
export { drawPlaceholderReaction, renderPortraitDataUrl, PLACEHOLDER_TAG } from "./placeholder";
export { drawHook, SAFE_ZONE } from "./hook-text";
export { layoutHook, wrapText, type HookLayout, type HookLayoutOptions, type MeasureFn } from "./layout";
export {
  totalDuration,
  reactionDuration,
  appDuration,
  cutTime,
  segmentAt,
  wrapTime,
  clampTime,
  MIN_SEGMENT_S,
  FADE_OUT_S,
  type SegmentAt,
  type SegmentKind,
} from "./timeline";
export {
  lookFor,
  settingLookFor,
  skinToneFor,
  hairColourFor,
  eyeColourFor,
  hairShapeFor,
  type PersonLook,
  type SettingLook,
  type HairShape,
} from "./looks";
export { pickRecorderFormat, type RecorderFormat } from "./recording";

export { TEMPO_SCREENS, drawTempoScreen } from "../tempo/screens";
export { SOUNDS, createSoundNodes, renderPreset, type SoundNodes } from "../audio/sounds";
