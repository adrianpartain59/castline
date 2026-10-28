/**
 * UGC Lab — the AI UGC selfie clip that opens a hook ad (3-6s subject,
 * hard cut to an app screen recording). This module is the creative core: a
 * persona matrix, an ad-type registry, and the two prompt builders (still +
 * motion). In the real pipeline generation reused shared plumbing (a still
 * generator for the frame, an image-to-video call for the clip); Castline
 * keeps only the deterministic part, which is the part worth reading.
 *
 * Deliberately no LLM calls: the matrix is deterministic and auditable, and
 * every take stores the exact prompts it was generated from. Variation comes
 * from the matrix, which is also the fatigue-reset axis of the ad format —
 * first-frame diversity, same skeleton.
 *
 * THREE axes are operator-pinnable here. One of them changes what the ad IS
 * (Adrian, 2026-09-05):
 *   adType  — reaction | point-at-text
 * and two are briefs rather than identity axes:
 *   wardrobe — running kit, gym clothes, business casual, no shirt (2026-09-08)
 *   setting  — the room or the track the take happens in
 * Pinning wardrobe and setting is safe where pinning look/hair/complexion was
 * not: they say nothing about the FACE, which is what collapsed the first
 * batch, and the face now comes from the cast bank regardless. Left unpinned
 * they deal per take exactly as before. (Gender was the third pin in the real
 * lane; here it rides on the cast member, because the face IS the person.)
 * Everything else (lighting, gesture, and whichever of the above are not
 * pinned) randomizes on every take and is NOT exposed in the direction chips.
 * That is deliberate: doctrine principle 5 below requires each take to read
 * as a different person, and pinning those axes is what collapsed the first
 * batch onto one face.
 *
 * The creative rules live in two DOCTRINE builders (Adrian, 2026-09-04, from
 * the first live batch) — general principles, not micro-rules, so they hold
 * across styles and across both genders:
 *   1. The camera IS their phone. No phone, screen, or device may appear in
 *      frame — the first batch kept drawing the phone she was "reacting to".
 *   2. Amateur imperfection over polish. Even lighting + clean framing reads
 *      as AI; mundane, slightly-off, lived-in reads as real.
 *   3. Understated emotion. The GESTURE carries the beat; the face stays
 *      relaxed, near deadpan. Wide eyes, raised brows, gasps and visible
 *      breathing killed the first batch.
 *   4. Casting is 20s-30s and believably ordinary. The anti-AI signal is an
 *      ORDINARY FACE, which is why the male "muscular / fit / good skin"
 *      brief (Adrian, 2026-09-05) lands on the BUILD and the SKIN and never
 *      on the face: a gym-fit body under an unremarkable face is still
 *      inside principle 4, a model's face is not.
 *   5. Real-person variation. Every take should read as a different person
 *      in a different room, and sameness is a defect.
 *
 * The still shows the pose ALREADY LANDED and the motion prompt directs
 * near-stillness on top of it. Animating a hand travelling into position was
 * considered and rejected: a moving hand across the face is the
 * highest-artifact surface in image-to-video, while a held pose survives it.
 */

import type { Gender } from "../contracts";
import { dealDeck, shuffle, type Rng } from "./rng";

export const MAX_TAKES_PER_BATCH = 8;
export const MAX_EXTRA_NOTES_CHARS = 500;

// The video models this targeted accept 4/6/8s and nothing else. The lane
// used to withhold 8 because an 8s held pose drags — but the hook is trimmed
// to any length at assemble now (2026-09-15), so a longer clip is just more
// footage to cut from.
export const ALLOWED_CLIP_SECONDS = [4, 6, 8] as const;
export const DEFAULT_CLIP_SECONDS = 4;

/**
 * Pronoun sets. Every gendered string in this module resolves through one of
 * these rather than hardcoding "she" — a male take reading "She never speaks"
 * makes the video model animate the wrong subject.
 *
 * `skinClause` was per-gender while the two briefs differed — the female
 * doctrine (2026-09-04) asked for minor real-world imperfections, the male
 * brief (2026-09-05) asked for good skin. They are the SAME clause as of
 * 2026-09-08: the asymmetry was giving female takes a blemish demand male
 * takes never got, for no stated reason. Both stay anti-AI by demanding real
 * untouched texture — "good skin" means clear, never airbrushed.
 */
