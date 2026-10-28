/**
 * TYPED CASTING — a second, parallel way to fill the cast bank.
 *
 * The general path (cast.ts) casts a random American: a dealt name, a dealt
 * bone structure, a dealt colouring, and a casting bar that asks for one of
 * the best-looking people in the room. Adrian's judgement on 2026-09-08 is
 * that it reads as "completely random people", which is exactly what it is
 * for, so IT IS NOT TOUCHED BY THIS FILE and must not be.
 *
 * A TYPE is the other job: cast eight of ONE KIND of person on purpose —
 * eight marathon chasers, eight lifters who just discovered cardio — because
 * the ad is aimed at an audience that responds to that archetype. Selecting a
 * type replaces the build brief, the styling line and the casting bar, and
 * narrows the axis pools to the ones that belong to the archetype. What it
 * does NOT replace is the per-member variation machinery: name, bone
 * structure, hair colour, eye colour and distinguishing mark are still dealt
 * from decks, so eight marathon chasers are eight different women rather than
 * one woman eight times.
 *
 * WHY A SEPARATE MODULE, and not a `type` field on the general recipe:
 * folding the general path in as "one of the types" would put five rounds of
 * hard-won prompt tuning at risk for no gain, and there is no cheap way to
 * prove a refactor did not move it — the only verifier is real image-model
 * spend and a human eye. So the general recipe keeps its own module and its
 * own code path, dealCast branches once at the top, and engine.test.ts
 * asserts an untyped member still produces the general prompt.
 *
 * The portrait mechanics below are DELIBERATELY duplicated from cast.ts
 * rather than imported. That is the price of the isolation above, and it is
 * the right way round: a future edit to the general doctrine should not
 * silently change what a marathon chaser looks like.
 */

import type { Gender } from "../contracts";
import { AMERICAN_NAMES, CAST_OPTIONS, dealNames, groupByGender, type CastField, type CastOption } from "./cast";
import { pronounsFor, type Pronouns } from "./reaction";
import { dealDeck, type Rng } from "./rng";

/**
 * Portrait mechanics every type shares: what makes the image a usable face
 * reference at all. Same reasoning as the general path — the take generates
 * with a "face" reference mode and supplies its own room, camera and light,
 * so this only owes us a clean, well-lit, un-plastic face.
 */
const DEFAULT_SKIN = "Natural skin with real texture, never airbrushed, never plastic, never smoothed.";

function sharedPortrait(type: CastTypeDef | null): string {
  return [
    "Clean, well-composed head-and-shoulders portrait against an uncluttered indoor background, nothing else in the frame.",
    "Relaxed natural expression, looking straight into the lens.",
    "Soft flattering directional daylight that models the face and gives the bone structure real shape:",
    "never flat frontal light, never hard overhead light.",
    type?.skin || DEFAULT_SKIN,
    "This person lives in the United States: contemporary American grooming, haircut and teeth.",
  ].join(" ");
}

export const SHARED_PORTRAIT = sharedPortrait(null);

/** Feature axes a type may own. `miles` is the marathon chaser's alone. */
export type FeatureField = "faceShape" | "eyeShape" | "nose" | "mouth" | "miles" | "mark" | "beauty" | "ageBand";
export type TypeField = CastField | FeatureField;

/** Text that may need to agree with the member's gender (a mixed-gender type). */
type TypeText = string | ((g: Pronouns) => string);

export interface CastTypeDef {
  key: string;
  label: string;
  plural: string;
  /** Locked gender, or null for an archetype that casts both. */
  gender: Gender | null;
  blurb: string;
  build: TypeText;
  physique?: string;
  styling: TypeText;
  bar: TypeText;
  features?: Partial<Record<FeatureField, CastOption[]>>;
  names?: Partial<Record<Gender, string[]>>;
  skin?: string;
  restrict?: Partial<Record<CastField, string[]>>;
  closing?: (manner: string, g: Pronouns) => string;
}

function textFor(text: TypeText, g: Pronouns): string {
  return typeof text === "function" ? text(g) : text;
}

/**
 * Where a type's options for one axis come from. A type-owned pool wins
 * outright; otherwise the shared pool, narrowed by `restrict`. Types without
 * `features` (the gym crossover) keep exactly the behaviour the unfeatured
 * shape always had.
 */
