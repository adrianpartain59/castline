/**
 * Randomness for the engine — seeded, so every cast and every batch of takes
 * is reproducible from one number.
 *
 * The real pipeline injected `rng` everywhere (defaulting to Math.random) so
 * its tests could be deterministic. Castline goes one step further and makes
 * the seed part of the public API: the demo studio can show "seed 4182" and
 * deal the exact same eight people again, which is the property a reviewer
 * actually wants to poke at.
 */

export type Rng = () => number;

/**
 * mulberry32 — a tiny, fast 32-bit PRNG. Not cryptographic and not meant to
 * be; it only has to be well-distributed and identical in every browser.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates. Mutates and returns `list`; `rng` is injected for tests. */
export function shuffle<T>(list: T[], rng: Rng): T[] {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.min(rng(), 0.9999999) * (i + 1));
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

/**
 * Deal `count` values from a shuffled deck, reshuffling only once the deck is
 * empty — the same argument assignCast already makes for faces, applied to
 * every other axis.
 *
 * Rolling rng() per take is independent per take, so at these pool sizes
 * collisions are the normal outcome, not an edge case: eight takes drawn
 * independently from six wardrobe options repeat a value ~95% of the time and
 * land three-of-a-kind often. That is why a batch used to read as one person
 * in one room even when the axes were wide. Dealing guarantees every option
 * appears once before any appears twice.
 *
 * The reshuffle refuses to re-deal the value that just landed, so the deck
 * boundary can never produce a back-to-back pair.
 */
export function dealDeck<T>(values: readonly T[], count: number, rng: Rng): T[] {
  const dealt: T[] = [];
  if (!values.length) return dealt;
  let deck: T[] = [];
  while (dealt.length < count) {
    if (!deck.length) {
      deck = shuffle(values.slice(), rng);
      if (dealt.length && deck.length > 1 && deck[0] === dealt[dealt.length - 1]) {
        const swap = deck[0];
        deck[0] = deck[1];
        deck[1] = swap;
      }
    }
    dealt.push(deck.shift() as T);
  }
  return dealt;
}

/** A whole number in [min, max], inclusive. */
export function intBetween(min: number, max: number, rng: Rng): number {
  return min + Math.floor(Math.min(rng(), 0.9999999) * (max - min + 1));
}
