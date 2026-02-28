/**
 * Seedable pseudo-random number generator.
 * Uses xoshiro128** for fast, high-quality 32-bit random numbers.
 * Deterministic: same seed always produces the same sequence.
 */

export interface Rng {
  /** Returns a uniform random number in [0, 1). */
  next(): number;
  /** Returns a Gaussian-distributed random number (Box-Muller transform). */
  gaussian(mean: number, stddev: number): number;
}

/** Splitmix32 — used to seed xoshiro128** from a single integer. */
function splitmix32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  // Initialize xoshiro128** state from seed using splitmix32
  const sm = splitmix32(seed);
  let s0 = (sm() * 4294967296) >>> 0;
  let s1 = (sm() * 4294967296) >>> 0;
  let s2 = (sm() * 4294967296) >>> 0;
  let s3 = (sm() * 4294967296) >>> 0;

  function next(): number {
    const result = (Math.imul(rotl(Math.imul(s1, 5), 7), 9)) >>> 0;
    const t = s1 << 9;

    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);

    return result / 4294967296;
  }

  // Box-Muller: spare value cached for efficiency
  let hasSpare = false;
  let spare = 0;

  function gaussian(mean: number, stddev: number): number {
    if (hasSpare) {
      hasSpare = false;
      return mean + stddev * spare;
    }

    let u: number, v: number, s: number;
    do {
      u = next() * 2 - 1;
      v = next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);

    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    hasSpare = true;
    return mean + stddev * u * mul;
  }

  return { next, gaussian };
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}