export function poolFor(field: TypeField, type: CastTypeDef, gender: Gender): CastOption[] {
  const owned = type.features?.[field as FeatureField];
  if (owned) return owned;
  const shared = CAST_OPTIONS[field as CastField] || [];
  const options = shared.filter((option) => !option.gender || option.gender === gender);
  const allow = type.restrict?.[field as CastField];
  if (!allow || !allow.length) return options;
  const narrowed = options.filter((option) => allow.includes(option.key));
  return narrowed.length ? narrowed : options;
}

/**
 * Which axes a type deals. A featured type deals whatever pools it owns plus
 * the shared ones it did not override — so a type can introduce an axis
 * nothing else has (the marathon chaser's `miles`) without touching this
 * function.
 */
const SHARED_FIELDS: TypeField[] = ["ageBand", "hair", "hairColor", "eyes", "beauty"];
const GENERAL_FACE_FIELDS: TypeField[] = ["face", "mark"];
/** Render order for the facial clause; a type omitting one just skips it. */
export const FACE_ORDER: FeatureField[] = ["faceShape", "eyeShape", "nose", "mouth", "miles", "mark"];

export function fieldsFor(type: CastTypeDef): TypeField[] {
  if (!type.features) return [...SHARED_FIELDS, ...GENERAL_FACE_FIELDS];
  return [...new Set<TypeField>([...SHARED_FIELDS, ...(Object.keys(type.features) as FeatureField[])])];
}

/**
 * TYPE-OWNED FEATURE POOLS (2026-09-08, after the first typed bank).
 *
 * The first version of a type only swapped the build, the styling and the
 * casting bar, and drew its FACE from the general pools. Measured: 45% of the
 * typed prompt was the general prompt verbatim, and the one sentence that
 * actually describes a face was generic — an aspirational archetype could be
 * dealt a broad open face with a small neat nose, a strong defined brow,
 * freckles, a chin cleft or a widow's peak. Those pools were built to make
 * ORDINARY people differ from each other, which is the opposite job.
 *
 * So a type may bring its own pools. Every option below is an attractiveness
 * marker in its own right, and they are mutually distinct, which is the only
 * way to be both good-looking and varied: the variation lives in WHICH
 * flattering feature set you get, not in whether you get one.
 *
 * Note the axes are finer-grained than the general matrix. Eye SHAPE was
 * entangled inside the general `face` fragments ("a long narrow face and
 * striking deep-set eyes") and mouth had no axis at all — it existed only as
 * one of eleven `mark` options. Geometry, eyes, nose and mouth are separate
 * here because they are separately castable.
 */
