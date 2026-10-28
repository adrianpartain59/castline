/**
 * The UGC Lab CAST BANK — a reviewed set of faces that takes are generated
 * against, instead of describing a person from scratch every time.
 *
 * WHY THIS EXISTS (Adrian, 2026-09-05: "the still images are very often of
 * similar-looking people"). The persona matrix had no facial axis at all.
 * Every one of its eight `look` options resolved to "<synonym for fit> person
 * with an <synonym for ordinary> face", and nothing anywhere named a jaw, a
 * nose, eyes or cheekbones — so hair and skin tone changed the surface while
 * the model reused its own default face underneath. Widening those axes treats
 * the symptom; the 2026-09-04 doctrine had already caught this failure once
 * ("one template phrasing converged on one face").
 *
 * THE FIX IS STRUCTURAL: identity moves up a level. The identity axes stop
 * describing a TAKE and start describing a CAST MEMBER, generated once and
 * reviewed by a human. A take then attaches that face as a reference image and
 * varies only what should vary — wardrobe, setting, lighting, gesture, ad
 * type. Variety stops being probabilistic (hope the model draws a new face)
 * and becomes guaranteed (this take IS cast member 7).
 *
 * The bonus is the thing real UGC has and generated UGC does not: one person
 * can recur across a week of ads, the way a creator would.
 *
 * DELIBERATELY a plain, boring portrait. The reference carries identity and
 * nothing else — a busy or styled reference bleeds its setting and polish into
 * every take that uses it, which would fight doctrine principle 2 (amateur
 * imperfection over polish). So the portrait is directed as an ordinary photo
 * against an uncluttered background, and the take supplies the room.
 */

import type { Gender } from "../contracts";
import { dealDeck, type Rng } from "./rng";

export const MAX_CAST_PER_BATCH = 8;

/**
 * The build brief, per gender. This is the part Adrian pins and the part that
 * must NOT vary: every cast member is fit and in shape. Everything else about
 * them is a variation axis.
 */
export const BUILD: Record<Gender, string> = {
  female: "fit, healthy, in-shape woman",
  male: "muscular, fit, in-shape man with an athletic build",
};

/**
 * "Attractive" is an evaluative judgement and image models weight it far below
 * concrete nouns — four prompt rewrites in one day moved nothing, while adding
 * bone structure and hair colour moved output immediately. So the bar is now
 * carried by a NOUN the model has a sharp prior for, per gender.
 */
export const BEAUTY_NOUN: Record<Gender, string> = { female: "beautiful", male: "handsome" };

/**
 * Doctrine for the portrait itself. Shorter than the take doctrine on purpose:
 * this image is never published, it only has to carry a face the take can
 * copy. Polish here propagates, so the SETTING stays plain — but the LIGHT
 * does not, and that distinction is the 2026-09-08 correction.
 *
 * The first bank cast good-looking-but-identical people as unattractive-and-
 * varied, because every axis added to fix sameness was an ugliness axis and
 * the portrait light was flat. Flat frontal light is the single most
 * unflattering way to photograph a face: it erases the shadow structure that
 * makes bone structure read, and then that light propagates into every take.
 * Soft directional daylight is just as ordinary and just as un-editorial, and
 * it MODELS the face instead of flattening it.
 *
 * Real untouched skin texture stays — that is the anti-AI signal that costs
 * nothing. "Not a model" is gone: it was a direct instruction to cast
 * unattractive people, and Adrian's 2026-09-08 call is conventionally
 * attractive.
 */
