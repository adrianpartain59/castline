// Turns a cast member's written description (complexion, hair, eyes, mark)
// and a take's setting into the colours and shapes the placeholder reaction is
// drawn with. Pure: words in, hex and enums out, so it is unit-tested.
//
// Matching is longest-keyword-wins over a fixed vocabulary ("light brown"
// beats "brown"); anything the vocabulary misses falls back to a hash of the
// text, so an unknown word still gives the same person the same look.

import type { CastMember } from "../contracts";
import { hashString, mix } from "./canvas";

type Vocab<T> = ReadonlyArray<readonly [string, T]>;

function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The value of the longest vocabulary keyword found in `text`, or null. */
export function matchVocab<T>(text: string, vocab: Vocab<T>): T | null {
  const s = norm(text);
  if (!s) return null;
  let best: T | null = null;
  let bestLen = 0;
  for (const [word, value] of vocab) {
    if (word.length > bestLen && containsWord(s, word)) {
      best = value;
      bestLen = word.length;
    }
  }
  return best;
}

function containsWord(s: string, word: string): boolean {
  const i = s.indexOf(word);
  if (i < 0) return false;
  // Whole-word-ish: "tan" must not match inside "tangerine".
  const before = i === 0 ? " " : s[i - 1];
  const after = i + word.length >= s.length ? " " : s[i + word.length];
  const boundary = (c: string) => !/[a-z]/.test(c);
  return boundary(before) && boundary(after);
}

function pick<T>(list: readonly T[], key: string): T {
  return list[hashString(key) % list.length];
}

// ---- skin ------------------------------------------------------------------

/** Ten tones, lightest to deepest. */
export const SKIN_SCALE = [
  "#F6DDCC",
  "#EFCDB5",
  "#E6BB9C",
  "#D9A784",
  "#C8916A",
  "#B67C55",
  "#A16844",
  "#875333",
  "#6B3F26",
  "#4E2D1B",
] as const;

const SKIN_VOCAB: Vocab<number> = [
  ["porcelain", 0], ["alabaster", 0], ["pale", 0], ["very fair", 0],
  ["fair", 1], ["ivory", 1], ["rosy", 1], ["pink", 1], ["cream", 1], ["creamy", 1],
  ["light", 2], ["peach", 2], ["peachy", 2],
  ["beige", 3], ["light medium", 3], ["light-medium", 3], ["warm beige", 3], ["sand", 3], ["light olive", 3],
  ["olive", 4], ["medium", 4], ["mediterranean", 4], ["neutral", 4],
  ["golden", 5], ["tan", 5], ["tanned", 5], ["sun-kissed", 5], ["sunkissed", 5], ["warm tan", 5],
  ["honey", 6], ["caramel", 6], ["amber", 6], ["light brown", 6], ["toffee", 6],
  ["brown", 7], ["bronze", 7], ["chestnut", 7], ["cinnamon", 7], ["medium brown", 7], ["medium-brown", 7],
  ["medium deep", 8], ["medium-deep", 8], ["deep brown", 8], ["rich brown", 8], ["mahogany", 8], ["dark brown", 8], ["chocolate", 8],
  ["deep", 9], ["dark", 9], ["ebony", 9], ["espresso", 9], ["umber", 9], ["very dark", 9],
];

/** Skin tone hex from a complexion description. */
export function skinToneFor(complexion: string): string {
  const idx = matchVocab(complexion, SKIN_VOCAB);
  let tone: string = idx === null ? SKIN_SCALE[1 + (hashString(norm(complexion)) % 8)] : SKIN_SCALE[idx];
  const s = norm(complexion);
  // Undertones nudge the hue without moving the depth.
  if (containsWord(s, "olive")) tone = mix(tone, "#A99A63", 0.14);
  else if (containsWord(s, "cool") || containsWord(s, "rosy") || containsWord(s, "pink")) tone = mix(tone, "#E2A3A0", 0.1);
  else if (containsWord(s, "warm") || containsWord(s, "golden")) tone = mix(tone, "#E0A35E", 0.1);
  return tone;
}

// ---- hair ------------------------------------------------------------------