const MARATHON_FEATURES: Partial<Record<FeatureField, CastOption[]>> = {
  faceShape: [
    { key: "heart", label: "Heart", fragment: "a heart-shaped face with high cheekbones and a tapered chin" },
    { key: "oval", label: "Classic oval", fragment: "a classic oval face with balanced proportions and a softly defined jawline" },
    { key: "diamond", label: "Diamond", fragment: "a diamond face with wide sculpted cheekbones, a narrow forehead and a pointed chin" },
    { key: "soft-square", label: "Soft square", fragment: "a soft square face with a clean feminine jawline and full cheeks" },
    { key: "long-elegant", label: "Long & elegant", fragment: "a long elegant face with high flat cheekbones and a compact midface" },
    { key: "round-youthful", label: "Round & youthful", fragment: "a round youthful face with full apple cheeks and a small chin" },
    { key: "sculpted", label: "Sculpted", fragment: "sharply sculpted cheekbones with soft hollows beneath them and a defined jaw" },
    { key: "delicate", label: "Delicate", fragment: "a small delicate face with a wide upper third and a narrow chin" },
  ],
  eyeShape: [
    { key: "almond-tilt", label: "Almond, upturned", fragment: "large almond eyes with a slight upward outer tilt" },
    { key: "doe", label: "Doe", fragment: "big round doe eyes set a little wide apart" },
    { key: "cat", label: "Cat", fragment: "long upturned cat-like eyes with sharp outer corners" },
    { key: "hooded", label: "Hooded", fragment: "hooded eyes with heavy lids under a low brow" },
    { key: "wide-lid", label: "Wide lid space", fragment: "wide-set almond eyes with generous lid space" },
    { key: "deep-set", label: "Deep-set", fragment: "deep-set eyes beneath a defined brow bone" },
    { key: "soft-down", label: "Softly downturned", fragment: "softly downturned eyes that read open and gentle" },
    { key: "fox", label: "Long & tilted", fragment: "long narrow eyes with a pronounced upward tilt" },
  ],
  nose: [
    { key: "small-straight", label: "Small & straight", fragment: "a small straight nose with a refined tip" },
    { key: "button", label: "Button", fragment: "a petite button nose with a slight upturn" },
    { key: "narrow-defined", label: "Narrow & defined", fragment: "a narrow nose with a clean dorsal line and a defined tip" },
    { key: "gentle-slope", label: "Gentle slope", fragment: "a slim nose with a gentle slope and a soft rounded tip" },
    { key: "high-bridge", label: "High bridge", fragment: "a straight nose with a subtle high bridge" },
    { key: "short-upturned", label: "Short & upturned", fragment: "a short delicately upturned nose" },
    { key: "tapered", label: "Slim & tapered", fragment: "a slim tapered nose with a narrow bridge" },
  ],
  mouth: [
    { key: "bow", label: "Defined cupid's bow", fragment: "full lips with a sharply defined cupid's bow" },
    { key: "wide-full", label: "Wide & full", fragment: "a wide full mouth with naturally upturned corners" },
    { key: "heavy-lower", label: "Fuller lower lip", fragment: "a fuller lower lip under a soft upper lip" },
    { key: "heart", label: "Heart-shaped", fragment: "a small heart-shaped mouth with a pronounced bow" },
    { key: "balanced", label: "Evenly full", fragment: "evenly full lips with a smooth natural border" },
    { key: "soft-wide", label: "Soft & wide", fragment: "a soft wide mouth that sits relaxed and slightly open" },
    { key: "pillowy", label: "Pillowy", fragment: "pillowy lips beneath a short philtrum" },
  ],
  mark: [
    { key: "lip-mole", label: "Beauty mark", fragment: "a single beauty mark just above the lip" },
    { key: "freckle-dust", label: "Light freckles", fragment: "a light dusting of freckles across the nose" },
    { key: "lashes", label: "Long lashes", fragment: "unusually long dark lashes" },
    { key: "brows", label: "Arched brows", fragment: "thick, well-shaped, naturally arched brows" },
    { key: "cheek-hollow", label: "Cheek hollows", fragment: "a subtle hollow beneath each cheekbone" },
    { key: "dimples", label: "Dimples", fragment: "dimples that show even at rest" },
    { key: "jawline", label: "Clean jawline", fragment: "a visibly clean, sharply defined jawline" },
    { key: "cheek-edge", label: "High cheekbone edge", fragment: "high, sharply defined cheekbone edges" },
  ],
  // The trait no other type has: what years of distance running do to a
  // face. It varies rather than being constant so a batch does not come back
  // as eight versions of one point in a training cycle.
  miles: [
    { key: "base", label: "Base building", fragment: "a fresh, lightly sun-kissed face early in a training block" },
    { key: "deep-block", label: "Deep in a block", fragment: "cheekbones sharpened by the leanness of a deep training block" },
    { key: "outdoor", label: "Outdoor miles", fragment: "a healthy outdoor tan with faint squint lines from running into the sun" },
    { key: "taper", label: "Race week", fragment: "the clear, rested glow of race week" },
  ],
};

/**
 * WEEKEND RUNNER — the trust archetype (adapted from the real lane's trust
 * type, Adrian, 2026-09-08).
 *
 * The other two types optimise for ATTENTION from a stranger. This one does
 * not, and getting that wrong is how it would fail: the brief is less "I want
 * to be like them" and more "I trust this person, and I bet this app is how
 * they keep their running routine". The competent friend whose plan you would
 * copy, not someone you want to be and not exactly you.
 *
 * That inverts most of the axes. The casting bar is credibility, not beauty —
 * "one of the best-looking people in the room" is actively wrong here. The
 * closing line is about how they READ rather than how good-looking they are,
 * which is why this type overrides it. And they are not tired or struggling:
 * tired reads as someone who has not figured it out, which is the opposite of
 * the trust this type is cast for.
 *
 * It is the one MIXED type, so every pool it owns is gender-neutral and every
 * line that names the person resolves through the pronoun set.
 */