export interface Pronouns {
  noun: string;
  they: string;
  They: string;
  them: string;
  their: string;
  Their: string;
  themself: string;
  skinClause: string;
}

export const GENDER_PRONOUNS: Record<Gender, Pronouns> = {
  female: {
    noun: "woman",
    they: "she",
    They: "She",
    them: "her",
    their: "her",
    Their: "Her",
    themself: "herself",
    skinClause:
      "clear healthy skin with real untouched texture and visible pores, never airbrushed or retouched",
  },
  male: {
    noun: "man",
    they: "he",
    They: "He",
    them: "him",
    their: "his",
    Their: "His",
    themself: "himself",
    skinClause:
      "clear healthy skin with real untouched texture and visible pores, never airbrushed or retouched",
  },
};

export function pronounsFor(gender: Gender | null | undefined): Pronouns {
  return (gender && GENDER_PRONOUNS[gender]) || GENDER_PRONOUNS.female;
}

/**
 * Principle block appended to every still prompt. Keep it general: it must
 * improve any persona/setting/ad-type combination, not prescribe one look.
 *
 * One wording change from the original: it said "an ordinary American home",
 * because every setting it could deal was indoors. A running app deals the
 * track bleachers and a park bench too, and a doctrine that names a home
 * argues with a setting that is not one. The principle — lived-in,
 * unremarkable, American — is unchanged; only the room stopped being implied.
 */
export function buildStillDoctrine(g: Pronouns): string {
  return [
    `${g.Their} face is relaxed and natural, almost deadpan — the moment reads only through the gesture.`,
    "No wide eyes, no raised eyebrows, no open-mouth gasp, no dramatic expression; a calm, believable face looking into the lens.",
    `This is an ordinary, imperfect, handheld front-camera phone selfie a real person took of ${g.themself}:`,
    `everyday soft flattering light, a lived-in unremarkable background in an ordinary American place, casual imperfect framing, ${g.skinClause}.`,
    "It must not look staged, styled, professionally lit, or like an editorial photo.",
    "The phone taking this photo is the only device that exists and it is never visible:",
    "no phone, screen, or gadget anywhere in the frame — one hand makes the gesture, the other holds the camera out of frame.",
  ].join(" ");
}

/**
 * Principle block for the motion prompt. Near-stillness: the ad format holds
 * the pose for 3-6s under overlay text; drama is a defect.
 */
export function buildMotionDoctrine(g: Pronouns): string {
  return [
    `${g.Their} face stays relaxed and calm the whole time — no eye-widening, no gasp, no visible or heavy breathing, no dramatic expression change.`,
    `Only subtle natural micro-movement: a blink, a small shift of ${g.their} gaze back to the lens, a very slight head tilt, gentle handheld camera wobble.`,
    `${g.They} never speaks and nothing sudden happens.`,
  ].join(" ");
}

/** A gesture is two fragments: the landed pose, and how it is held. */
export interface GestureOption {
  key: string;
  label: string;
  adType: string;
  still: (g: Pronouns) => string;
  motion: (g: Pronouns) => string;
}

export interface AdType {
  key: string;
  label: string;
  sentence: string;
  blurb: string;
  framing: string;
  beat: (g: Pronouns, gesture: GestureOption) => string;
  motionBeat: (g: Pronouns, gesture: GestureOption) => string;
}

/**
 * The ad types. An ad type is NOT a gesture: it swaps three things a gesture
 * entry cannot carry — the gesture POOL it draws from, the framing line, and
 * the narrative beat. Adding a third type means adding an entry here plus
 * gestures tagged with its key.
 *
 * point-at-text exists because of a hard constraint in the renderer: the
 * burned-in overlay lands at yPct 32, horizontally centred, up to 82% of the
 * frame wide (the compositor in src/compose follows the same geometry). The
 * reaction framing puts head and shoulders in that exact band, so a subject
 * pointing at the text has to vacate the upper third and point INTO it.
 */