const HAIR_VOCAB: Vocab<string> = [
  ["black", "#1C1714"], ["jet", "#15120F"], ["jet black", "#121010"], ["raven", "#16141A"], ["blue-black", "#14161D"],
  ["dark brown", "#3A2A20"], ["espresso", "#33241B"], ["deep brown", "#352519"],
  ["brown", "#5A3E2B"], ["brunette", "#583C29"], ["medium brown", "#62452F"], ["mid brown", "#62452F"],
  ["chestnut", "#6E3F24"], ["mahogany", "#5E2C20"],
  ["light brown", "#8A6446"], ["mousy", "#86704F"], ["mousy brown", "#7D6548"],
  ["auburn", "#7E3424"], ["red", "#A8482A"], ["ginger", "#B2552D"], ["copper", "#A9542C"], ["strawberry", "#C9825A"], ["strawberry blonde", "#C9825A"],
  ["dark blonde", "#A7865A"], ["dirty blonde", "#A3845A"],
  ["blonde", "#D2AE6F"], ["blond", "#D2AE6F"], ["golden blonde", "#D6AC62"], ["honey", "#C59A5C"], ["honey blonde", "#C9A061"],
  ["ash blonde", "#BFAE8E"], ["ash", "#9E9178"], ["sandy", "#C3A274"], ["platinum", "#E6DCC6"], ["bleached", "#E3D5B5"],
  ["grey", "#9C9893"], ["gray", "#9C9893"], ["silver", "#BDBBB8"], ["white", "#E8E6E2"],
  ["salt and pepper", "#6F6B67"], ["salt-and-pepper", "#6F6B67"], ["greying", "#7A746D"], ["graying", "#7A746D"],
  ["pink", "#D98BA6"], ["blue", "#4F6FA8"], ["purple", "#7E63A8"], ["lavender", "#A792C9"],
];

const HAIR_FALLBACK = ["#1C1714", "#3A2A20", "#5A3E2B", "#6E3F24", "#8A6446", "#A7865A", "#D2AE6F"] as const;

export function hairColourFor(hairColour: string): string {
  return matchVocab(hairColour, HAIR_VOCAB) ?? pick(HAIR_FALLBACK, norm(hairColour));
}

// ---- eyes ------------------------------------------------------------------

const EYE_VOCAB: Vocab<string> = [
  ["brown", "#4A2F1E"], ["dark brown", "#2E1D13"], ["deep brown", "#2B1B12"], ["light brown", "#6A4628"],
  ["black", "#1E1612"], ["hazel", "#7A5A30"], ["amber", "#9A6A2A"],
  ["green", "#5B7A4A"], ["blue", "#4F7DA8"], ["light blue", "#7EA3C4"], ["grey", "#7D8A93"], ["gray", "#7D8A93"],
  ["blue-grey", "#6E8597"], ["blue-gray", "#6E8597"], ["blue green", "#4F7F7A"], ["blue-green", "#4F7F7A"],
];

export function eyeColourFor(eyeColour: string): string {
  return matchVocab(eyeColour, EYE_VOCAB) ?? pick(["#4A2F1E", "#2E1D13", "#7A5A30", "#4F7DA8", "#5B7A4A"], norm(eyeColour));
}

// ---- hair shape ------------------------------------------------------------

export type HairShape =
  | "bald"
  | "buzz"
  | "short"
  | "crop"
  | "bob"
  | "shoulder"
  | "long"
  | "ponytail"
  | "bun"
  | "curly"
  | "afro"
  | "braids"
  | "locs";

const SHAPE_VOCAB: Vocab<HairShape> = [
  ["bald", "bald"], ["shaved head", "bald"], ["clean-shaven head", "bald"],
  ["buzz", "buzz"], ["buzzed", "buzz"], ["buzz cut", "buzz"], ["shaved", "buzz"], ["fade", "buzz"], ["skin fade", "buzz"], ["crew cut", "buzz"], ["crew", "buzz"],
  ["short", "short"], ["pixie", "short"], ["cropped", "short"], ["undercut", "short"], ["quiff", "short"], ["slicked", "short"], ["side part", "short"], ["side-parted", "short"], ["textured", "short"], ["tousled", "short"],
  ["short curly", "crop"], ["short curls", "crop"], ["tight curls", "crop"], ["twists", "crop"], ["short coils", "crop"],
  ["bob", "bob"], ["lob", "bob"], ["chin-length", "bob"], ["chin length", "bob"],
  // "long" precedes "wavy" so an equal-length tie ("long wavy") reads as length.
  ["long", "long"], ["waist-length", "long"], ["mid-back", "long"], ["straight", "long"], ["flowing", "long"],
  ["shoulder", "shoulder"], ["shoulder-length", "shoulder"], ["shoulder length", "shoulder"], ["wavy", "shoulder"], ["mid-length", "shoulder"], ["medium-length", "shoulder"], ["medium length", "shoulder"],
  ["ponytail", "ponytail"], ["pony", "ponytail"], ["pulled back", "ponytail"], ["tied back", "ponytail"], ["low ponytail", "ponytail"], ["high ponytail", "ponytail"],
  ["bun", "bun"], ["top knot", "bun"], ["topknot", "bun"], ["messy bun", "bun"], ["claw clip", "bun"], ["updo", "bun"],
  ["afro", "afro"], ["natural afro", "afro"],
  ["braids", "braids"], ["braided", "braids"], ["box braids", "braids"], ["cornrows", "braids"], ["plait", "braids"], ["plaits", "braids"],
  ["locs", "locs"], ["dreadlocks", "locs"], ["dreads", "locs"], ["locks", "locs"],
];