const WEEKEND_FEATURES: Partial<Record<FeatureField, CastOption[]>> = {
  faceShape: [
    { key: "soft-oval", label: "Soft oval", fragment: "a soft oval face with gentle cheekbones" },
    { key: "round-full", label: "Round", fragment: "a round face with full cheeks and a soft jawline" },
    { key: "heart", label: "Heart", fragment: "a heart-shaped face with a warm open forehead" },
    { key: "square-steady", label: "Square", fragment: "a square face with a steady, grounded jaw" },
    { key: "long-fine", label: "Long", fragment: "a long face with fine features and a narrow chin" },
    { key: "broad-open", label: "Broad & open", fragment: "a broad open face with wide-set features" },
    { key: "soft-angular", label: "Softly angular", fragment: "softly angular cheekbones, defined but not sharp" },
  ],
  eyeShape: [
    { key: "crinkled", label: "Warm, crinkled", fragment: "warm eyes that crinkle at the outer corners" },
    { key: "steady-almond", label: "Calm almond", fragment: "calm steady almond eyes" },
    { key: "round-open", label: "Round & open", fragment: "round open eyes with a direct gaze" },
    { key: "relaxed-hooded", label: "Relaxed hooded", fragment: "relaxed, lightly hooded eyes" },
    { key: "wide-direct", label: "Wide-set & direct", fragment: "wide-set eyes that meet the lens squarely" },
    { key: "deep-attentive", label: "Deep-set & attentive", fragment: "deep-set attentive eyes" },
  ],
  nose: [
    { key: "straight-plain", label: "Straight", fragment: "a straight, unremarkable nose" },
    { key: "small-round", label: "Small, rounded tip", fragment: "a small nose with a rounded tip" },
    { key: "soft-bridge", label: "Soft bridge", fragment: "a slightly wide nose with a soft bridge" },
    { key: "small-bump", label: "Slight bump", fragment: "a straight nose with a small bump on the bridge" },
    { key: "narrow-even", label: "Narrow & even", fragment: "a narrow, evenly proportioned nose" },
  ],
  mouth: [
    { key: "easy-smile", label: "Easy closed smile", fragment: "an easy closed-mouth smile" },
    { key: "relaxed-even", label: "Relaxed & even", fragment: "relaxed, evenly proportioned lips" },
    { key: "thin-upper", label: "Thinner upper lip", fragment: "a slightly thinner upper lip over a fuller lower one" },
    { key: "full-soft", label: "Full & soft", fragment: "a full soft mouth at rest" },
    { key: "wide-lines", label: "Wide, faint lines", fragment: "a wide mouth with faint smile lines at the corners" },
  ],
  // Credibility markers, not glam ones. Every option is something a real
  // 33-year-old has and a stock model does not.
  mark: [
    { key: "eye-lines", label: "Smile lines", fragment: "faint smile lines at the eyes" },
    { key: "sun-freckles", label: "Sun freckles", fragment: "a few freckles and sun marks across the cheeks" },
    { key: "laugh-lines", label: "Laugh lines", fragment: "soft laugh lines around the mouth" },
    { key: "jaw-mole", label: "Small mole", fragment: "a small mole near the jaw" },
    { key: "greys", label: "A few greys", fragment: "a few grey hairs coming through at the temple" },
    { key: "uneven-tone", label: "Uneven tone", fragment: "slightly uneven skin tone across the cheeks" },
    { key: "glasses-up", label: "Glasses up", fragment: (p) => `sunglasses pushed up onto the top of ${p} head` },
  ],
  // Replaces the beauty register. How they READ, not how good-looking they are.
  beauty: [
    { key: "trustworthy", label: "Warm & trustworthy", fragment: "warm and completely trustworthy" },
    { key: "competent", label: "Quietly competent", fragment: "calm and quietly competent" },
    { key: "no-nonsense", label: "No-nonsense", fragment: "straightforward and no-nonsense" },
    { key: "organised", label: "On top of things", fragment: (p) => `organised and on top of ${p} training` },
    { key: "easy", label: "Easy to talk to", fragment: "friendly and easy to talk to" },
    { key: "grounded", label: "Grounded", fragment: "grounded and reassuring" },
  ],
};

