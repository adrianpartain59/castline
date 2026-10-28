// Which takes the footage library holds. The render script renders exactly
// this list and the site looks footage up by the same keys, so the two can
// never disagree about what exists.
//
// Every cast member gets a few settings, rotated across the cast so the
// library as a whole covers every setting. A visitor who pins a setting a
// member was not rendered in gets that member's nearest rendered take: the
// face is what they picked, and the face is what has to be right.

import type { CastMember, Take } from "../contracts";
import { dealTakes, DIRECTION_OPTIONS } from "../engine";
import { ALL_CAST } from "./cast";

export interface PlannedTake {
  /** Stable id for files and footage.json: `<castId>--<setting>`. */
  key: string;
  castId: string;
  setting: string;
  take: Take;
}

export const DEFAULT_SETTINGS_PER_MEMBER = 2;

/** FNV-1a, so a take's seed depends only on its key. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function takeKey(castId: string, setting: string): string {
  return `${castId}--${setting}`;
}

export function libraryPlan(
  settingsPerMember = DEFAULT_SETTINGS_PER_MEMBER,
  cast: CastMember[] = ALL_CAST,
): PlannedTake[] {
  const settings = DIRECTION_OPTIONS.settings.map((s) => s.key);
  const reaction = DIRECTION_OPTIONS.adTypes[0].key;
  const per = Math.max(1, Math.min(settingsPerMember, settings.length));
  const plan: PlannedTake[] = [];
  cast.forEach((member, i) => {
    for (let j = 0; j < per; j++) {
      const setting = settings[(i * per + j) % settings.length];
      const key = takeKey(member.id, setting);
      const [take] = dealTakes({
        cast: [member],
        count: 1,
        pins: { adType: reaction, setting },
        extraNotes: "",
        seed: hashSeed(key),
      });
      plan.push({ key, castId: member.id, setting, take });
    }
  });
  return plan;
}
