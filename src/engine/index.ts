/**
 * The Castline engine — the deterministic creative core of the real UGC Lab,
 * ported to run in the browser.
 *
 * Two jobs, in the order the studio runs them:
 *   1. dealCast  — cast N fictional people (cast.ts, castTypes.ts). Identity
 *      lives here: a dealt name, bone structure, colouring and one
 *      distinguishing feature, each from its own deck.
 *   2. dealTakes — deal takes across the chosen faces (reaction.ts). A take
 *      varies only what a take owns: ad type, setting, wardrobe, light and
 *      gesture. Every take stores the exact still + motion prompts.
 *
 * Everything is a pure function of its inputs and a seed. No model calls, no
 * network, no storage: the real pipeline's generation, spend tracking and job
 * plumbing were left behind on purpose, because the part worth reading is the
 * part that decides what gets generated.
 */

import type {
  CastMember,
  CastType,
  DirectionOption,
  Gender,
  Take,
  TakePersona,
  TakePins,
} from "../contracts";
import {
  BUILD,
  CAST_OPTIONS,
  buildCastPrompt,
  eligible,
  optionFor,
  randomCastBatch,
  type CastField,
  type CastPersona,
} from "./cast";
import {
  CAST_TYPE_DEFS,
  FACE_ORDER,
  buildTypedCastPrompt,
  fieldsFor,
  poolFor,
  typeFor,
  typedCastBatch,
  typedLabelFor,
  type TypeField,
  type TypedPersona,
} from "./castTypes";
import {
  AD_TYPES,
  SETTING_OPTIONS,
  WARDROBE_OPTIONS,
  assignCast,
  buildMotionPromptFor,
  buildStillPromptFor,
  normalizeNotes,
  pronounsFor,
  randomPersonaBatch,
  type ResolvedPersona,
} from "./reaction";
import { dealDeck, intBetween, mulberry32, type Rng } from "./rng";

export { mulberry32, dealDeck, shuffle, type Rng } from "./rng";
export {
  AD_TYPES,
  GESTURE_OPTIONS,
  LIGHTING_OPTIONS,
  MAX_TAKES_PER_BATCH,
  PINNABLE_FIELDS,
  SETTING_OPTIONS,
  WARDROBE_OPTIONS,
  buildMotionDoctrine,
  buildStillDoctrine,
  pronounsFor,
} from "./reaction";
export { AMERICAN_NAMES, CAST_DOCTRINE, MAX_CAST_PER_BATCH } from "./cast";
export { HOOKS, HOOK_LINES, PAYOFFS, PAYOFF_LINES } from "./copy";

// ---------------------------------------------------------------------------
// What the studio is served
// ---------------------------------------------------------------------------

/**
 * The archetypes, as the UI sees them. Fragments are functions and stay
 * engine-side; the studio only ever needed key/label/plural/gender/blurb.
 */
export const CAST_TYPES: CastType[] = CAST_TYPE_DEFS.map((type) => ({
  key: type.key,
  label: type.label,
  plural: type.plural,
  gender: type.gender,
  blurb: type.blurb,
}));

/**
 * The direction chips. Each carries the sentence it appends to the direction
 * box. Only the pinnable axes are here — see reaction.ts for why the rest
 * must keep randomizing.
 */
export const DIRECTION_OPTIONS: {
  adTypes: DirectionOption[];
  settings: DirectionOption[];
  wardrobe: DirectionOption[];
} = {
  adTypes: AD_TYPES.map((type) => ({ key: type.key, label: type.label, sentence: type.sentence })),
  settings: SETTING_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    sentence: option.sentence || `${option.label}.`,
  })),
  wardrobe: WARDROBE_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    sentence: option.sentence || `${option.label}.`,
    ...(option.gender ? { gender: option.gender } : {}),
  })),
};

// ---------------------------------------------------------------------------
// Casting
// ---------------------------------------------------------------------------

/** The prompt states a band; the card shows a believable age inside it. */
const AGE_RANGES: Record<string, [number, number]> = {
  "early-20s": [21, 23],
  "mid-20s": [24, 26],
  "late-20s": [27, 29],
  "early-30s": [30, 32],
  "mid-30s": [33, 35],
  "late-30s": [36, 38],
};

