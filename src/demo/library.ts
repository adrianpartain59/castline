// The demo workspace: the cast, the footage library plan, and the rendered
// files. footage.json is written by `npm run render -- publish`; anything not
// rendered yet falls back to the in-browser placeholder.

import type { CastMember, ComposeSpec, ReactionSource } from "../contracts";
import { HOOKS } from "../engine";
import { CAST_GROUPS } from "./cast";
import { libraryPlan, takeKey } from "./plan";
import footage from "./footage.json";

export { ALL_CAST, CAST_GROUPS, castById, DEMO_BRAND } from "./cast";
export type { CastGroup } from "./cast";

interface Footage {
  /** castId → portrait image */
  portraits: Record<string, string>;
  /** take key → approved still */
  stills: Record<string, string>;
  /** take key → finished clip */
  clips: Record<string, string>;
}

const FOOTAGE = footage as Footage;
const PLAN = libraryPlan();

export function portraitFor(castId: string): string | null {
  return FOOTAGE.portraits[castId] ?? null;
}

/**
 * Rendered footage when the library has it, otherwise the placeholder. A
 * setting this member was not rendered in falls back to their nearest
 * rendered take, so the face stays the one the visitor picked.
 */
export function reactionFor(member: CastMember, setting: string, seed: number): ReactionSource {
  const exact = takeKey(member.id, setting);
  const key = FOOTAGE.clips[exact]
    ? exact
    : PLAN.find((p) => p.castId === member.id && FOOTAGE.clips[p.key])?.key;
  if (key) return { kind: "video", src: FOOTAGE.clips[key], poster: FOOTAGE.stills[key] };
  return { kind: "placeholder", member, setting, seed };
}

export function hasRenderedFootage(): boolean {
  return Object.keys(FOOTAGE.clips).length > 0;
}

/** The hero carousel: one ad, a different person on every take. */
export function showcaseSpecs(): { spec: ComposeSpec; member: CastMember; take: number }[] {
  const hook = HOOKS[0];
  const picks = CAST_GROUPS.flatMap((g) => g.members.slice(0, 2));
  return picks.map((member, i) => {
    const planned = PLAN.find((p) => p.castId === member.id)!;
    return {
      member,
      take: i + 1,
      spec: {
        reaction: reactionFor(member, planned.setting, 31 * (i + 1)),
        reactionSeconds: 3.2,
        appScreen: (["pace", "plan", "coach"] as const)[i % 3],
        appSeconds: 3.4,
        hook,
        textStyle: "tiktok",
        sound: { kind: "preset", key: "lofi" },
      },
    };
  });
}
