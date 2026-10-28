// What the production UGC Lab already made, imported read-only by
// scripts/import/import-ugc-lab.cjs: the cast bank's faces, each take's still
// and clip with the exact prompts that produced them, and the finished ads.

import type { CastMember, Take } from "../contracts";
import data from "./production.json";

export interface ProductionCast {
  id: string;
  name: string;
  ageBand: string;
  gender: "female" | "male";
  type: string | null;
  face: string;
  prompt: string;
}

export interface ProductionTake {
  id: string;
  castId: string;
  still: string;
  clip: string | null;
  durationSeconds: number | null;
  persona: { adType: string | null; setting: string | null; wardrobe: string | null; gesture: string | null; lighting: string | null };
  stillPrompt: string;
  motionPrompt: string;
  createdAt: string | null;
}

export interface ProductionAd {
  id: string;
  takeId: string | null;
  castId: string | null;
  hook: string;
  favorite: boolean;
  video: string;
  poster: string;
  durationMs: number | null;
  soundLabel: string | null;
  demoLabel: string | null;
  createdAt: string | null;
}

interface ProductionLibrary {
  importedAt?: string;
  typeLabels: Record<string, string>;
  cast: ProductionCast[];
  takes: ProductionTake[];
  ads: ProductionAd[];
}

export const PRODUCTION = data as ProductionLibrary;
export const HAS_PRODUCTION = PRODUCTION.cast.length > 0;

/** A production cast member in the shape the rest of the site uses. */
export function toCastMember(c: ProductionCast): CastMember {
  return {
    id: c.id,
    name: c.name,
    age: NaN,
    ageLabel: c.ageBand,
    gender: c.gender,
    typeKey: c.type,
    heritage: "",
    boneStructure: "",
    hairColour: "",
    hairStyle: "",
    eyeColour: "",
    complexion: "",
    distinguishingMark: "",
    build: "",
    portraitPrompt: c.prompt,
    faceUrl: c.face,
  };
}

export function takesFor(castId: string): ProductionTake[] {
  return PRODUCTION.takes.filter((t) => t.castId === castId);
}

export function productionTake(id: string): ProductionTake | undefined {
  return PRODUCTION.takes.find((t) => t.id === id);
}

/** A production take as an engine Take, so the studio flow can carry it. */
export function toTake(t: ProductionTake): Take {
  return {
    id: t.id,
    persona: {
      castId: t.castId,
      adType: t.persona.adType ?? "reaction",
      setting: t.persona.setting ?? "",
      wardrobe: t.persona.wardrobe ?? "",
      lighting: t.persona.lighting ?? "",
      gesture: t.persona.gesture ?? "",
      extraNotes: "",
    },
    prompts: { still: t.stillPrompt, motion: t.motionPrompt },
  };
}