export const AD_TYPES: AdType[] = [
  {
    key: "reaction",
    sentence: "Reacting to a feature in the app.",
    label: "Reaction",
    blurb: "Caught mid-reaction, hand to the face. The original lane.",
    framing:
      "Head and shoulders fill the upper half of the frame, one arm extended toward the camera.",
    beat: (g, gesture) =>
      `${g.They} has just found something out, caught mid-reaction: ${gesture.still(g)}.`,
    motionBeat: (g, gesture) => `${g.They} holds the reaction almost still: ${gesture.motion(g)}.`,
  },
  {
    key: "point-at-text",
    sentence: "Pointing up at the hook text above.",
    label: "Pointing at text",
    blurb: "Points up into empty frame space where the overlay hook is burned in.",
    framing: [
      "Head and shoulders sit low and off to one side, filling only the lower two thirds of the vertical frame.",
      "The entire upper third of the frame is deliberately empty: plain uncluttered wall or background, nothing in it, no objects, no text, no writing of any kind.",
    ].join(" "),
    beat: (g, gesture) =>
      `${g.They} is looking straight into the lens, calm and matter-of-fact, drawing attention to the empty space above: ${gesture.still(g)}.`,
    motionBeat: (g, gesture) => `${g.They} holds the pose almost still: ${gesture.motion(g)}.`,
  },
];

export function adTypeFor(key: string | null | undefined): AdType {
  return AD_TYPES.find((type) => type.key === key) || AD_TYPES[0];
}

/**
 * Each option: stable key (stored on the take), UI label, and the fragment
 * that reaches the prompt — a plain string, or a function of the pronoun set
 * when it has to agree with the subject. Keys are the contract with the
 * store/UI: renaming one orphans stored takes.
 *
 * An option may carry a `gender` and/or `adType` tag. Untagged means eligible
 * everywhere; tagged means only for that gender / that ad type. That single
 * rule is how the male pools, the female pools and the two gesture pools all
 * coexist in one flat matrix the UI can still label.
 */
export interface PersonaOption {
  key: string;
  label: string;
  gender?: Gender;
  adType?: string;
  sentence?: string;
  fragment: string | ((g: Pronouns) => string);
}

export const SETTING_OPTIONS: PersonaOption[] = [
  {
    key: "front-steps",
    label: "Front steps, post-run",
    sentence: "Just back from a run, sitting on the front steps.",
    fragment: (g) => `sitting on the front steps outside ${g.their} home, just back from a run`,
  },
  {
    key: "track",
    label: "Track bleachers",
    sentence: "At the track, sitting on the bleachers.",
    fragment: "sitting on the bleachers beside an outdoor running track",
  },
  {
    key: "park",
    label: "Park bench",
    sentence: "On a bench along a park running path.",
    fragment: "sitting on a bench beside a park running path",
  },
  {
    key: "car",
    label: "Parked car",
    sentence: "In the parked car after a run.",
    fragment: "sitting in the driver's seat of a parked car",
  },
  {
    key: "kitchen",
    label: "Kitchen",
    sentence: "At the kitchen counter at home.",
    fragment: (g) => `sitting at ${g.their} kitchen counter at home`,
  },
  {
    key: "couch",
    label: "Living-room couch",
    sentence: "Sitting back on the living-room couch.",
    fragment: (g) => `sitting back on ${g.their} living-room couch`,
  },
  {
    key: "gym",
    label: "Gym locker room",
    sentence: "On a bench in the gym locker room.",
    fragment: "sitting on a bench in a gym locker room",
  },
  {
    key: "bedroom",
    label: "Bedroom",
    sentence: "Sitting on the bed at home.",
    fragment: (g) => `sitting on ${g.their} bed against the headboard`,
  },
];

