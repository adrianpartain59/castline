import { describe, expect, it } from "vitest";
import type { CastMember } from "../contracts";
import { measureLevels, normalizeGain, dbToGain, gainToDb } from "../audio/levels";
import { SOUNDS } from "../audio/sounds";
import { TEMPO_SCREENS } from "../tempo/screens";
import { hashString, luminance } from "./canvas";
import { fitPortrait } from "./frame";
import { layoutHook, wrapText, type MeasureFn } from "./layout";
import {
  SKIN_SCALE,
  eyeColourFor,
  hairColourFor,
  hairShapeFor,
  lookFor,
  marksFor,
  matchVocab,
  settingLookFor,
  skinToneFor,
} from "./looks";
import { pickRecorderFormat } from "./recording";
import { clampTime, cutTime, segmentAt, totalDuration, wrapTime } from "./timeline";

// A monospace measurer: every character is half the font size wide.
const mono: MeasureFn = (s, px) => s.length * px * 0.5;

describe("layoutHook", () => {
  it("keeps a short hook on one line at the largest size", () => {
    const l = layoutHook("POV: you finally hit pace", 1000, mono, { maxFontPx: 60 });
    expect(l.lines).toEqual(["POV: you finally hit pace"]);
    expect(l.fontPx).toBe(60);
    expect(l.truncated).toBe(false);
    expect(l.height).toBeCloseTo(60 * 1.22, 5);
  });

  it("wraps so no line is wider than the box", () => {
    const text = "I did not think an app could fix my marathon pacing but here we are";
    const l = layoutHook(text, 400, mono, { maxFontPx: 40, minFontPx: 20, maxLines: 6 });
    expect(l.lines.length).toBeGreaterThan(1);
    for (const w of l.widths) expect(w).toBeLessThanOrEqual(400);
    expect(l.lines.join(" ")).toBe(text);
  });

  it("shrinks the type before exceeding the line limit", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve";
    const big = layoutHook(text, 300, mono, { maxFontPx: 60, minFontPx: 10, maxLines: 3 });
    expect(big.lines.length).toBeLessThanOrEqual(3);
    expect(big.fontPx).toBeLessThan(60);
    expect(big.truncated).toBe(false);
  });

  it("respects a max height", () => {
    const text = "a long hook that needs several lines to fit in a narrow column of text";
    const l = layoutHook(text, 200, mono, { maxFontPx: 40, minFontPx: 12, maxLines: 10, maxHeight: 100 });
    expect(l.height).toBeLessThanOrEqual(100);
  });

  it("truncates with an ellipsis when even the minimum size cannot fit", () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const l = layoutHook(text, 200, mono, { maxFontPx: 30, minFontPx: 20, maxLines: 2 });
    expect(l.truncated).toBe(true);
    expect(l.lines).toHaveLength(2);
    expect(l.lines[1].endsWith("…")).toBe(true);
    for (const w of l.widths) expect(w).toBeLessThanOrEqual(200);
    expect(l.fontPx).toBe(20);
  });

  it("balances lines instead of leaving a one-word tail", () => {
    // Greedy at width 26 chars: "aaaa bbbb cccc dddd eeee" / "ffff" (one-word tail).
    const text = "aaaa bbbb cccc dddd eeee ffff";
    const greedy = wrapText(text, 26 * 5, 10, mono);
    expect(greedy).toEqual(["aaaa bbbb cccc dddd eeee", "ffff"]);
    const l = layoutHook(text, 26 * 5, mono, { maxFontPx: 10, minFontPx: 10 });
    expect(l.lines).toHaveLength(2);
    expect(l.lines).toEqual(["aaaa bbbb cccc", "dddd eeee ffff"]);
  });

  it("honours explicit line breaks and ignores blank lines", () => {
    const l = layoutHook("first line\n\nsecond", 1000, mono, { maxFontPx: 20, balance: false });
    expect(l.lines).toEqual(["first line", "second"]);
  });

  it("splits a single word wider than the box", () => {
    const l = layoutHook("supercalifragilistic", 50, mono, { maxFontPx: 10, minFontPx: 10, maxLines: 10 });
    for (const w of l.widths) expect(w).toBeLessThanOrEqual(50);
    expect(l.lines.join("")).toBe("supercalifragilistic");
  });

  it("returns an empty layout for empty text", () => {
    const l = layoutHook("   ", 300, mono);
    expect(l.lines).toEqual([]);
    expect(l.height).toBe(0);
  });
});