export const CAST_DOCTRINE = [
  // WHAT THIS PORTRAIT IS FOR, restated 2026-09-08 after 22 of 28 members on
  // the previous prompt were retired. It is a REFERENCE, never published. The
  // take generates with a "face" reference mode — copy the person, ignore the
  // reference's wardrobe, room and lighting — so every plainness instruction
  // here was being spent on pixels the take throws away, while costing the
  // attractiveness the bank exists to supply. Five of nine sentences pulled
  // toward plain against two toward beauty, and plain won on volume.
  //
  // CUT, and why each was safe to cut: "taken on a phone" and "blank indoor
  // wall" (the take supplies camera and room); "mouth closed" (a passport
  // instruction); "visible pores, unretouched and unsmoothed" (the take's own
  // doctrine still demands real skin texture on the published frame, and this
  // wording asked for a pore close-up); "photographed in an ordinary American
  // home" (the take supplies the room); "never as a render or a stock model"
  // ("stock model" is a direct instruction to cast someone less attractive).
  //
  // KEPT: the framing this has to carry to be a usable face reference, the
  // flattering light, real-not-plastic skin so the reference does not
  // propagate an airbrushed face, and the American grooming brief.
  "Clean, well-composed head-and-shoulders portrait against an uncluttered indoor background, nothing else in the frame.",
  "Relaxed natural expression, looking straight into the lens.",
  "Soft flattering directional daylight that models the face and gives the bone structure real shape:",
  "never flat frontal light, never hard overhead light.",
  "Natural skin with real texture, never airbrushed, never plastic, never smoothed.",
  "Everyday hair and makeup rather than a styled fashion shoot.",
  "This person lives in the United States: contemporary American grooming, haircut and teeth.",
  // The casting bar, twice over, because saying it once as an adjective did
  // not work. First a CLASS the model has a sharp visual prior for — the same
  // mechanism that makes a name work — then the FEATURES that constitute the
  // judgement, as nouns. Both are deliberately structure-agnostic so they do
  // not fight the face axis: symmetry and clear skin are compatible with a
  // square jaw, a round face and a long narrow face alike.
  "Casting standard: this is one of the best-looking people in any room, the kind of face cast in national television commercials.",
  "Symmetrical, well-proportioned features, clear even skin, bright clear eyes, straight white teeth and thick healthy hair.",
].join(" ");

/** A cast option. Fragments that must agree with the subject take a possessive. */
export interface CastOption {
  key: string;
  label: string;
  gender?: Gender;
  fragment: string | ((possessive: string) => string);
}

export type CastField =
  | "ageBand"
  | "heritage"
  | "face"
  | "mark"
  | "beauty"
  | "hairColor"
  | "eyes"
  | "hair";

/**
 * The axes that actually move a face. Each entry is an independent randomized
 * dimension, and unlike the old `look` axis these describe DIFFERENT things
 * rather than the same thing in different words.
 *
 * `heritage` is the single strongest lever — naming it shifts bone structure
 * far more than a skin-tone adjective does, which is why the old `complexion`
 * axis failed to differentiate anyone. Every option is an AMERICAN demonym
 * carrying an ancestry (2026-09-08): the demonym fixes the nationality the
 * model used to guess wrong, the ancestry keeps the bone structure varied.
 *
 * `mark` differentiates the face with one memorable feature. It no longer
 * carries principle 2's imperfection — see the axis comment; that job moved to
 * skin texture and setting, which cost nothing in attractiveness.
 */