export function hairShapeFor(hairStyle: string, gender: CastMember["gender"]): HairShape {
  // Length and style words decide the shape; texture alone ("curly") only
  // decides it when nothing says how long the hair is.
  const found = matchVocab(hairStyle, SHAPE_VOCAB);
  if (found) return found;
  if (isCurlyTexture(hairStyle)) return "curly";
  const fallback: HairShape[] = gender === "male" ? ["short", "buzz", "crop", "short"] : ["long", "shoulder", "bob", "ponytail", "bun"];
  return pick(fallback, norm(hairStyle) || "hair");
}

/** Curly texture modifies how a long/shoulder shape is drawn. */
export function isCurlyTexture(hairStyle: string): boolean {
  const s = norm(hairStyle);
  return ["curly", "curls", "coily", "coils", "kinky", "ringlets", "afro"].some((w) => containsWord(s, w));
}

// ---- marks and wardrobe ----------------------------------------------------

export interface FaceMarks {
  freckles: boolean;
  glasses: boolean;
  beard: "none" | "stubble" | "beard" | "moustache";
  mole: boolean;
  earrings: boolean;
}

export function marksFor(member: Pick<CastMember, "distinguishingMark" | "hairStyle" | "gender">): FaceMarks {
  const s = norm(`${member.distinguishingMark} ${member.hairStyle}`);
  const has = (...ws: string[]) => ws.some((w) => s.includes(w));
  let beard: FaceMarks["beard"] = "none";
  if (has("full beard", "beard", "goatee")) beard = "beard";
  else if (has("stubble", "five o'clock", "scruff")) beard = "stubble";
  else if (has("moustache", "mustache")) beard = "moustache";
  return {
    freckles: has("freckle"),
    glasses: has("glasses", "spectacles", "frames"),
    beard: member.gender === "female" ? "none" : beard,
    mole: has("mole", "beauty mark", "beauty spot"),
    earrings: has("earring", "hoops", "studs", "piercing"),
  };
}

const WARDROBE = [
  "#9EA3A8", // heather grey
  "#2B3A55", // navy
  "#8FA58A", // sage
  "#B8674A", // terracotta
  "#2A2A2E", // black
  "#D8CDBA", // oatmeal
  "#7D98B5", // dusty blue
  "#6D4B63", // plum
  "#6E6F45", // olive
  "#C9A15B", // mustard
] as const;

export function wardrobeColourFor(id: string): string {
  return pick(WARDROBE, `wardrobe:${id}`);
}

export function buildScaleFor(build: string): number {
  const s = norm(build);
  if (["broad", "stocky", "muscular", "heavyset", "solid", "powerful", "sturdy", "curvy"].some((w) => s.includes(w))) return 1.08;
  if (["slim", "lean", "petite", "slight", "wiry", "willowy", "slender", "lanky"].some((w) => s.includes(w))) return 0.93;
  return 1;
}

export interface PersonLook {
  skin: string;
  hair: string;
  eyes: string;
  shape: HairShape;
  curly: boolean;
  marks: FaceMarks;
  top: string;
  buildScale: number;
  gender: CastMember["gender"];
  /** Stable per-person number for small asymmetries (brow tilt, part side). */
  seed: number;
}