describe("timeline", () => {
  const spec = { reactionSeconds: 3.2, appSeconds: 3.4 };

  it("adds the two halves", () => {
    expect(totalDuration(spec)).toBeCloseTo(6.6, 9);
    expect(cutTime(spec)).toBe(3.2);
  });

  it("is on the reaction before the cut and the app from the cut frame on", () => {
    expect(segmentAt(spec, 0)).toMatchObject({ segment: "reaction", local: 0 });
    expect(segmentAt(spec, 3.19).segment).toBe("reaction");
    expect(segmentAt(spec, 3.2)).toMatchObject({ segment: "app", local: 0 });
    const late = segmentAt(spec, 5);
    expect(late.segment).toBe("app");
    expect(late.local).toBeCloseTo(1.8, 9);
    expect(late.remaining).toBeCloseTo(1.6, 9);
  });

  it("clamps out-of-range and bad times", () => {
    expect(segmentAt(spec, -2)).toMatchObject({ segment: "reaction", local: 0 });
    expect(segmentAt(spec, 99)).toMatchObject({ segment: "app", local: 3.4, remaining: 0 });
    expect(segmentAt(spec, Number.NaN)).toMatchObject({ segment: "reaction", local: 0 });
  });

  it("treats tiny or invalid halves as the minimum length", () => {
    expect(totalDuration({ reactionSeconds: 0, appSeconds: Number.NaN })).toBe(1);
  });

  it("wraps and clamps the playhead", () => {
    expect(wrapTime(7, 6.6)).toBeCloseTo(0.4, 9);
    expect(wrapTime(-0.5, 6)).toBeCloseTo(5.5, 9);
    expect(wrapTime(3, 0)).toBe(0);
    expect(clampTime(-1, 6)).toBe(0);
    expect(clampTime(9, 6)).toBe(6);
  });
});