export const CAST_OPTIONS: Record<CastField, CastOption[]> = {
  // Fragments take the gender so the band agrees with the subject noun —
  // "a man in their late 20s" is the kind of small wrongness that makes a
  // prompt read as machine-written.
  ageBand: [
    { key: "early-20s", label: "Early 20s", fragment: (p) => `in ${p} early 20s` },
    { key: "mid-20s", label: "Mid 20s", fragment: (p) => `in ${p} mid 20s` },
    { key: "late-20s", label: "Late 20s", fragment: (p) => `in ${p} late 20s` },
    { key: "early-30s", label: "Early 30s", fragment: (p) => `in ${p} early 30s` },
    { key: "mid-30s", label: "Mid 30s", fragment: (p) => `in ${p} mid 30s` },
  ],
  // AMERICAN, 2026-09-08 (Adrian): every cast member reads as someone who
  // lives in the United States. Nationality was previously UNSTATED, so the
  // model free-associated it from the heritage word alone and drew people who
  // read as being abroad — "of South Asian heritage" produces a man in South
  // Asia, not an Indian American.
  //
  // The axis keeps its breadth on purpose. "American" is a nationality, not a
  // look: the US is ~19% Hispanic, ~14% Black and ~6% Asian, the ads run
  // against the whole country, and narrowing the bank to one ethnicity would
  // cast less like America rather than more. So each option names the
  // American demonym AND keeps the ancestry, because the ancestry is what
  // carries the bone structure this axis exists to vary.
  heritage: [
    { key: "northern-european", label: "N. European descent", fragment: "a white American of Northern European descent" },
    { key: "southern-european", label: "S. European descent", fragment: "a white American of Southern European descent" },
    { key: "eastern-european", label: "E. European descent", fragment: "a white American of Eastern European descent" },
    { key: "latin-american", label: "Hispanic American", fragment: "a Hispanic American of Latin American descent" },
    { key: "west-african", label: "Black American (W. African)", fragment: "a Black American of West African descent" },
    { key: "east-african", label: "Black American (E. African)", fragment: "a Black American of East African descent" },
    { key: "south-asian", label: "Indian American", fragment: "an Indian American of South Asian descent" },
    { key: "east-asian", label: "East Asian American", fragment: "an East Asian American" },
    { key: "southeast-asian", label: "SE Asian American", fragment: "a Southeast Asian American" },
    { key: "middle-eastern", label: "Arab American", fragment: "an Arab American of Middle Eastern descent" },
    { key: "mixed", label: "Mixed-race American", fragment: "a mixed-race American" },
  ],
  // Bone structure. The axis the old matrix was missing entirely.
  //
  // These are eight DISTINCT structures, all of them attractive. The first
  // version conflated "different" with "worse" — a broad nose, a heavy brow
  // over a crooked nose, flat features — so dealing the axis dealt ugliness.
  // A square jaw and high cheekbones are different from each other without
  // either being a flaw, which is the whole point.
  face: [
    { key: "square-jaw", label: "Square jaw", fragment: "a strong square jaw and a straight nose" },
    { key: "long-narrow", label: "Long & narrow", fragment: "a long narrow face and striking deep-set eyes" },
    { key: "round-full", label: "Round, full cheeks", fragment: "a softly rounded face with full cheeks and a neat short nose" },
    { key: "strong-brow", label: "Strong brow", fragment: "a strong defined brow and a straight well-proportioned nose" },
    { key: "high-cheekbones", label: "High cheekbones", fragment: "high sculpted cheekbones and a fine tapered chin" },
    { key: "soft-oval", label: "Soft oval", fragment: "a clean oval face and large wide-set eyes" },
    { key: "wide-flat", label: "Broad & open", fragment: "a broad open face with wide cheekbones and a small neat nose" },
    { key: "angular", label: "Angular", fragment: "sharp angular features and a long elegant straight nose" },
  ],
  // One distinguishing feature per face.
  //
  // This axis used to do double duty: differentiate the face AND supply
  // principle 2's imperfection. That was the design error. Nine of its ten
  // options were blemishes (acne scarring, sun damage, dark under-eyes,
  // protruding ears, an uneven mouth, a brow scar), every cast member drew
  // exactly one, and it was dealt at random — so ~90% of the bank was born
  // with a deliberate flaw on top of an already-plain bone structure.
  //
  // The anti-AI signal now comes from where it belongs and costs nothing:
  // untouched skin texture, an ordinary room, casual framing. A distinguishing
  // feature can be memorable without being a defect, which is what casting
  // directors actually pick for.
  mark: [
    { key: "freckles", label: "Freckles", fragment: "freckles scattered across the nose and cheeks" },
    { key: "cheek-mole", label: "Beauty mark", fragment: "a small beauty mark on one cheek" },
    { key: "gap-teeth", label: "Gap teeth", fragment: "a small charming gap between the front teeth" },
    { key: "dimples", label: "Dimples", fragment: "dimples at the corners of the mouth" },
    { key: "strong-brows", label: "Strong brows", fragment: "thick expressive eyebrows" },
    { key: "chin-cleft", label: "Chin cleft", fragment: "a subtle cleft in the chin" },
    { key: "full-lips", label: "Full mouth", fragment: "a full, well-defined mouth" },
    { key: "widows-peak", label: "Widow's peak", fragment: "a pronounced widow's peak at the hairline" },
    { key: "long-lashes", label: "Long lashes", fragment: "notably long dark eyelashes" },
    { key: "sharp-jawline", label: "Sharp jawline", fragment: "a notably sharp, clean jawline" },
    { key: "arched-brows", label: "Arched brows", fragment: "high naturally arched eyebrows" },
  ],
  // REGISTER OF ATTRACTIVENESS (2026-09-08, after the second live bank).
  //
  // "Conventionally attractive" said once, globally, is a mode instruction:
  // it names the CENTRE of the model's attractiveness distribution, and the
  // centre is one face — symmetric, oval, slim-nosed. Every member asking for
  // the same point got the same point. Beauty is not one thing, so this axis
  // asks each member for a DIFFERENT KIND of good-looking. It raises the
  // attractiveness floor and breaks the convergence with the same move,
  // which the old single adjective could not do.
  beauty: [
    { key: "editorial", label: "Striking / dramatic", fragment: "in a striking, dramatic way" },
    { key: "warm", label: "Warm & approachable", fragment: "in a warm, open, approachable way" },
    { key: "classic", label: "Classic all-American", fragment: "in a clean, classic, all-American way" },
    { key: "sultry", label: "Sultry", fragment: "in a sultry, heavy-lidded way" },
    { key: "athletic", label: "Fresh & athletic", fragment: "in a fresh, glowing, athletic way" },
    { key: "delicate", label: "Soft & delicate", fragment: "in a soft, fine-featured, delicate way" },
    { key: "bold", label: "Bold features", fragment: "in a bold, strong-featured way" },
    { key: "refined", label: "Quietly elegant", fragment: "in a quietly elegant, refined way" },
  ],
  // Colouring was UNSPECIFIED on every cast member. The hair axis carried
  // length and style only, and eye colour existed in exactly one of ten mark
  // options — so the model picked both, and it picks the same both every
  // time. The first bank was four women with dark hair.
  hairColor: [
    { key: "jet-black", label: "Jet black", fragment: "jet black" },
    { key: "dark-brown", label: "Dark brown", fragment: "dark brown" },
    { key: "chestnut", label: "Chestnut", fragment: "warm chestnut brown" },
    { key: "light-brown", label: "Light brown", fragment: "light ash brown" },
    { key: "honey-blonde", label: "Honey blonde", fragment: "honey blonde" },
    { key: "platinum", label: "Platinum", fragment: "bleached platinum blonde" },
    { key: "copper", label: "Copper red", fragment: "coppery red" },
    { key: "dirty-blonde", label: "Dirty blonde", fragment: "sun-lightened dirty blonde" },
  ],
  eyes: [
    { key: "dark-brown", label: "Dark brown", fragment: "dark brown eyes" },
    { key: "black-brown", label: "Near-black", fragment: "deep near-black eyes" },
    { key: "hazel", label: "Hazel", fragment: "hazel eyes" },
    { key: "green", label: "Green", fragment: "clear green eyes" },
    { key: "blue", label: "Blue", fragment: "bright blue eyes" },
    { key: "grey-blue", label: "Grey-blue", fragment: "pale grey-blue eyes" },
    { key: "amber", label: "Amber", fragment: "warm amber eyes" },
  ],
  hair: [
    { key: "long-loose", label: "Long loose", gender: "female", fragment: "long loose hair" },
    { key: "shoulder-lob", label: "Shoulder lob", gender: "female", fragment: "shoulder-length hair" },
    { key: "wavy-mid", label: "Wavy mid-length", gender: "female", fragment: "wavy mid-length hair" },
    { key: "tight-curls", label: "Tight curls", gender: "female", fragment: "tightly curled hair" },
    { key: "messy-bun", label: "Messy bun", gender: "female", fragment: "hair pulled into a loose messy bun" },
    { key: "pixie", label: "Short pixie", gender: "female", fragment: "a short cropped pixie cut" },
    { key: "braids", label: "Braids", gender: "female", fragment: "hair in braids" },
    { key: "ponytail", label: "Ponytail", gender: "female", fragment: "hair pulled back into a ponytail" },
    { key: "short-crop", label: "Short crop", gender: "male", fragment: "short cropped hair" },
    { key: "buzz", label: "Buzz cut", gender: "male", fragment: "a close buzz cut" },
    { key: "textured", label: "Textured top", gender: "male", fragment: "short textured hair" },
    { key: "short-curls", label: "Short curls", gender: "male", fragment: "short curly hair" },
    { key: "beard", label: "Full beard", gender: "male", fragment: "short hair and a full beard" },
    { key: "stubble", label: "Stubble", gender: "male", fragment: "short hair and a few days of stubble" },
    { key: "receding", label: "Receding", gender: "male", fragment: "a receding hairline kept short" },
    { key: "man-bun", label: "Tied back", gender: "male", fragment: "longer hair tied back" },
  ],
};