/**
 * Their own name pools. The shared list is a late-nineties birth cohort —
 * Madison, Brianna, Destiny, Chloe, Aaliyah — and an American runner in
 * their mid-30s is more likely to be Jessica, Amanda, Matt or Chris. Name
 * seeding has moved output every time it has been used, so a cohort-wrong
 * name is a lever pointed the wrong way.
 */
const WEEKEND_NAMES: Record<Gender, string[]> = {
  female: [
    "Jessica Walsh", "Amanda Reyes", "Sarah Kowalski", "Brittany Okonkwo",
    "Nicole Brennan", "Megan Doyle", "Stephanie Nguyen", "Lauren Hartman",
    "Kristen Boone", "Danielle Park", "Rachel Whitfield", "Kelsey Sullivan",
    "Monica Delgado", "Andrea Santos", "Tiffany Grant", "Christina Haddad",
    "Erica Coleman", "Vanessa Cruz", "Priya Menon", "Latoya Freeman",
  ],
  male: [
    "Matt Hoffman", "Chris Doyle", "Josh Walsh", "Mike Reyes",
    "Brian Kowalski", "Kyle Brennan", "Justin Park", "Derek Coleman",
    "Ryan Nguyen", "Adam Whitfield", "Eric Santos", "Jason Grant",
    "Greg Lindqvist", "Anthony Cruz", "Marcus Hartman", "Sean Sullivan",
    "Dev Menon", "Jamal Freeman", "Carlos Delgado", "Sam Haddad",
  ],
};

/**
 * The types.
 *
 * `gender` is LOCKED per type where the archetype is a gendered casting
 * brief, and the UI reads it and disables its gender control. `null` is the
 * one exception: the weekend runner casts both, and the gender is dealt per
 * member like any other axis unless the caller pins it.
 *
 * `restrict` narrows a shared axis. Everything left unrestricted keeps its
 * full pool, which is what stops eight of one type from being one face —
 * bone structure, hair colour, eye colour and mark all still deal freely
 * unless the archetype genuinely constrains them.
 */