describe("placeholder looks", () => {
  it("matches the longest keyword", () => {
    const v = [["brown", 1], ["light brown", 2]] as const;
    expect(matchVocab("Light brown, warm", v)).toBe(2);
    expect(matchVocab("tangerine", [["tan", 1]] as const)).toBeNull();
  });

  it("orders skin tones from light to deep", () => {
    const pale = luminance(skinToneFor("porcelain"));
    const medium = luminance(skinToneFor("medium olive"));
    const deep = luminance(skinToneFor("deep brown"));
    expect(pale).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(deep);
    expect(skinToneFor("fair")).toBe(SKIN_SCALE[1]);
    expect(skinToneFor("medium-deep with warm undertones")).not.toBe(skinToneFor("medium"));
  });

  it("falls back deterministically for unknown words", () => {
    const a = skinToneFor("luminous");
    expect(a).toMatch(/^#[0-9a-f]{6}$/i);
    expect(skinToneFor("luminous")).toBe(a);
    expect(hairColourFor("mysterious")).toBe(hairColourFor("mysterious"));
  });

  it("maps hair and eye words to plausible colours", () => {
    expect(luminance(hairColourFor("platinum blonde"))).toBeGreaterThan(luminance(hairColourFor("jet black")));
    expect(hairColourFor("dark blonde")).not.toBe(hairColourFor("blonde"));
    expect(hairColourFor("Auburn")).toBe(hairColourFor("auburn"));
    expect(eyeColourFor("hazel")).toBe("#7A5A30");
  });

  it("reads hair shape from length before texture", () => {
    expect(hairShapeFor("long wavy hair", "female")).toBe("long");
    expect(hairShapeFor("curly bob", "female")).toBe("bob");
    expect(hairShapeFor("short curly", "male")).toBe("crop");
    expect(hairShapeFor("loose curls", "female")).toBe("curly");
    expect(hairShapeFor("messy bun", "female")).toBe("bun");
    expect(hairShapeFor("buzz cut", "male")).toBe("buzz");
    expect(["short", "buzz", "crop"]).toContain(hairShapeFor("", "male"));
  });

  it("finds marks and never gives women beards", () => {
    expect(marksFor({ distinguishingMark: "light freckles across the nose", hairStyle: "", gender: "female" }).freckles).toBe(true);
    expect(marksFor({ distinguishingMark: "short stubble", hairStyle: "", gender: "male" }).beard).toBe("stubble");
    expect(marksFor({ distinguishingMark: "full beard", hairStyle: "", gender: "female" }).beard).toBe("none");
    expect(marksFor({ distinguishingMark: "thin wire glasses", hairStyle: "", gender: "male" }).glasses).toBe(true);
  });

  it("builds a stable look for a member", () => {
    const member: CastMember = {
      id: "cast-7",
      name: "Maya",
      age: 31,
      gender: "female",
      typeKey: null,
      heritage: "",
      boneStructure: "",
      hairColour: "dark brown",
      hairStyle: "shoulder-length waves",
      eyeColour: "brown",
      complexion: "light olive",
      distinguishingMark: "small mole above the lip",
      build: "lean",
      portraitPrompt: "",
    };
    const a = lookFor(member);
    expect(a).toEqual(lookFor(member));
    expect(a.shape).toBe("shoulder");
    expect(a.marks.mole).toBe(true);
    expect(a.buildScale).toBeLessThan(1);
    expect(a.seed).toBe(hashString("cast-7"));
  });

  it("maps settings to rooms, including the demo's keys", () => {
    expect(settingLookFor("kitchen").kind).toBe("kitchen");
    expect(settingLookFor("car").kind).toBe("car");
    expect(settingLookFor("park").kind).toBe("outdoor");
    expect(settingLookFor("track").kind).toBe("track");
    expect(settingLookFor("gym").kind).toBe("gym");
    expect(settingLookFor("post-run-home").kind).toBe("living");
    expect(settingLookFor("somewhere odd").kind).toBe(settingLookFor("somewhere odd").kind);
  });
});

describe("export format", () => {
  it("prefers MP4/H.264, then VP9 WebM, then any WebM", () => {
    expect(pickRecorderFormat(() => true)?.extension).toBe("mp4");
    expect(pickRecorderFormat((t) => t === "video/mp4;codecs=avc1")?.mimeType).toBe("video/mp4;codecs=avc1");
    expect(pickRecorderFormat((t) => t.startsWith("video/webm"))?.mimeType).toBe("video/webm;codecs=vp9,opus");
    expect(pickRecorderFormat((t) => t === "video/webm")).toEqual({ mimeType: "video/webm", extension: "webm" });
    expect(pickRecorderFormat(() => false)).toBeNull();
    expect(
      pickRecorderFormat(() => {
        throw new Error("nope");
      }),
    ).toBeNull();
  });

  it("fits a 9:16 frame inside any canvas", () => {
    expect(fitPortrait(1080, 1920)).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
    const wide = fitPortrait(1920, 1080);
    expect(wide.h).toBe(1080);
    expect(wide.w).toBe(608);
    expect(wide.x).toBe(656);
  });
});

describe("levels", () => {
  const buf = (data: number[], sampleRate = 4) => ({
    numberOfChannels: 1,
    length: data.length,
    sampleRate,
    getChannelData: () => Float32Array.from(data),
  });

  it("measures RMS and peak", () => {
    const l = measureLevels(buf([0.5, -0.5, 0.5, -0.5]));
    expect(l.rms).toBeCloseTo(0.5, 6);
    expect(l.peak).toBeCloseTo(0.5, 6);
    expect(measureLevels(buf([1, 1, 0, 0]), 0.5).rms).toBe(0);
  });

  it("gains toward the target but never over the peak ceiling", () => {
    const quiet = { rms: dbToGain(-30), peak: dbToGain(-20) };
    const g = normalizeGain(quiet, -16, -1);
    // Target wants +14 dB; the peak allows only +19 dB, so the target wins.
    expect(gainToDb(g)).toBeCloseTo(14, 6);
    const spiky = { rms: dbToGain(-30), peak: dbToGain(-3) };
    expect(gainToDb(normalizeGain(spiky, -16, -1))).toBeCloseTo(2, 6);
    expect(normalizeGain({ rms: 0, peak: 0 }, -16)).toBe(1);
  });
});

describe("catalogues", () => {
  it("lists the three screens and sounds with their labels", () => {
    expect(TEMPO_SCREENS).toEqual([
      { key: "pace", label: "Pace chart" },
      { key: "plan", label: "Weekly plan" },
      { key: "coach", label: "Coach message" },
    ]);
    expect(SOUNDS.map((s) => s.label)).toEqual(["Lo-fi bed", "Upbeat", "Room tone only"]);
  });
});