export const CAST_FIELDS = Object.keys(CAST_OPTIONS) as CastField[];

/**
 * NAME MODE (Adrian, 2026-09-08). The matrix asks the model to satisfy five
 * independent attribute constraints at once, and image models answer that by
 * regressing to the mean — you get the default face wearing the adjectives,
 * which is the convergence this bank was built to fix and did not fully fix.
 *
 * A NAME is a single dense identity anchor instead of a constraint set. The
 * training data is full of photographs captioned with names, so the model has
 * a joint distribution to SAMPLE from rather than a checklist to satisfy, and
 * one token moves face, colouring, styling and grooming together coherently.
 *
 * The tradeoff, stated plainly: name-to-appearance priors are learned from
 * real-world correlation, so the model WILL infer ethnicity from a name. That
 * is precisely the mechanism supplying the variety here. It means this list is
 * now the casting decision — the bank will look like whatever these names look
 * like — so it is chosen deliberately to span American naming traditions
 * rather than assembled at random.
 */
export const AMERICAN_NAMES: Record<Gender, string[]> = {
  female: [
    "Ashley Brennan", "Madison Cole", "Brianna Whitfield", "Destiny Coleman",
    "Sofia Reyes", "Camila Ortega", "Priya Shah", "Nina Petrova",
    "Katie Lundgren", "Maya Robinson", "Jasmine Carter", "Chloe Nguyen",
    "Alexis Ward", "Hannah Meyer", "Gabriela Santos", "Aaliyah Jefferson",
    "Emily Hartman", "Sydney Brooks", "Talia Rosen", "Mei Chen",
    "Kayla Sullivan", "Danielle Foster", "Elena Vasquez", "Simone Baptiste",
    "Rachel Kowalski", "Amara Okafor", "Lauren Delgado", "Tessa Lindqvist",
    "Nadia Haddad", "Jordan Ellis",
  ],
  male: [
    "Tyler Brennan", "Jordan Whitfield", "Marcus Coleman", "Diego Reyes",
    "Andre Jackson", "Connor Walsh", "Ethan Lindqvist", "Raj Patel",
    "Luis Herrera", "Devin Brooks", "Nathan Cole", "Xavier Bell",
    "Cody Ramsey", "Malik Freeman", "Adrian Vega", "Jake Sullivan",
    "Omar Haddad", "Kevin Park", "Tanner Reid", "Isaiah Grant",
    "Brandon Meyer", "Julian Santos", "Trevor Nolan", "Amir Rahman",
    "Caleb Hoffman", "Darius Coleman", "Mateo Cruz", "Ryan Kowalski",
    "Silas Boone", "Elijah Turner",
  ],
};