function ageFor(band: string | undefined, rng: Rng): number {
  const [min, max] = AGE_RANGES[band || ""] || [25, 32];
  return intBetween(min, max, rng);
}

function idTag(seed: number): string {
  return (seed >>> 0).toString(36);
}

/**
 * In name mode the name IS the identity: heritage and complexion are carried
 * by it and deliberately never stated (stating both invites "Chloe Nguyen, of
 * Northern European descent"). So the card says so rather than showing a
 * dealt label the portrait never asked for.
 */
const CARRIED_BY_NAME = "Carried by the name";

function label(field: CastField, key: string, gender: Gender): string {
  return optionFor(field, key, gender).label;
}

function generalMember(persona: CastPersona, id: string, rng: Rng): CastMember {
  const g = persona.gender;
  return {
    id,
    name: persona.name,
    age: ageFor(persona.ageBand, rng),
    gender: g,
    typeKey: null,
    heritage: persona.mode === "name" ? CARRIED_BY_NAME : label("heritage", persona.heritage, g),
    boneStructure: label("face", persona.face, g),
    hairColour: label("hairColor", persona.hairColor, g),
    hairStyle: label("hair", persona.hair, g),
    eyeColour: label("eyes", persona.eyes, g),
    complexion: CARRIED_BY_NAME,
    distinguishingMark: label("mark", persona.mark, g),
    build: BUILD[g],
    portraitPrompt: buildCastPrompt(persona),
  };
}

function typedMember(persona: TypedPersona, id: string, rng: Rng): CastMember {
  const type = typeFor(persona.type)!;
  const g = persona.gender;
  const l = (field: TypeField) => typedLabelFor(field, persona.fields[field] || "", type, g);
  const build = typeof type.build === "function" ? type.build(pronounsFor(g)) : type.build;
  return {
    id,
    name: persona.name,
    age: ageFor(persona.fields.ageBand, rng),
    gender: g,
    typeKey: type.key,
    heritage: CARRIED_BY_NAME,
    // A featured type splits the face into geometry, eyes, nose and mouth;
    // the geometry is the bone structure.
    boneStructure: type.features ? l("faceShape") : l("face"),
    hairColour: l("hairColor"),
    hairStyle: l("hair"),
    eyeColour: l("eyes"),
    complexion: CARRIED_BY_NAME,
    distinguishingMark: l("mark"),
    build,
    portraitPrompt: buildTypedCastPrompt(persona),
  };
}

/**
 * Cast `count` people. Deterministic for a seed.
 *
 * With a `typeKey`, the archetype's own recipe casts them (and a gendered
 * archetype ignores `gender`). Without one, the general path casts random
 * Americans; with no `gender` either, the genders are dealt from a two-card
 * deck so the batch splits evenly rather than by coin flip.
 *
 * An unknown `typeKey` casts on the general path rather than returning
 * nothing — a stale chip should not empty the studio.
 */
export function dealCast(opts: {
  count: number;
  gender?: Gender;
  typeKey?: string | null;
  seed: number;
}): CastMember[] {
  const rng = mulberry32(opts.seed);
  const size = Math.max(0, Math.floor(opts.count) || 0);
  if (!size) return [];
  const tag = idTag(opts.seed);
  const type = typeFor(opts.typeKey);

  if (type) {
    const personas = typedCastBatch(type.key, size, { rng, gender: opts.gender });
    return personas.map((persona, i) => typedMember(persona, `${type.key}-${tag}-${i + 1}`, rng));
  }

  const genders: Gender[] = opts.gender
    ? Array.from({ length: size }, () => opts.gender as Gender)
    : dealDeck<Gender>(["female", "male"], size, rng);
  const personas = randomCastBatch(genders, { rng });
  return personas.map((persona, i) => generalMember(persona, `cast-${tag}-${i + 1}`, rng));
}

/**
 * How many distinct faces the decks can deal for one gender: the product of
 * every deck that shapes the face in the portrait prompt — bone structure,
 * hair style, hair colour, eye colour and the distinguishing mark (plus, for
 * a featured archetype, its eyes / nose / mouth / type-only axes). Age band
 * and the beauty register are left out because they change how a face reads,
 * not whose face it is; the name is left out because it is an anchor on top
 * of the face, not a facial trait (it would multiply the count by its pool).
 *
 * With a `typeKey`, the count uses the archetype's narrowed pools — which is
 * the honest measure of how much a type gives up for its focus.
 */
