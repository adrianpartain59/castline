import { describe, expect, it } from "vitest";
import type { CastMember, Gender, TakePersona } from "../contracts";
import {
  AD_TYPES,
  CAST_TYPES,
  DIRECTION_OPTIONS,
  GESTURE_OPTIONS,
  HOOKS,
  PAYOFF_LINES,
  HOOK_LINES,
  buildMotionDoctrine,
  buildMotionPrompt,
  buildStillDoctrine,
  buildStillPrompt,
  castCombinations,
  dealCast,
  dealDeck,
  dealTakes,
  mulberry32,
  pronounsFor,
} from "./index";
import { CAST_TYPE_DEFS, poolFor } from "./castTypes";

const FEMALE_WORDS = /\bshe\b|\bher\b|\bhers\b|\bherself\b|\bwoman\b|\bgirl\b/i;
const MALE_WORDS = /\bhe\b|\bhis\b|\bhim\b|\bhimself\b|\bman\b|\bguy\b/i;
const BRAND_LEAKS = /pepai|pep ai|peptide|glp|medication|semaglutide|tirzepatide|arlo|vial|dose/i;

const identity = (m: CastMember) => `${m.name}|${m.boneStructure}|${m.distinguishingMark}`;

function allTakes(seed: number, cast: CastMember[], count = 8, pins = {}) {
  return dealTakes({ cast, count, pins, extraNotes: "", seed });
}

// ---------------------------------------------------------------------------
// RNG + dealer
// ---------------------------------------------------------------------------