/** The two ways a cast member can be described. */
export type CastMode = "name" | "matrix";
export const DEFAULT_CAST_MODE: CastMode = "name";

export const POSSESSIVE: Record<Gender, string> = { female: "her", male: "his" };

export function eligible(field: CastField, gender: Gender): CastOption[] {
  const options = CAST_OPTIONS[field].filter((option) => !option.gender || option.gender === gender);
  return options.length ? options : CAST_OPTIONS[field];
}

export function optionFor(field: CastField, key: string, gender: Gender): CastOption {
  const options = eligible(field, gender);
  return options.find((o) => o.key === key) || options[0];
}

function fragmentFor(field: CastField, key: string, gender: Gender): string {
  const option = optionFor(field, key, gender);
  return typeof option.fragment === "function" ? option.fragment(POSSESSIVE[gender]) : option.fragment;
}

/** A dealt general-path cast member, before it becomes a public CastMember. */
export interface CastPersona extends Record<CastField, string> {
  gender: Gender;
  mode: CastMode;
  name: string;
}

/**
 * Cast a whole batch at once.
 *
 * WHY THIS EXISTS. Drawing each member independently collides: four names
 * pulled from a thirty-name pool repeat one about 19% of the time, and nothing
 * consulted the names already IN the bank, so a second batch could only
 * repeat. The first live bank came back with two Chloe Nguyens in four
 * members.
 *
 * Dealing fixes both at once. Names are dealt from the pool with everyone
 * already cast removed, so a name cannot repeat until the pool is exhausted;
 * every other axis is dealt from its own deck, so four members are four bone
 * structures rather than four rolls of the same die.
 *
 * `taken` is the names already in the bank — pass every existing member's
 * name, not just this batch's.
 *
 * `genders` is one entry per member, so a mixed batch is one call. Names and
 * gender-tagged axes (hair) are dealt per gender, from that gender's pool;
 * every untagged axis gets ONE deck across the whole batch — the same rule
 * the take matrix uses — so a mixed batch of eight is still eight hair
 * colours, not two independent decks of four that can collide.
 */
