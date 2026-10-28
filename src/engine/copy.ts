/**
 * UGC Lab overlay copy — the default lines the two text fields offer in a
 * dropdown. Starting points, not a fixed menu: the editor stays free text and
 * picking a line only fills the box.
 *
 * TWO SLOTS, and they are written as a pair.
 *
 *   HOOK   — burned over the reaction half. Opens a gap.
 *   PAYOFF — appears as the screen recording starts. Closes it.
 *
 * The screen recording is the point of the second half, so payoff lines are
 * two to six words. A hook that opens a guesswork gap wants a payoff that
 * closes one; `closes` records which hooks each payoff answers so the editor
 * can suggest sensibly later, and so nobody deletes the last closer for a
 * whole family of hooks without noticing.
 *
 * VOICE comes from the lines Adrian actually wrote in the real editor
 * (2026-09-08): lower case, run-on, genuine reaction energy, doubled
 * punctuation. Everything here imitates them, rewritten for Tempo — a
 * fictional running app with a pace coach and a training plan.
 *
 * TWO STANDING RULES, both load-bearing rather than stylistic:
 *
 *   1. NEVER assert the viewer's body or fitness. Ad platforms' personal
 *      attributes policies forbid copy that implies we know something about
 *      the viewer, so every line is first person or conditional. "I've been
 *      running for three years and..." is fine; "You're out of shape and..."
 *      is not. Knowledge and behaviour only, never their body.
 *   2. NEVER promise a result. Personal results stay personal — the app ends
 *      guessing, it does not deliver an outcome. This is why "run a sub-4
 *      marathon" is not in the list and "no more made-up paces" is: one claims
 *      an outcome, the other describes a behaviour that stopped.
 */

export interface HookLine {
  text: string;
  angle: "discovery" | "guesswork" | "pace" | "plan" | "numbered_mistakes";
}

/** Hook lines: burned over the reaction half, at yPct 32 by default. */
export const HOOK_LINES: HookLine[] = [
  { text: "POV: my coach saw my splits", angle: "pace" },
  { text: "can someone please explain why I'm only finding this now after 3 years of running??", angle: "discovery" },
  { text: "three years of guessing my long-run pace and this existed the whole time", angle: "guesswork" },
  { text: "me finding out my easy runs were never actually easy", angle: "pace" },
  { text: "how is this not the first thing they tell you when you sign up for a half", angle: "discovery" },
  { text: "I was making up my marathon plan week to week and calling it a plan", angle: "plan" },
  { text: "stop planning your training block in your notes app", angle: "plan" },
  { text: "nobody in my run club is talking about this", angle: "discovery" },
  { text: "the app that tells me how fast to run today. that's it. that's the post.", angle: "pace" },
  { text: "if you're training for your first marathon you need to see this", angle: "plan" },
  { text: "three things I wish I knew before my first half marathon", angle: "numbered_mistakes" },
];

/**
 * Payoff lines: appear as the screen recording starts, at yPct 12 by default
 * (Adrian, 2026-09-08: "at the top but you should be able to adjust it").
 * Short on purpose — the recording is the focus and the caption is not.
 */
export const PAYOFF_LINES: { text: string; closes: HookLine["angle"][] }[] = [
  { text: "this app literally does everything!!!", closes: ["discovery"] },
  { text: "no more made-up paces", closes: ["pace", "guesswork"] },
  { text: "it just tells you", closes: ["pace", "guesswork"] },
  { text: "the whole plan, done", closes: ["plan"] },
  { text: "why did nobody tell me this", closes: ["discovery"] },
  { text: "I was making all three", closes: ["numbered_mistakes"] },
];

/** Longest a payoff may be before it stops being a caption. */
export const MAX_PAYOFF_WORDS = 6;

/** Default vertical position per slot, as a percentage of frame height. */
export const DEFAULT_Y_PCT = { hook: 32, payoff: 12 } as const;

export const HOOKS: string[] = HOOK_LINES.map((line) => line.text);
export const PAYOFFS: string[] = PAYOFF_LINES.map((line) => line.text);