export function lookFor(member: CastMember): PersonLook {
  return {
    skin: skinToneFor(member.complexion),
    hair: hairColourFor(member.hairColour),
    eyes: eyeColourFor(member.eyeColour),
    shape: hairShapeFor(member.hairStyle, member.gender),
    curly: isCurlyTexture(member.hairStyle),
    marks: marksFor(member),
    top: wardrobeColourFor(member.id),
    buildScale: buildScaleFor(member.build),
    gender: member.gender,
    seed: hashString(member.id),
  };
}

// ---- settings --------------------------------------------------------------

export type RoomKind =
  | "kitchen"
  | "car"
  | "bedroom"
  | "gym"
  | "outdoor"
  | "track"
  | "living"
  | "bathroom"
  | "office";

export interface SettingLook {
  kind: RoomKind;
  /** Wall gradient, top then bottom. */
  wall: readonly [string, string];
  /** Main furniture/prop colour. */
  prop: string;
  /** Secondary accent in the room (plant, cushion, sign). */
  accent: string;
  /** Key light colour (window, lamp, sky). */
  light: string;
  /** Which side the key light comes from: -1 left, 1 right. */
  lightSide: -1 | 1;
}

const ROOM_VOCAB: Vocab<RoomKind> = [
  ["kitchen", "kitchen"], ["counter", "kitchen"], ["breakfast", "kitchen"],
  ["car", "car"], ["driver", "car"], ["parked", "car"], ["parking", "car"], ["front seat", "car"],
  ["bed", "bedroom"], ["bedroom", "bedroom"],
  ["gym", "gym"], ["weights", "gym"], ["locker", "gym"], ["treadmill", "gym"], ["studio", "gym"],
  ["track", "track"], ["stadium", "track"],
  ["park", "outdoor"], ["trail", "outdoor"], ["outdoor", "outdoor"], ["outdoors", "outdoor"], ["street", "outdoor"], ["sidewalk", "outdoor"], ["beach", "outdoor"], ["forest", "outdoor"], ["path", "outdoor"], ["bridge", "outdoor"], ["waterfront", "outdoor"], ["lakeshore", "outdoor"],
  ["bath", "bathroom"], ["bathroom", "bathroom"], ["mirror", "bathroom"],
  ["office", "office"], ["desk", "office"], ["work", "office"], ["cafe", "office"], ["coffee shop", "office"],
  ["living", "living"], ["living room", "living"], ["couch", "living"], ["sofa", "living"], ["home", "living"], ["hallway", "living"], ["apartment", "living"],
];

const ROOMS: Record<RoomKind, Omit<SettingLook, "kind" | "lightSide">> = {
  kitchen: { wall: ["#EFE6DA", "#D9CBB8"], prop: "#B9A58C", accent: "#7E9A6E", light: "#FFF1DC" },
  car: { wall: ["#5E6670", "#2C3036"], prop: "#3A3E44", accent: "#9BB4C9", light: "#E9F1F8" },
  bedroom: { wall: ["#E7DCD3", "#C9B8AB"], prop: "#EDE6DE", accent: "#B79A8B", light: "#FFE9D2" },
  gym: { wall: ["#4A4D52", "#2B2D31"], prop: "#1F2023", accent: "#C8553D", light: "#F2F4F7" },
  outdoor: { wall: ["#BFD6E6", "#9DB78F"], prop: "#6E8F5E", accent: "#E8D9A6", light: "#FFF7E3" },
  track: { wall: ["#C8DCEA", "#B5543E"], prop: "#B8513A", accent: "#F1EEE8", light: "#FFF6E0" },
  living: { wall: ["#E9E1D6", "#CDBFAE"], prop: "#8C9A8E", accent: "#C99A6B", light: "#FFEBD0" },
  bathroom: { wall: ["#E6EBEC", "#C7D0D2"], prop: "#F4F6F6", accent: "#8FB3B5", light: "#F7FBFF" },
  office: { wall: ["#E4E1DC", "#BDB5AA"], prop: "#8A6F57", accent: "#6F8FA8", light: "#FFF4E6" },
};

const ROOM_ORDER: RoomKind[] = ["kitchen", "living", "bedroom", "car", "gym", "outdoor", "office"];

export function settingLookFor(setting: string): SettingLook {
  const kind = matchVocab(setting, ROOM_VOCAB) ?? pick(ROOM_ORDER, norm(setting) || "room");
  const lightSide: -1 | 1 = hashString(`light:${norm(setting)}`) % 2 === 0 ? -1 : 1;
  return { kind, lightSide, ...ROOMS[kind] };
}
