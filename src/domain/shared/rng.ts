/**
 * Deterministic, seedable PRNG (mulberry32).
 *
 * The domain never calls Math.random(). The seed lives in GameState, so every
 * battle is reproducible from a save and trivially unit-testable.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** true with the given probability (0..1). */
  chance(p: number): boolean;
  /** Current seed, to be persisted after use. */
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    get seed() {
      return s;
    },
  };
}