export function randomCastBatch(
  genders: readonly Gender[],
  {
    rng,
    taken = [],
    overrides = {},
    mode = DEFAULT_CAST_MODE,
  }: { rng: Rng; taken?: readonly string[]; overrides?: Partial<Record<CastField, string>>; mode?: CastMode },
): CastPersona[] {
  const size = genders.length;
  if (!size) return [];

  const groups = groupByGender(genders);
  const names: string[] = new Array(size);
  for (const [gender, indexes] of groups) {
    dealNames(AMERICAN_NAMES[gender], indexes.length, taken, rng).forEach((name, slot) => {
      names[indexes[slot]] = name;
    });
  }

  const dealtFields = {} as Record<CastField, string[]>;
  for (const field of CAST_FIELDS) {
    const tagged = CAST_OPTIONS[field].some((option) => option.gender);
    const indexGroups: [Gender, number[]][] = tagged
      ? [...groups]
      : [[genders[0], genders.map((_, i) => i)]];
    dealtFields[field] = new Array(size);
    for (const [gender, indexes] of indexGroups) {
      const options = eligible(field, gender);
      const pinned = options.find((option) => option.key === overrides[field]);
      const dealt = pinned
        ? Array.from({ length: indexes.length }, () => pinned.key)
        : dealDeck(
            options.map((option) => option.key),
            indexes.length,
            rng,
          );
      indexes.forEach((index, slot) => {
        dealtFields[field][index] = dealt[slot];
      });
    }
  }

  return genders.map((gender, i) => {
    const persona = { gender, mode, name: names[i] } as CastPersona;
    for (const field of CAST_FIELDS) persona[field] = dealtFields[field][i];
    return persona;
  });
}

