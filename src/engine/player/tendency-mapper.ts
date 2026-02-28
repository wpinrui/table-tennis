/**
 * Maps player tendencies (0-100 scale) to shot parameters (0-1 scale)
 * with per-shot Gaussian variation for natural shot-to-shot diversity.
 */

import type { Rng } from "../rng.js";
import type { PlayerEngineConfig } from "./constants.js";
import { clamp } from "../physics/vec-math.js";

/**
 * Map a 0-100 tendency to a 0-1 parameter with per-shot Gaussian variation.
 *
 * @param tendency - Base tendency value (0-100)
 * @param rng - Seedable RNG
 * @param config - Player engine config (for stddev)
 * @returns Value in [0, 1]
 */
export function mapTendency(
  tendency: number,
  rng: Rng,
  config: PlayerEngineConfig,
): number {
  const base = tendency / 100;
  const variation = rng.gaussian(0, config.tendencyVariationStddev);
  return clamp(base + variation, 0, 1);
}

/**
 * Map a tendency with a risk modifier. Higher risk pushes the value
 * further from 0.5 (amplifies the player's natural tendency).
 *
 * @param tendency - Base tendency (0-100)
 * @param riskFactor - Effective risk tolerance (0-1)
 * @param rng - Seedable RNG
 * @param config - Player engine config
 * @returns Value in [0, 1]
 */
export function mapTendencyWithRisk(
  tendency: number,
  riskFactor: number,
  rng: Rng,
  config: PlayerEngineConfig,
): number {
  const base = tendency / 100;
  // Risk amplifies tendency away from center:
  // a powerBias of 0.7 at high risk pushes toward ~0.76
  const amplified = base + (base - 0.5) * riskFactor * config.riskAmplification;
  const variation = rng.gaussian(0, config.tendencyVariationStddev);
  return clamp(amplified + variation, 0, 1);
}