export const CAST_TYPE_DEFS: CastTypeDef[] = [
  {
    key: "weekend-runner",
    label: "Weekend runner",
    plural: "weekend runners",
    gender: null,
    blurb: "The trust archetype: the friend who runs on Saturdays and whose plan you would copy.",
    build: (g) => `healthy, ordinary-bodied ${g.noun} who runs a few mornings a week`,
    features: WEEKEND_FEATURES,
    names: WEEKEND_NAMES,
    styling: (g) =>
      // Deliberately not prescribing a hairstyle: the hair axis already deals
      // one, and naming a claw clip here contradicted a dealt pixie cut.
      `Low-effort but put-together: hair done quickly rather than styled, ${g.noun === "man" ? "everyday grooming" : "minimal or no makeup"}, a plain everyday top.`,
    // Positively phrased on purpose. An earlier version of the general prompt
    // said "NOT a model and NOT a stock photo" and it read as an instruction
    // to cast someone unattractive. The not-glamorous constraint lives in the
    // styling line above, where it belongs; the bar itself says what they ARE.
    bar: (g) =>
      [
        `Casting standard: ${g.they} looks like someone you would actually see at a Saturday-morning group run, and like someone who has ${g.their} routine handled.`,
        `Ordinary-attractive in the way real people are: clear alert eyes, healthy skin ${g.they} looks after, and a face you would trust.`,
      ].join(" "),
    // Composed, never tired or struggling. Tired reads as someone who has not
    // figured it out, which is the opposite of what this type sells.
    skin: "Real skin with natural texture and visible pores, healthy and looked-after, never airbrushed and never plastic.",
    // Late 20s to mid 30s: old enough to have a routine worth copying, still
    // inside principle 4's 20s-30s casting.
    restrict: {
      ageBand: ["late-20s", "early-30s", "mid-30s"],
    },
    closing: (manner, g) => `${g.They} reads as ${manner}.`,
  },
  {
    key: "gym-crossover",
    label: "Gym crossover",
    plural: "gym crossovers",
    gender: "male",
    blurb: "Aspirational male casting: a visibly strong lifter who has just taken up running.",
    build: "heavily muscular, lean, visibly gym-trained man who has recently taken up running",
    // Emitted AFTER the age band: "a gym-trained man with broad shoulders and
    // a thick neck in his early 20s" puts the age on the neck.
    physique: "broad shoulders and a thick neck",
    styling:
      "Sharp modern haircut, groomed stubble or clean-shaven, well-kept brows. Visibly maintained, never fussy or styled.",
    bar: [
      "Casting standard: this is the most physically impressive man in the room, the kind of look people screenshot as a goal.",
      "Symmetrical, well-proportioned features, clear skin, straight white teeth and full thick hair.",
    ].join(" "),
    // The archetype IS the bone structure, so this is the one type that
    // narrows the face axis. The bar deliberately stays structure-free even
    // here — naming a jaw in a sentence every member receives identically is
    // what collapsed the axis the first time.
    restrict: {
      ageBand: ["early-20s", "mid-20s", "late-20s", "early-30s"],
      face: ["square-jaw", "angular", "strong-brow", "high-cheekbones", "long-narrow"],
      hair: ["short-crop", "buzz", "textured", "short-curls", "stubble"],
      beauty: ["editorial", "bold", "classic", "refined", "athletic"],
    },
  },
  {
    key: "marathon-chaser",
    label: "Marathon chaser",
    plural: "marathon chasers",
    gender: "female",
    blurb: "Aspirational endurance casting: lean, sun-kissed, chasing a marathon PR.",
    build: "lean, fit, distance-running woman with an endurance athlete's build",
    styling:
      "Low-maintenance runner styling: light everyday makeup at most, groomed brows, a simple athletic top. Put-together, never an editorial fashion shoot.",
    bar: [
      "Casting standard: this is the woman everyone at the running club notices, the kind of face that stops a scroll.",
      "Symmetrical, well-proportioned features, clear skin with a healthy outdoor glow, bright eyes, straight white teeth and thick healthy hair.",
    ].join(" "),
    features: MARATHON_FEATURES,
    // The shared skin line ("real texture ... never smoothed") is right for
    // this type too, but it has to agree with the bar's outdoor glow or the
    // prompt argues with itself. Anti-AI still holds via "never plastic".
    skin: "Real skin with natural texture and a healthy outdoor glow, never plastic, never 3D-rendered.",
    // Young, and no pixie styling — the archetype is specific.
    restrict: {
      ageBand: ["early-20s", "mid-20s", "late-20s", "early-30s"],
      hair: ["long-loose", "shoulder-lob", "wavy-mid", "tight-curls", "messy-bun", "ponytail", "braids"],
      beauty: ["athletic", "editorial", "classic", "bold", "delicate"],
    },
  },
];

export function typeFor(key: string | null | undefined): CastTypeDef | null {
  return CAST_TYPE_DEFS.find((type) => type.key === key) || null;
}

const POSSESSIVE: Record<Gender, string> = { female: "her", male: "his" };
const BEAUTY_NOUN: Record<Gender, string> = { female: "beautiful", male: "handsome" };

function fragmentFor(field: TypeField, key: string, type: CastTypeDef, gender: Gender): string {
  const options = poolFor(field, type, gender);
  const option = options.find((o) => o.key === key) || options[0];
  if (!option) return "";
  return typeof option.fragment === "function" ? option.fragment(POSSESSIVE[gender]) : option.fragment;
}

export function typedLabelFor(field: TypeField, key: string, type: CastTypeDef, gender: Gender): string {
  const options = poolFor(field, type, gender);
  return (options.find((o) => o.key === key) || options[0])?.label || key;
}

/** "hazel eyes" -> "hazel". The shared colour fragments carry the noun, and
 *  the featured clause supplies its own ("hazel wide-set almond eyes"). */
function colourWord(fragment: string): string {
  return fragment.replace(/\s*eyes$/i, "");
}

function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export interface TypedPersona {
  gender: Gender;
  mode: "type";
  type: string;
  name: string;
  fields: Partial<Record<TypeField, string>>;
}