// Every option is ORDINARY light that still flatters. Two of these used to
// be written as defects — "flat unflattering daylight" and "slightly harsh
// overhead" — so half of all takes drew deliberately bad light on top of an
// already-plain face. Un-staged and unflattering are not the same property:
// real phone photos of good-looking people are lit from a window, and the
// anti-AI signal lives in the framing and the room, not in bad light.
export const LIGHTING_OPTIONS: PersonaOption[] = [
  { key: "window", label: "Window daylight", fragment: "soft daylight from a window off to one side" },
  { key: "warm", label: "Evening lamp", fragment: "warm ordinary evening lamplight from one side" },
  {
    // Named for the car in the original but NOT gated to it — tags only carry
    // gender and adType — so it was landing on kitchen counters and
    // living-room couches as "daylight through the car windows". The light
    // itself is the point, so the wording drops the room and the setting axis
    // supplies it.
    key: "open-day",
    label: "Open daylight",
    fragment: "soft open daylight",
  },
  {
    // The runner's light. Same rule as open daylight: it names the light, not
    // where it falls, so it reads as true on a track and on a front step.
    key: "early-morning",
    label: "Early morning",
    fragment: "soft low early-morning light",
  },
  {
    key: "overhead",
    label: "Overhead indoor",
    fragment: "even ordinary indoor lighting with a little shape to it",
  },
];

// Two pools, split by adType. The verb is the doctrine: reaction gestures
// REST, pointing gestures are HELD STEADY. Both are calm — pressed,
// clutched, gripped, jabbed all read as drama, which is what the
// 2026-09-04 correction removed.
export const GESTURE_OPTIONS: GestureOption[] = [
  {
    key: "hand-over-mouth",
    label: "Hand over mouth",
    adType: "reaction",
    still: (g) => `one hand resting loosely over ${g.their} mouth, fingers relaxed`,
    motion: (g) => `${g.their} hand stays resting loosely over ${g.their} mouth`,
  },
  {
    key: "fingers-to-lips",
    label: "Fingertips to lips",
    adType: "reaction",
    still: (g) => `fingertips resting lightly on ${g.their} lips`,
    motion: (g) => `${g.their} fingertips stay resting on ${g.their} lips`,
  },
  {
    key: "hand-on-cheek",
    label: "Hand on cheek",
    adType: "reaction",
    still: (g) => `one hand resting against ${g.their} cheek`,
    motion: (g) => `${g.their} hand stays resting against ${g.their} cheek`,
  },
  {
    key: "hand-on-chest",
    label: "Hand on chest",
    adType: "reaction",
    still: (g) => `one hand resting flat on ${g.their} chest`,
    motion: (g) => `${g.their} hand stays resting on ${g.their} chest`,
  },
  {
    key: "hand-on-forehead",
    label: "Hand on forehead",
    adType: "reaction",
    still: (g) => `one palm resting on ${g.their} forehead`,
    motion: (g) => `${g.their} palm stays resting on ${g.their} forehead`,
  },
  {
    key: "point-up",
    label: "Point straight up",
    adType: "point-at-text",
    still: (g) =>
      `one arm raised, index finger held steady pointing straight up into the empty space above ${g.their} head`,
    motion: (g) => `${g.their} raised finger stays held steady, still pointing up`,
  },
  {
    key: "point-up-side",
    label: "Point up and across",
    adType: "point-at-text",
    still: () =>
      "one arm raised across the body, index finger held steady pointing up and slightly across into the empty upper part of the frame",
    motion: (g) => `${g.their} raised arm stays held steady, finger still pointing up and across`,
  },
  {
    key: "thumb-up-over-shoulder",
    label: "Thumb over shoulder",
    adType: "point-at-text",
    still: (g) =>
      `one hand raised beside ${g.their} head, thumb held steady pointing up into the empty space above`,
    motion: (g) => `${g.their} raised thumb stays held steady, still pointing up`,
  },
  {
    key: "open-palm-up",
    label: "Open palm up",
    adType: "point-at-text",
    still: (g) =>
      `one hand raised open, palm turned upward and held steady, presenting the empty space above ${g.them}`,
    motion: (g) => `${g.their} open palm stays raised and held steady`,
  },
];