describe("seeded randomness", () => {
  it("mulberry32 is deterministic and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i += 1) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("dealDeck deals every option before repeating one, and never back to back", () => {
    const values = ["a", "b", "c", "d", "e", "f"];
    for (let seed = 0; seed < 50; seed += 1) {
      const dealt = dealDeck(values, 20, mulberry32(seed));
      expect(new Set(dealt.slice(0, 6)).size).toBe(6);
      for (let i = 1; i < dealt.length; i += 1) expect(dealt[i]).not.toBe(dealt[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Casting
// ---------------------------------------------------------------------------

describe("dealCast", () => {
  it("is deterministic per seed, and a different seed casts different people", () => {
    const a = dealCast({ count: 8, gender: "female", seed: 7 });
    const b = dealCast({ count: 8, gender: "female", seed: 7 });
    const c = dealCast({ count: 8, gender: "female", seed: 8 });
    expect(a).toEqual(b);
    expect(a.map(identity)).not.toEqual(c.map(identity));
  });

  it("N members are N different people: distinct names, bone structures and marks", () => {
    for (const gender of ["female", "male"] as Gender[]) {
      for (let seed = 0; seed < 25; seed += 1) {
        const cast = dealCast({ count: 8, gender, seed });
        expect(cast).toHaveLength(8);
        expect(new Set(cast.map(identity)).size).toBe(8);
        // dealt from decks, so eight members are eight of each axis
        expect(new Set(cast.map((m) => m.name)).size).toBe(8);
        expect(new Set(cast.map((m) => m.boneStructure)).size).toBe(8);
        expect(new Set(cast.map((m) => m.distinguishingMark)).size).toBe(8);
        expect(new Set(cast.map((m) => m.hairColour)).size).toBe(8);
        expect(new Set(cast.map((m) => m.id)).size).toBe(8);
        for (const m of cast) expect(m.gender).toBe(gender);
      }
    }
  });

  it("with no gender, the batch splits evenly instead of by coin flip", () => {
    const cast = dealCast({ count: 8, seed: 3 });
    expect(cast.filter((m) => m.gender === "female")).toHaveLength(4);
    expect(new Set(cast.map(identity)).size).toBe(8);
  });

  it("the portrait is fit, American, flattering-lit and closes on the register", () => {
    for (const gender of ["female", "male"] as Gender[]) {
      for (const m of dealCast({ count: 6, gender, seed: 11 })) {
        const p = m.portraitPrompt;
        expect(p).toContain(`Portrait photo of ${m.name}`);
        expect(p).toMatch(/fit/);
        expect(p).toMatch(/in-shape/);
        expect(p).toMatch(/lives in the United States/);
        expect(p).toMatch(/Soft flattering directional daylight/);
        expect(p).toMatch(/never flat frontal light/);
        expect(p).toMatch(/uncluttered indoor background/);
        expect(p).toMatch(/kind of face cast in national television commercials/);
        expect(p).toMatch(/Exceptionally (beautiful|handsome) in a .+ way\.$/);
        expect(p).not.toMatch(/NOT a model/);
        // name mode states the bone structure but never the heritage
        expect(p).not.toMatch(/descent/);
        // a male portrait never borrows female wording, and vice versa
        expect(p).not.toMatch(gender === "male" ? FEMALE_WORDS : MALE_WORDS);
      }
    }
  });

  it("age is a number inside 20s-30s casting", () => {
    for (const m of dealCast({ count: 30, seed: 5 })) {
      expect(m.age).toBeGreaterThanOrEqual(20);
      expect(m.age).toBeLessThan(40);
    }
  });
});

describe("typed casting", () => {
  it("there are three archetypes with a female-only, a male-only and a mixed one", () => {
    expect(CAST_TYPES).toHaveLength(3);
    const genders = CAST_TYPES.map((t) => t.gender);
    expect(genders).toContain("female");
    expect(genders).toContain("male");
    expect(genders).toContain(null);
    for (const t of CAST_TYPES) {
      expect(t.plural.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(0);
      // served to the UI with no prompt fragments
      expect(JSON.parse(JSON.stringify(t))).toEqual(t);
    }
  });

  it("a typed batch is one archetype and still eight different people", () => {
    for (const type of CAST_TYPE_DEFS) {
      for (let seed = 0; seed < 10; seed += 1) {
        const cast = dealCast({ count: 8, typeKey: type.key, seed });
        expect(cast).toHaveLength(8);
        expect(new Set(cast.map(identity)).size).toBe(8);
        expect(new Set(cast.map((m) => m.name)).size).toBe(8);
        expect(new Set(cast.map((m) => m.hairColour)).size).toBe(8);
        for (const m of cast) {
          expect(m.typeKey).toBe(type.key);
          if (type.gender) expect(m.gender).toBe(type.gender);
        }
      }
    }
  });

  it("a type narrows its pools: restricted values never escape them", () => {
    const crossover = CAST_TYPE_DEFS.find((t) => t.key === "gym-crossover")!;
    const allowedFaces = poolFor("face", crossover, "male").map((o) => o.label);
    const allowedHair = poolFor("hair", crossover, "male").map((o) => o.label);
    expect(allowedFaces.length).toBeLessThan(8);
    for (let seed = 0; seed < 20; seed += 1) {
      for (const m of dealCast({ count: 8, typeKey: "gym-crossover", seed })) {
        expect(allowedFaces).toContain(m.boneStructure);
        expect(allowedHair).toContain(m.hairStyle);
        expect(m.age).toBeLessThanOrEqual(32);
      }
    }
    // narrowing costs combinations, but the type still varies identity
    expect(castCombinations("male", "gym-crossover")).toBeLessThan(castCombinations("male"));
    expect(castCombinations("male", "gym-crossover")).toBeGreaterThan(1000);
  });

  it("a featured type draws its face from its OWN pools and states eyes, nose and mouth", () => {
    const [m] = dealCast({ count: 1, typeKey: "marathon-chaser", seed: 2 });
    const type = CAST_TYPE_DEFS.find((t) => t.key === "marathon-chaser")!;
    expect(type.features?.faceShape?.map((o) => o.label)).toContain(m.boneStructure);
    expect(m.portraitPrompt).toMatch(/nose/);
    expect(m.portraitPrompt).toMatch(/lips|mouth/);
    expect(m.portraitPrompt).toMatch(/eyes/);
    expect(m.portraitPrompt).toContain(type.build as string);
  });

  it("a type can introduce an axis no other type has", () => {
    const type = CAST_TYPE_DEFS.find((t) => t.key === "marathon-chaser")!;
    const miles = type.features!.miles!.map((o) => o.fragment as string);
    const prompts = dealCast({ count: 8, typeKey: type.key, seed: 9 }).map((m) => m.portraitPrompt);
    for (const p of prompts) expect(miles.some((f) => p.includes(f))).toBe(true);
    const others = dealCast({ count: 8, gender: "female", seed: 9 }).map((m) => m.portraitPrompt);
    for (const p of others) expect(miles.some((f) => p.includes(f))).toBe(false);
  });

  it("the trust archetype is cast to be believed, in both genders", () => {
    const cast = dealCast({ count: 8, typeKey: "weekend-runner", seed: 4 });
    expect(new Set(cast.map((m) => m.gender)).size).toBe(2);
    for (const m of cast) {
      expect(m.portraitPrompt).toMatch(/(She|He) reads as .+\.$/);
      expect(m.portraitPrompt).not.toMatch(/best-looking people in any room|Exceptionally/);
      expect(m.portraitPrompt).not.toMatch(m.gender === "male" ? FEMALE_WORDS : MALE_WORDS);
    }
    // a pinned gender holds on a mixed type
    for (const m of dealCast({ count: 6, typeKey: "weekend-runner", gender: "male", seed: 4 })) {
      expect(m.gender).toBe("male");
    }
  });

  it("the general path is untouched by types", () => {
    const general = dealCast({ count: 4, gender: "female", seed: 21 });
    const unknownType = dealCast({ count: 4, gender: "female", typeKey: "nope", seed: 21 });
    expect(unknownType).toEqual(general);
    for (const m of general) expect(m.typeKey).toBeNull();
  });
});

describe("castCombinations", () => {
  it("is computed from the decks and is large for both genders", () => {
    for (const gender of ["female", "male"] as Gender[]) {
      expect(castCombinations(gender)).toBeGreaterThan(10000);
    }
    // bone structure 8 x hair 8 x hair colour 8 x eyes 7 x mark 11
    expect(castCombinations("male")).toBe(8 * 8 * 8 * 7 * 11);
  });
});

// ---------------------------------------------------------------------------
// Takes
// ---------------------------------------------------------------------------

describe("dealTakes", () => {
  const cast = dealCast({ count: 4, seed: 100 });

  it("is deterministic per seed", () => {
    expect(allTakes(1, cast)).toEqual(allTakes(1, cast));
    expect(allTakes(1, cast)).not.toEqual(allTakes(2, cast));
  });

  it("every selected face gets at least one take", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      for (const count of [4, 5, 7, 8]) {
        const takes = allTakes(seed, cast, count);
        expect(takes).toHaveLength(count);
        const ids = new Set(takes.map((t) => t.persona.castId));
        for (const m of cast) expect(ids.has(m.id)).toBe(true);
      }
    }
    // one face, four takes: four takes of that person
    const one = allTakes(3, [cast[0]], 4);
    expect(one.every((t) => t.persona.castId === cast[0].id)).toBe(true);
  });

  it("refuses more faces than takes, and drops duplicate faces", () => {
    expect(() => allTakes(1, cast, 3)).toThrow(/every selected face/);
    const takes = allTakes(1, [cast[0], cast[0], cast[1]], 2);
    expect(new Set(takes.map((t) => t.persona.castId)).size).toBe(2);
  });

  it("pins are honoured and unpinned axes vary", () => {
    const female = dealCast({ count: 2, gender: "female", seed: 9 });
    const takes = dealTakes({
      cast: female,
      count: 8,
      pins: { adType: "point-at-text", setting: "track", wardrobe: "running" },
      extraNotes: "",
      seed: 5,
    });
    for (const t of takes) {
      expect(t.persona.adType).toBe("point-at-text");
      expect(t.persona.setting).toBe("track");
      expect(t.persona.wardrobe).toBe("running");
      expect(t.prompts.still).toMatch(/running track/);
    }
    expect(new Set(takes.map((t) => t.persona.lighting)).size).toBeGreaterThan(1);
    expect(new Set(takes.map((t) => t.persona.gesture)).size).toBe(4); // the whole pointing pool

    const loose = allTakes(5, female, 8);
    expect(new Set(loose.map((t) => t.persona.setting)).size).toBe(8);
    expect(new Set(loose.map((t) => t.persona.adType)).size).toBe(2);
    for (let i = 1; i < loose.length; i += 1) {
      expect(loose[i].persona.setting).not.toBe(loose[i - 1].persona.setting);
    }
  });

  it("a gendered wardrobe pin falls back on the other gender rather than breaking", () => {
    const takes = dealTakes({
      cast: dealCast({ count: 2, gender: "female", seed: 1 }),
      count: 4,
      pins: { wardrobe: "no-shirt" },
      extraNotes: "",
      seed: 1,
    });
    for (const t of takes) expect(t.persona.wardrobe).not.toBe("no-shirt");
  });

  it("each ad type only ever draws its own gestures", () => {
    for (const t of allTakes(8, cast, 8)) {
      const gesture = GESTURE_OPTIONS.find((g) => g.key === t.persona.gesture)!;
      expect(gesture.adType).toBe(t.persona.adType);
    }
  });

  it("extra notes ride on the end of the still prompt", () => {
    const takes = dealTakes({ cast, count: 4, pins: {}, extraNotes: "  red running cap  ", seed: 1 });
    for (const t of takes) {
      expect(t.persona.extraNotes).toBe("red running cap");
      expect(t.prompts.still.endsWith("red running cap")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Prompts — the 2026-09-04 doctrine
// ---------------------------------------------------------------------------

describe("prompt doctrine", () => {
  const cast = [
    ...dealCast({ count: 3, gender: "female", seed: 50 }),
    ...dealCast({ count: 3, gender: "male", seed: 51 }),
    ...dealCast({ count: 2, typeKey: "weekend-runner", seed: 52 }),
  ];
  const takes = Array.from({ length: 12 }, (_, seed) => allTakes(seed, cast, 8)).flat();
  const memberFor = (id: string) => cast.find((m) => m.id === id)!;

  it("the still doctrine bans devices in frame and demands a relaxed face, both genders", () => {
    for (const gender of ["female", "male"] as Gender[]) {
      const doctrine = buildStillDoctrine(pronounsFor(gender));
      expect(doctrine).toMatch(/no phone, screen, or gadget anywhere in the frame/);
      expect(doctrine).toMatch(/No wide eyes/);
      expect(doctrine).toMatch(/almost deadpan/);
      expect(doctrine).toMatch(/not look staged, styled, professionally lit/);
      expect(doctrine).toMatch(/never airbrushed/);
    }
  });

  it("every still carries the doctrine, and outside it 'phone' is only the camera", () => {
    for (const t of takes) {
      const member = memberFor(t.persona.castId);
      const doctrine = buildStillDoctrine(pronounsFor(member.gender));
      expect(t.prompts.still).toContain(doctrine);
      expect(t.prompts.still).toMatch(/the person in the attached reference photo/);
      const remainder = t.prompts.still.replace(doctrine, "");
      expect(remainder).not.toMatch(/wide eyes|eyes wide|eyebrows raised|gasp|shock/i);
      expect(remainder.match(/phone/gi) || []).toHaveLength(1);
      expect(remainder).toMatch(/front-facing phone camera/);
      // the reference is the only identity source
      expect(remainder).not.toMatch(/hair and|in (her|his) (early|mid|late)/);
    }
  });

  it("every motion prompt directs near-stillness and forbids speech", () => {
    for (const t of takes) {
      const member = memberFor(t.persona.castId);
      const doctrine = buildMotionDoctrine(pronounsFor(member.gender));
      expect(t.prompts.motion).toContain(doctrine);
      expect(t.prompts.motion).toMatch(/never speaks/);
      expect(t.prompts.motion).not.toMatch(/\bsays\b|\btalking\b|\bdialogue\b|\bnarrat/i);
      const remainder = t.prompts.motion.replace(doctrine, "");
      expect(remainder).not.toMatch(/widen|gasp|breath|sharp|dramatic/i);
    }
  });

  it("a male take never emits female wording, and vice versa", () => {
    for (const t of takes) {
      const member = memberFor(t.persona.castId);
      const banned = member.gender === "male" ? FEMALE_WORDS : MALE_WORDS;
      expect(`${t.prompts.still} ${t.prompts.motion}`).not.toMatch(banned);
    }
  });

  it("point-at-text reserves the upper third and points into it", () => {
    for (const t of takes.filter((x) => x.persona.adType === "point-at-text")) {
      expect(t.prompts.still).toMatch(/lower two thirds/);
      expect(t.prompts.still).toMatch(/upper third of the frame is deliberately empty/);
      expect(t.prompts.still).toMatch(/no text, no writing of any kind/);
      expect(t.prompts.still).toMatch(/pointing|presenting/);
    }
    for (const t of takes.filter((x) => x.persona.adType === "reaction")) {
      expect(t.prompts.still).toMatch(/Head and shoulders fill the upper half of the frame/);
      expect(t.prompts.still).not.toMatch(/lower two thirds/);
    }
  });

  it("every gesture rests or is held steady — never pressed, clutched or jabbed", () => {
    const g = pronounsFor("female");
    for (const gesture of GESTURE_OPTIONS) {
      expect(gesture.still(g)).toMatch(/resting|held steady/);
      expect(gesture.still(g)).not.toMatch(/pressed|clutch|grip|jab|thrust|dropped open/);
    }
  });

  it("the public builders agree with what dealTakes stored", () => {
    const t = takes[0];
    const member = memberFor(t.persona.castId);
    const persona: TakePersona = t.persona;
    expect(buildStillPrompt(member, persona)).toBe(t.prompts.still);
    expect(buildMotionPrompt(member, persona)).toBe(t.prompts.motion);
  });

  it("nothing anywhere carries the old brand", () => {
    const everything = [
      ...takes.flatMap((t) => [t.prompts.still, t.prompts.motion]),
      ...cast.map((m) => m.portraitPrompt),
      ...CAST_TYPE_DEFS.flatMap((type) =>
        dealCast({ count: 8, typeKey: type.key, seed: 77 }).map((m) => m.portraitPrompt),
      ),
      ...HOOKS,
      ...PAYOFF_LINES.map((p) => p.text),
      JSON.stringify(DIRECTION_OPTIONS),
      JSON.stringify(CAST_TYPES),
    ];
    for (const text of everything) expect(text).not.toMatch(BRAND_LEAKS);
  });
});

// ---------------------------------------------------------------------------
// Chips + copy
// ---------------------------------------------------------------------------

describe("direction chips and hooks", () => {
  it("both real ad types exist, and every chip carries a sentence", () => {
    expect(DIRECTION_OPTIONS.adTypes.map((o) => o.key).sort()).toEqual(["point-at-text", "reaction"]);
    expect(AD_TYPES).toHaveLength(2);
    for (const list of Object.values(DIRECTION_OPTIONS)) {
      expect(list.length).toBeGreaterThan(1);
      for (const option of list) {
        expect(option.sentence.trim().length).toBeGreaterThan(0);
        expect(option.sentence).toMatch(/\.$/);
        expect(option.sentence).not.toMatch(/—/);
      }
    }
  });

  it("no shirt is male-only and a dress is female-only", () => {
    expect(DIRECTION_OPTIONS.wardrobe.find((o) => o.key === "no-shirt")?.gender).toBe("male");
    expect(DIRECTION_OPTIONS.wardrobe.find((o) => o.key === "dress")?.gender).toBe("female");
  });

  it("hooks are first person or conditional and promise no result", () => {
    expect(HOOKS.length).toBeGreaterThanOrEqual(10);
    for (const hook of HOOKS) {
      expect(hook).not.toMatch(/\byou're (out of shape|slow|overweight)|\byou are\b/i);
      expect(hook).not.toMatch(/guarantee|sub-?\d|lose weight|PR in/i);
    }
    // every hook angle has at least one payoff that closes it
    for (const angle of new Set(HOOK_LINES.map((h) => h.angle))) {
      expect(PAYOFF_LINES.some((p) => p.closes.includes(angle))).toBe(true);
    }
    for (const p of PAYOFF_LINES) expect(p.text.split(/\s+/).length).toBeLessThanOrEqual(6);
  });
});