/**
 * Cast a batch of ONE type. Same dealing rules as the general path — names
 * come from the type's pool with everyone already in the bank removed, and
 * every axis is exhausted before it repeats — so eight of a type are eight
 * different people inside that type.
 *
 * A mixed type deals the gender first (from a two-card deck, so a batch of
 * eight is four and four), then deals each gender's people from that
 * gender's pools.
 */
export function typedCastBatch(
  typeKey: string,
  count: number,
  { rng, gender, taken = [] }: { rng: Rng; gender?: Gender; taken?: readonly string[] },
): TypedPersona[] {
  const type = typeFor(typeKey);
  if (!type) return [];
  const size = Math.max(0, Math.floor(count) || 0);
  if (!size) return [];

  const genders: Gender[] = type.gender
    ? Array.from({ length: size }, () => type.gender as Gender)
    : gender
      ? Array.from({ length: size }, () => gender)
      : dealDeck<Gender>(["female", "male"], size, rng);

  const groups = groupByGender(genders);
  const names: string[] = new Array(size);
  for (const [g, indexes] of groups) {
    const pool = type.names?.[g] || AMERICAN_NAMES[g];
    dealNames(pool, indexes.length, taken, rng).forEach((name, slot) => {
      names[indexes[slot]] = name;
    });
  }

  // Same rule as the general path: an axis whose pool does not depend on
  // gender gets ONE deck across the whole batch, so a mixed batch still
  // spreads it fully; a gendered axis (hair) is dealt per gender.
  const fields: Partial<Record<TypeField, string>>[] = genders.map(() => ({}));
  for (const field of fieldsFor(type)) {
    const female = poolFor(field, type, "female").map((o) => o.key).join("|");
    const male = poolFor(field, type, "male").map((o) => o.key).join("|");
    const indexGroups: [Gender, number[]][] =
      female === male ? [[genders[0], genders.map((_, i) => i)]] : [...groups];
    for (const [g, indexes] of indexGroups) {
      const dealt = dealDeck(
        poolFor(field, type, g).map((option) => option.key),
        indexes.length,
        rng,
      );
      indexes.forEach((index, slot) => {
        fields[index][field] = dealt[slot];
      });
    }
  }

  return genders.map((g, i) => ({ gender: g, mode: "type", type: type.key, name: names[i], fields: fields[i] }));
}

/** The portrait prompt for one typed cast member. */
export function buildTypedCastPrompt(persona: TypedPersona): string {
  const type = typeFor(persona.type);
  if (!type) return "";
  const gender = persona.gender;
  const g = pronounsFor(gender);
  const f = (field: TypeField) => fragmentFor(field, persona.fields[field] || "", type, gender);
  // A featured type puts EVERY facial trait in its own clause, all of them
  // concrete nouns, because that is the only content the model has been shown
  // to act on. An unfeatured type keeps the original single-clause shape.
  let face: string[];
  if (type.features) {
    const owned = FACE_ORDER.filter((field) => type.features![field]);
    const clauses = owned.map((field) =>
      field === "eyeShape" ? `${colourWord(f("eyes"))} ${f("eyeShape")}` : f(field),
    );
    const last = clauses.pop();
    face = [...clauses.map((clause) => `${clause},`), `and ${last}.`];
  } else {
    face = [
      `with ${f("face")},`,
      `${f("hair")}, ${f("hairColor")},`,
      `${f("eyes")},`,
      `and ${f("mark")}.`,
    ];
  }
  const hair = type.features ? [capitalize(`${f("hair")}, ${f("hairColor")}.`)] : [];
  return [
    `Portrait photo of ${persona.name}, a ${textFor(type.build, g)}`,
    `${f("ageBand")},`,
    ...(type.physique ? [`${type.physique},`] : []),
    ...(type.features ? ["with"] : []),
    ...face,
    ...hair,
    sharedPortrait(type),
    textFor(type.styling, g),
    textFor(type.bar, g),
    // Last, so the closing instruction is about the PERSON rather than a rule
    // about the photograph. A type whose goal is trust rather than attention
    // overrides it — "exceptionally beautiful" is the wrong closing line for
    // someone cast to be believed.
    type.closing ? type.closing(f("beauty"), g) : `Exceptionally ${BEAUTY_NOUN[gender]} ${f("beauty")}.`,
  ].join(" ");
}