// Loose "like…" fragments on purpose: the category is pinned, the exact
// outfit is the model's to vary — fixed strings were producing the same
// clothes on every take (Adrian, 2026-09-04).
// OUTFIT CATEGORIES (Adrian, 2026-09-08). One entry per category, not one
// per gender: the axis used to carry parallel keys (everyday/everyday-m,
// gym/gym-m) which read as duplicates the moment it became a dropdown.
// Fragments take the pronoun set so a category can differ by gender where
// the garment genuinely does.
//
// Deliberately loose. The old fragments pinned the garment as well as the
// category — "like jeans and a plain t-shirt", "like a sports top and
// leggings" — which is the operator's choice to make, not the prompt's.
// Colour, cut and specifics are left to the model on purpose.
//
// No race-day kit with a bib: a bib is a printed number, and the
// point-at-text framing promises the model there is no writing anywhere in
// the frame. A wardrobe that brings its own text breaks that promise.
export const WARDROBE_OPTIONS: PersonaOption[] = [
  {
    key: "running",
    label: "Running kit",
    sentence: "In running clothes, just back from a run.",
    fragment: "wearing running clothes, just back from a run",
  },
  { key: "everyday", label: "Everyday casual", sentence: "In everyday casual clothes.", fragment: "wearing everyday casual clothes" },
  { key: "gym", label: "Gym clothes", sentence: "In gym clothes at the gym.", fragment: "wearing gym clothes" },
  {
    key: "athleisure",
    label: "Athleisure set",
    sentence: "In a matching athleisure set.",
    fragment: (g) => (g.noun === "man" ? "wearing a matching training set" : "wearing a matching athleisure set"),
  },
  {
    key: "running-jacket",
    label: "Light running jacket",
    sentence: "In a light running jacket.",
    fragment: "wearing a light zip-up running jacket",
  },
  { key: "work", label: "Business casual", sentence: "In business casual, like at the office.", fragment: "wearing business-casual clothes" },
  { key: "cozy", label: "Loungewear", sentence: "In loungewear at home.", fragment: "wearing comfortable loungewear at home" },
  { key: "hoodie", label: "Hoodie or sweatshirt", sentence: "In a plain hoodie.", fragment: "wearing a plain hoodie or sweatshirt" },
  { key: "dress", label: "Casual dress", gender: "female", sentence: "In a casual dress.", fragment: "wearing a casual dress" },
  {
    key: "no-shirt",
    label: "No shirt (men)",
    gender: "male",
    sentence: "No shirt, just finished a run.",
    fragment: "with no shirt on, just finished a run",
  },
];

/** The axes a take deals, in the order they are dealt. */
export type TakeField = "setting" | "wardrobe" | "lighting" | "gesture";
export const TAKE_FIELDS: TakeField[] = ["setting", "wardrobe", "lighting", "gesture"];

/**
 * The axes the direction chips expose. The rest randomize per take — see the
 * module header for why pinning them is a defect, not a feature.
 */
export const PINNABLE_FIELDS = ["adType", "setting", "wardrobe"] as const;

type AnyOption = PersonaOption | GestureOption;

function poolOf(field: TakeField): AnyOption[] {
  switch (field) {
    case "setting":
      return SETTING_OPTIONS;
    case "wardrobe":
      return WARDROBE_OPTIONS;
    case "lighting":
      return LIGHTING_OPTIONS;
    case "gesture":
      return GESTURE_OPTIONS;
  }
}

interface Context {
  gender: Gender;
  adType: string;
}

/** An option is eligible unless one of its tags disagrees with the persona. */
function isEligible(option: AnyOption, { gender, adType }: Context): boolean {
  if ("gender" in option && option.gender && option.gender !== gender) return false;
  if (option.adType && option.adType !== adType) return false;
  return true;
}

export function eligibleOptions(field: TakeField, context: Context): AnyOption[] {
  const all = poolOf(field);
  const options = all.filter((option) => isEligible(option, context));
  // A field with no eligible option would be a matrix bug, not a runtime
  // condition — fall back to the unfiltered list so a prompt still builds.
  return options.length ? options : all;
}

