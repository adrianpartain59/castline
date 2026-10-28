// The demo workspace: Tempo's pre-loaded cast and the footage rendered for it.
//
// The cast is dealt by the real engine from fixed seeds, so every visitor sees
// the same people and the prompts shown in the studio are the ones the footage
// was (or will be) rendered from. Footage is looked up in footage.json, which
// the render script fills in; anything not rendered yet falls back to the
// in-browser placeholder.

import type { CastMember, CastType, ComposeSpec, ReactionSource } from "../contracts";
import { CAST_TYPES, dealCast, DIRECTION_OPTIONS, HOOKS } from "../engine";
import footage from "./footage.json";

export const DEMO_BRAND = {
  name: "Tempo",
  tagline: "a fictional running app",
} as const;

const PER_TYPE = 6;

export interface CastGroup {
  type: CastType;
  members: CastMember[];
}

export const CAST_GROUPS: CastGroup[] = CAST_TYPES.map((type, i) => ({
  type,
  members: dealCast({
    count: PER_TYPE,
    typeKey: type.key,
    gender: type.gender ?? undefined,
    seed: 1009 + i * 7919,
  }),
}));

export const ALL_CAST: CastMember[] = CAST_GROUPS.flatMap((g) => g.members);

export function castById(id: string): CastMember | undefined {
  return ALL_CAST.find((m) => m.id === id);
}

const FOOTAGE = footage as Record<string, string>;

export function footageKey(castId: string, setting: string, variant = 0): string {
  return `${castId}:${setting}:${variant}`;
}

/** Rendered footage when the library has it, otherwise the placeholder. */
export function reactionFor(member: CastMember, setting: string, seed: number, variant = 0): ReactionSource {
  const src = FOOTAGE[footageKey(member.id, setting, variant)];
  return src ? { kind: "video", src } : { kind: "placeholder", member, setting, seed };
}

export function hasRenderedFootage(): boolean {
  return Object.keys(FOOTAGE).length > 0;
}

/** The hero carousel: one ad, a different person on every take. */
export function showcaseSpecs(): { spec: ComposeSpec; member: CastMember; take: number }[] {
  const hook = HOOKS[0];
  const picks = CAST_GROUPS.flatMap((g) => g.members.slice(0, 2));
  const settings = DIRECTION_OPTIONS.settings.map((s) => s.key);
  return picks.map((member, i) => ({
    member,
    take: i + 1,
    spec: {
      reaction: reactionFor(member, settings[i % settings.length], 31 * (i + 1)),
      reactionSeconds: 3.2,
      appScreen: (["pace", "plan", "coach"] as const)[i % 3],
      appSeconds: 3.4,
      hook,
      textStyle: "tiktok",
      sound: { kind: "preset", key: "lofi" },
    },
  }));
}
