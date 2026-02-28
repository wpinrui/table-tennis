/**
 * Forehand/backhand selection logic.
 *
 * Picks the paddle side based on capability scores with a random
 * perturbation so choices aren't perfectly deterministic.
 */

import type { StrokeSide, StrokeCapabilities } from "../types/index.js";
import type { Rng } from "../rng.js";
import type { PlayerEngineConfig } from "./constants.js";

/**
 * Select which paddle side to use from the available sides.
 *
 * If only one side is available, returns it.
 * Otherwise scores each side by capability average (power + spin + accuracy
 * + consistency) weighted by `strongSidePreferenceWeight`, plus a random
 * component. The higher-scoring side wins.
 */
export function selectSide(
  availableSides: StrokeSide[],
  capabilities: StrokeCapabilities,
  rng: Rng,
  config: PlayerEngineConfig,
): StrokeSide {
  if (availableSides.length === 1) return availableSides[0];

  const prefWeight = config.strongSidePreferenceWeight;

  function sideScore(side: StrokeSide): number {
    const caps = capabilities[side];
    const base =
      (caps.powerCeiling + caps.spinCeiling + caps.accuracy + caps.consistency) / 4;
    return base * prefWeight + rng.next() * (1 - prefWeight) * 100;
  }

  const fhScore = sideScore("forehand");
  const bhScore = sideScore("backhand");

  return fhScore >= bhScore ? "forehand" : "backhand";
}
