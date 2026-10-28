// The shared shapes between the three parts of Castline:
//   engine/   the deterministic casting + prompt engine (ported from the real pipeline)
//   compose/  the in-browser compositor that turns a take into a finished ad
//   pages/    the landing page and the demo studio
// Nothing here imports anything, so every module can depend on it.

export type Gender = "female" | "male";

/** One pickable option in the direction chips (ad type, setting, wardrobe). */
export interface DirectionOption {
  key: string;
  label: string;
  /** The sentence the chip appends to the direction box. */
  sentence: string;
  /** Restricts a wardrobe option to one gender; absent means either. */
  gender?: Gender;
}

/** An archetype the cast can be dealt as ("Weekend runners"). */
export interface CastType {
  key: string;
  label: string;
  plural: string;
  /** null = this archetype casts both genders. */
  gender: Gender | null;
  blurb: string;
}

/**
 * A fictional person in the cast bank. Identity comes from dealt decks, so
 * N members are N different people, never one face N times.
 */
export interface CastMember {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  typeKey: string | null;
  heritage: string;
  boneStructure: string;
  hairColour: string;
  hairStyle: string;
  eyeColour: string;
  complexion: string;
  distinguishingMark: string;
  build: string;
  /** The exact portrait prompt this member was cast from. */
  portraitPrompt: string;
}

/** Everything that varies per take, on top of who is in it. */
export interface TakePersona {
  castId: string;
  adType: string;
  setting: string;
  wardrobe: string;
  lighting: string;
  gesture: string;
  extraNotes: string;
}

export interface Take {
  id: string;
  persona: TakePersona;
  /** Exact prompts the take is generated from; shown in the studio. */
  prompts: { still: string; motion: string };
}

export interface TakePins {
  adType?: string;
  setting?: string;
  wardrobe?: string;
}

// ---- compose ---------------------------------------------------------------

export type TextStyle = "tiktok" | "reels" | "minimal";
export type TempoScreenKey = "pace" | "plan" | "coach";
export type SoundKey = "lofi" | "upbeat" | "room";

/** Where the reaction footage comes from. Placeholder until the library is rendered. */
export type ReactionSource =
  | { kind: "video"; src: string; poster?: string }
  | { kind: "placeholder"; member: CastMember; setting: string; seed: number };

export type SoundChoice = { kind: "preset"; key: SoundKey } | { kind: "upload"; file: File };

export interface ComposeSpec {
  reaction: ReactionSource;
  reactionSeconds: number;
  appScreen: TempoScreenKey;
  appSeconds: number;
  hook: string;
  textStyle: TextStyle;
  sound: SoundChoice;
}