export function castCombinations(gender: Gender, typeKey?: string | null): number {
  const type = typeFor(typeKey);
  if (type) {
    const g = type.gender || gender;
    const identity = fieldsFor(type).filter((field) => field !== "ageBand" && field !== "beauty");
    return identity.reduce((product, field) => product * poolFor(field, type, g).length, 1);
  }
  const identity: CastField[] = ["face", "hair", "hairColor", "eyes", "mark"];
  return identity.reduce((product, field) => product * eligible(field, gender).length, 1);
}

// Re-exported for the studio's "what got dealt" panels and the tests.
export { CAST_OPTIONS, FACE_ORDER };

// ---------------------------------------------------------------------------
// Takes
// ---------------------------------------------------------------------------

function resolve(member: CastMember, persona: TakePersona): ResolvedPersona {
  return {
    castId: persona.castId || member.id,
    gender: member.gender,
    adType: persona.adType,
    setting: persona.setting,
    wardrobe: persona.wardrobe,
    lighting: persona.lighting,
    gesture: persona.gesture,
    extraNotes: normalizeNotes(persona.extraNotes),
  };
}

/** The still prompt for one take on one cast member. */
export function buildStillPrompt(member: CastMember, persona: TakePersona): string {
  return buildStillPromptFor(resolve(member, persona));
}

/** The motion prompt for one take on one cast member. */
export function buildMotionPrompt(member: CastMember, persona: TakePersona): string {
  return buildMotionPromptFor(resolve(member, persona));
}

/**
 * Deal `count` takes across the chosen cast. Deterministic for a seed.
 *
 * Faces are dealt first (assignCast: shuffle once, then wrap), so every
 * selected face gets at least one take and nobody gets a second until
 * everyone has a first. Then every remaining axis is dealt the same way
 * across the batch, so two takes on the same person still differ in room,
 * wardrobe, light and gesture instead of colliding the way independent
 * per-take rolls do. A pinned axis holds on every take it is eligible for.
 *
 * More faces than takes is refused rather than silently trimmed — the
 * promise is "every selected face gets a take", and a trim would leave the
 * operator believing a face is in the batch when it is not.
 */
export function dealTakes(opts: {
  cast: CastMember[];
  count: number;
  pins: TakePins;
  extraNotes: string;
  seed: number;
}): Take[] {
  const rng = mulberry32(opts.seed);
  const seen = new Set<string>();
  // Duplicates are dropped rather than silently buying someone two takes.
  const cast = opts.cast.filter((member) => member && !seen.has(member.id) && seen.add(member.id));
  const takeCount = Math.max(0, Math.floor(opts.count) || 0);
  if (!takeCount) return [];
  if (!cast.length) throw new Error("Pick at least one cast member to deal takes against.");
  if (cast.length > takeCount) {
    throw new Error(
      `Selected ${cast.length} cast members for ${takeCount} take${takeCount === 1 ? "" : "s"} — every selected face has to get at least one take.`,
    );
  }

  const dealt = assignCast(takeCount, cast, rng);
  const personas = randomPersonaBatch(
    dealt.map((member) => ({
      // The cast member IS the person, so their gender is not the batch's to
      // randomize — a male face under a female prompt fights the reference.
      castId: member.id,
      gender: member.gender,
      adType: opts.pins.adType,
      setting: opts.pins.setting,
      wardrobe: opts.pins.wardrobe,
      extraNotes: opts.extraNotes,
    })),
    rng,
  );

  const tag = idTag(opts.seed);
  return personas.map((resolved, i) => ({
    id: `take-${tag}-${i + 1}`,
    persona: {
      castId: resolved.castId || dealt[i].id,
      adType: resolved.adType,
      setting: resolved.setting,
      wardrobe: resolved.wardrobe,
      lighting: resolved.lighting,
      gesture: resolved.gesture,
      extraNotes: resolved.extraNotes,
    },
    prompts: {
      still: buildStillPromptFor(resolved),
      motion: buildMotionPromptFor(resolved),
    },
  }));
}