/** Indexes per gender, in first-seen order. */
export function groupByGender(genders: readonly Gender[]): Map<Gender, number[]> {
  const groups = new Map<Gender, number[]>();
  genders.forEach((gender, i) => {
    if (!groups.has(gender)) groups.set(gender, []);
    groups.get(gender)!.push(i);
  });
  return groups;
}

/**
 * Prefer never-used names; only once they run out does the pool recycle,
 * and then it recycles by dealing rather than by rolling.
 */
export function dealNames(pool: readonly string[], count: number, taken: readonly string[], rng: Rng): string[] {
  const already = new Set(taken);
  const fresh = pool.filter((name) => !already.has(name));
  return fresh.length >= count
    ? dealDeck(fresh, count, rng)
    : [...dealDeck(fresh, fresh.length, rng), ...dealDeck(pool, count - fresh.length, rng)];
}

/**
 * The portrait prompt for one cast member.
 *
 * Name mode names the person and then states only what a name cannot carry.
 * Everything else — colouring cues, grooming, ancestry — is left for the
 * model to resolve from the name, which is the whole bet: a name is sampled
 * from a joint distribution, a checklist is averaged into a default.
 */
export function buildCastPrompt(persona: CastPersona): string {
  const gender = persona.gender;
  const parts =
    persona.mode === "name"
      ? [
          // The name carries colouring, grooming and ancestry — things it is
          // genuinely dense about. It does NOT carry bone structure, and the
          // first live bank proved it: four names spanning four ancestries
          // came back as four versions of the same slim oval face. So face,
          // hair and mark are stated even in name mode. Heritage stays out,
          // because the name already implies it and saying both invites a
          // contradiction ("Chloe Nguyen, of Northern European descent").
          `Portrait photo of ${persona.name}, a ${BUILD[gender]}`,
          `${fragmentFor("ageBand", persona.ageBand, gender)},`,
          `with ${fragmentFor("face", persona.face, gender)},`,
          `${fragmentFor("hair", persona.hair, gender)}, ${fragmentFor("hairColor", persona.hairColor, gender)},`,
          `${fragmentFor("eyes", persona.eyes, gender)},`,
          `and ${fragmentFor("mark", persona.mark, gender)}.`,
          // "An ordinary American social-media influencer" was cut here. It
          // was two mode words in one line: "influencer" names a homogenised
          // face the model has a very sharp prior for, and "ordinary" pulls to
          // the mean of it — applied identically to every member, while only
          // ~20 words of a 146-word prompt varied. The lane still reads as
          // influencer content because the TAKE supplies the selfie framing;
          // this portrait only has to carry a face.
          CAST_DOCTRINE,
          // Last, deliberately: the closing instruction is the one about how
          // this person is good-looking, not one about how plain the photo is.
          `Exceptionally ${BEAUTY_NOUN[gender]} ${fragmentFor("beauty", persona.beauty, gender)}.`,
        ]
      : [
          `Portrait photo of a ${BUILD[gender]}`,
          `${fragmentFor("ageBand", persona.ageBand, gender)},`,
          `${fragmentFor("heritage", persona.heritage, gender)},`,
          `with ${fragmentFor("face", persona.face, gender)},`,
          `${fragmentFor("hair", persona.hair, gender)}, ${fragmentFor("hairColor", persona.hairColor, gender)},`,
          `${fragmentFor("eyes", persona.eyes, gender)},`,
          `and ${fragmentFor("mark", persona.mark, gender)}.`,
          CAST_DOCTRINE,
          // Last, deliberately: the closing instruction is the one about how
          // this person is good-looking, not one about how plain the photo is.
          `Exceptionally ${BEAUTY_NOUN[gender]} ${fragmentFor("beauty", persona.beauty, gender)}.`,
        ];
  return parts.join(" ");
}