function resolveOption(field: TakeField, key: string | null | undefined, context: Context): AnyOption {
  const options = eligibleOptions(field, context);
  return options.find((option) => option.key === key) || options[0];
}

/** Fragments are strings, or functions of the pronoun set when they must agree. */
function fragmentFor(field: Exclude<TakeField, "gesture">, key: string, context: Context, g: Pronouns): string {
  const option = resolveOption(field, key, context) as PersonaOption;
  return typeof option.fragment === "function" ? option.fragment(g) : option.fragment;
}

function gestureFor(key: string, context: Context): GestureOption {
  return resolveOption("gesture", key, context) as GestureOption;
}

/** True when a field's pool is gated — i.e. eligibility depends on context. */
function isTaggedField(field: TakeField): boolean {
  return poolOf(field).some((option) => ("gender" in option && option.gender) || option.adType);
}

/** A pinned field is the same key every take; everything else gets dealt. */
function dealField(field: TakeField, context: Context, count: number, pin: string | undefined, rng: Rng): string[] {
  const options = eligibleOptions(field, context);
  const pinned = options.find((option) => option.key === pin);
  if (pinned) return Array.from({ length: count }, () => pinned.key);
  return dealDeck(
    options.map((option) => option.key),
    count,
    rng,
  );
}

export function normalizeNotes(raw: unknown): string {
  const notes = typeof raw === "string" ? raw.trim() : "";
  return notes.slice(0, MAX_EXTRA_NOTES_CHARS);
}

/** One take's resolved persona, before it is attached to a cast member. */
export interface ResolvedPersona {
  castId: string | null;
  gender: Gender;
  adType: string;
  setting: string;
  wardrobe: string;
  lighting: string;
  gesture: string;
  extraNotes: string;
}

/** Per-take overrides. A cast member pins that take's gender and no other's. */
export interface PersonaOverrides {
  castId?: string | null;
  gender?: Gender;
  adType?: string;
  setting?: string;
  wardrobe?: string;
  lighting?: string;
  gesture?: string;
  extraNotes?: string;
}

/**
 * Cast a whole batch at once. Distinctness is a property of the batch and
 * cannot be produced one take at a time, which is why this exists alongside
 * assignCast rather than as a per-take roll.
 *
 * `overrides` is one object per take — the caller needs the array form,
 * because a dealt cast member pins that take's gender and no other take's.
 *
 * adType is dealt FIRST because it gates which gestures the rest of the
 * matrix may draw from. When gender or adType differ across the batch, takes
 * are grouped by (gender, adType) so a group's deck only ever holds options
 * that group is eligible for.
 */
