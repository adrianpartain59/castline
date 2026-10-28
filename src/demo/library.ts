// The demo workspace: who is in the cast and what footage exists for them.
//
// When the production import is present (src/demo/production.json), the cast,
// stills, clips and finished ads are the real ones the UGC Lab made. Without
// it the site falls back to the engine-dealt Tempo cast, with rendered
// footage from footage.json or the in-browser placeholder.

import type { CastMember, CastType, ComposeSpec, ReactionSource } from "../contracts";
import { HOOKS } from "../engine";
import * as dealt from "./cast";
import { libraryPlan, takeKey } from "./plan";
import { HAS_PRODUCTION, PRODUCTION, takesFor, toCastMember } from "./production";
import footage from "./footage.json";

export { DEMO_BRAND } from "./cast";
export type { CastGroup } from "./cast";
export { HAS_PRODUCTION, PRODUCTION } from "./production";

// ---- cast ---------------------------------------------------------------------

function productionGroups(): dealt.CastGroup[] {
  const byType = new Map<string, CastMember[]>();
  // Members with takes first, so the studio opens on people who can be shot.
  const ordered = [...PRODUCTION.cast].sort((a, b) => takesFor(b.id).length - takesFor(a.id).length);
  for (const c of ordered) {
    const key = c.type ?? "general";
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(toCastMember(c));
  }
  const order = [...Object.keys(PRODUCTION.typeLabels), "general"];
  return order
    .filter((k) => byType.has(k))
    .map((key) => {
      const members = byType.get(key)!;
      const type: CastType = {
        key,
        label: PRODUCTION.typeLabels[key] ?? "General cast",
        plural: PRODUCTION.typeLabels[key] ?? "General cast",
        gender: members.every((m) => m.gender === members[0].gender) ? members[0].gender : null,
        blurb: key === "general" ? "Dealt from the general decks: a different, ordinary person every time." : "A typed cast: one archetype, still a different person every time.",
      };
      return { type, members };
    });
}

export const CAST_GROUPS: dealt.CastGroup[] = HAS_PRODUCTION ? productionGroups() : dealt.CAST_GROUPS;
export const ALL_CAST: CastMember[] = CAST_GROUPS.flatMap((g) => g.members);

export function castById(id: string): CastMember | undefined {
  return ALL_CAST.find((m) => m.id === id);
}

/** "Camila Ortega, Mid 20s" or "Maya Chen, 27". */
export function who(m: CastMember): string {
  return `${m.name}, ${m.ageLabel ?? m.age}`;
}

/** The second line under a face. */
export function detailOf(m: CastMember): string {
  if (HAS_PRODUCTION) {
    const takes = takesFor(m.id);
    const clips = takes.filter((t) => t.clip).length;
    return takes.length ? `${takes.length} stills · ${clips} clips` : "In the cast bank";
  }
  return m.distinguishingMark;
}

// ---- footage ------------------------------------------------------------------

interface Footage {
  portraits: Record<string, string>;
  stills: Record<string, string>;
  clips: Record<string, string>;
}

const FOOTAGE = footage as Footage;
const PLAN = HAS_PRODUCTION ? [] : libraryPlan();

export function portraitFor(member: CastMember): string | null {
  return member.faceUrl ?? FOOTAGE.portraits[member.id] ?? null;
}

/**
 * The reaction footage for a member. From production: one of their real
 * clips, preferring the setting asked for. Otherwise rendered footage or the
 * placeholder.
 */
export function reactionFor(member: CastMember, setting: string, seed: number): ReactionSource {
  if (HAS_PRODUCTION) {
    const clips = takesFor(member.id).filter((t) => t.clip);
    const pick = clips.find((t) => t.persona.setting === setting) ?? clips[0];
    if (pick) return { kind: "video", src: pick.clip!, poster: pick.still };
    return { kind: "placeholder", member, setting, seed };
  }
  const exact = takeKey(member.id, setting);
  const key = FOOTAGE.clips[exact] ? exact : PLAN.find((p) => p.castId === member.id && FOOTAGE.clips[p.key])?.key;
  if (key) return { kind: "video", src: FOOTAGE.clips[key], poster: FOOTAGE.stills[key] };
  return { kind: "placeholder", member, setting, seed };
}

export function hasRenderedFootage(): boolean {
  return HAS_PRODUCTION ? PRODUCTION.takes.some((t) => t.clip) : Object.keys(FOOTAGE.clips).length > 0;
}

/** The hero phone: one ad, a different person on every take. */
export function showcaseSpecs(): { spec: ComposeSpec; member: CastMember; take: number }[] {
  const hook = HOOKS[0];
  const picks = HAS_PRODUCTION
    ? ALL_CAST.filter((m) => takesFor(m.id).some((t) => t.clip)).slice(0, 8)
    : CAST_GROUPS.flatMap((g) => g.members.slice(0, 2));
  return picks.map((member, i) => {
    const setting = HAS_PRODUCTION ? "" : PLAN.find((p) => p.castId === member.id)!.setting;
    return {
      member,
      take: i + 1,
      spec: {
        reaction: reactionFor(member, setting, 31 * (i + 1)),
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
