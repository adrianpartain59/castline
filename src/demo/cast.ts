// Tempo's pre-loaded cast, dealt by the real engine from fixed seeds so every
// visitor sees the same people. Kept free of any footage so the render script
// can import it without the site's data files.

import type { CastMember, CastType } from "../contracts";
import { CAST_TYPES, dealCast } from "../engine";

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