export function randomPersonaBatch(overrides: PersonaOverrides[], rng: Rng): ResolvedPersona[] {
  const size = overrides.length;
  if (!size) return [];

  const adTypeKeys = AD_TYPES.map((type) => type.key);
  const dealtAdTypes = dealDeck(adTypeKeys, size, rng);
  const personas = overrides.map((per, i) => ({
    gender: per.gender === "male" ? ("male" as const) : ("female" as const),
    adType: per.adType && adTypeKeys.includes(per.adType) ? per.adType : dealtAdTypes[i],
  }));

  const groups = new Map<string, number[]>();
  personas.forEach((persona, i) => {
    const id = `${persona.gender}|${persona.adType}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(i);
  });

  const resolved: Partial<Record<TakeField, string>>[] = personas.map(() => ({}));
  for (const field of TAKE_FIELDS) {
    // An untagged axis is eligible for every take, so it gets ONE deck across
    // the whole batch — the widest possible spread. Splitting it per group
    // would deal two independent decks and let a value land twice for no
    // reason.
    const indexGroups = isTaggedField(field) ? [...groups.values()] : [personas.map((_, i) => i)];
    for (const indexes of indexGroups) {
      const context = personas[indexes[0]];
      const dealt = dealField(field, context, indexes.length, overrides[indexes[0]][field], rng);
      indexes.forEach((takeIndex, slot) => {
        // Resolve the pin PER TAKE, not per group. dealField only sees the
        // group's first take, which was harmless while castId and gender were
        // the only per-take overrides — but a per-take wardrobe pin would
        // otherwise be overwritten by whatever the first take in its group
        // pinned. A pin the take is not eligible for (no shirt on a woman)
        // falls back to the dealt value rather than breaking the prompt.
        const pin = overrides[takeIndex][field];
        const pinned = eligibleOptions(field, personas[takeIndex]).find((option) => option.key === pin);
        resolved[takeIndex][field] = pinned ? pinned.key : dealt[slot];
      });
    }
  }

  return personas.map((persona, i) => ({
    // A doc reference, not an enum, so it is not a matrix axis. The caller
    // deals it from the chosen cast — see assignCast.
    castId: typeof overrides[i].castId === "string" && overrides[i].castId ? overrides[i].castId! : null,
    gender: persona.gender,
    adType: persona.adType,
    setting: resolved[i].setting!,
    wardrobe: resolved[i].wardrobe!,
    lighting: resolved[i].lighting!,
    gesture: resolved[i].gesture!,
    extraNotes: normalizeNotes(overrides[i].extraNotes),
  }));
}

/**
 * Deal cast members across a batch so N takes are N DIFFERENT people wherever
 * the selection allows it. Random assignment collides — with 8 ready faces
 * and 6 takes, plain sampling repeats someone roughly two thirds of the time,
 * which is the exact complaint the cast bank exists to answer. So: shuffle
 * once, then deal, wrapping only when the batch is larger than the bank.
 *
 * That is exactly the rule the studio promises: every selected face gets at
 * least one take, and a single selection with four takes gets four takes of
 * that one person.
 */
export function assignCast<T>(count: number, pool: readonly T[], rng: Rng): T[] {
  if (!pool.length) return [];
  const shuffled = shuffle(pool.slice(), rng);
  return Array.from({ length: count }, (_, i) => shuffled[i % shuffled.length]);
}

/**
 * The first frame: pose already landed, face relaxed, framed like a real
 * front-camera selfie. The real pipeline appended a photoreal/9:16/no-text
 * style line at generation time, so this prompt carries the subject plus the
 * doctrine.
 *
 * The take always has a CAST MEMBER, so the identity half of the subject
 * clause is dropped entirely: look, age, hair and complexion all come from
 * the attached reference face, and repeating them in words fights it — the
 * model would split the difference between the photo and the adjectives,
 * which is how you get a different person wearing the same description.
 * Wardrobe, setting and lighting stay, because those are the take's and the
 * reference must NOT supply them.
 */
export function buildStillPromptFor(persona: ResolvedPersona): string {
  const g = pronounsFor(persona.gender);
  const type = adTypeFor(persona.adType);
  const gesture = gestureFor(persona.gesture, persona);
  const parts = [
    "Candid selfie photo taken on a front-facing phone camera held at arm's length by the person in the attached reference photo,",
    `${fragmentFor("wardrobe", persona.wardrobe, persona, g)},`,
    `${fragmentFor("setting", persona.setting, persona, g)},`,
    `${fragmentFor("lighting", persona.lighting, persona, g)}.`,
    type.beat(g, gesture),
    type.framing,
    buildStillDoctrine(g),
  ];
  if (persona.extraNotes) parts.push(persona.extraNotes);
  return parts.join(" ");
}

/**
 * The motion direction: near-stillness on a held pose, no speech. The hard
 * no-speech enforcement (an audio directive + negative prompt) was appended
 * by the video call in the real pipeline — this prompt must never contradict
 * it, so no dialogue, no mouthed words.
 */
export function buildMotionPromptFor(persona: ResolvedPersona): string {
  const g = pronounsFor(persona.gender);
  const type = adTypeFor(persona.adType);
  const gesture = gestureFor(persona.gesture, persona);
  return [type.motionBeat(g, gesture), buildMotionDoctrine(g)].join(" ");
}
