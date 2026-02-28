/**
 * Serve decision algorithm.
 *
 * Translates a ServeContext into a ServeIntention using the player's
 * serve tendencies, capabilities, and attributes.
 */

import type { ServeContext, ServeIntention } from "../types/index.js";
import type { Rng } from "../rng.js";
import type { PlayerEngineConfig } from "./constants.js";
import { clamp } from "../physics/vec-math.js";
import {
  mapTendency,
  mapTendencyWithRisk,
  adjustRiskForPressure,
  computeDeceptionEffort,
} from "./tendency-mapper.js";
import { selectSide } from "./side-selection.js";
import { computeServeTarget } from "./target-placement.js";

/**
 * Decide a serve based on context and serve tendencies.
 *
 * Steps:
 * 1. Compute effective risk (base tendency + pressure)
 * 2. Select paddle side (both available for serves)
 * 3. Map power, spin intensity, spin direction, target, clearance, deception
 */
export function decideServe(
  context: ServeContext,
  rng: Rng,
  config: PlayerEngineConfig,
): ServeIntention {
  const { serveTendencies: tendencies, attributes } = context.player;

  // --- Step 1: Effective Risk ---
  let effectiveRisk = mapTendency(tendencies.risk, rng, config);
  effectiveRisk = adjustRiskForPressure(
    effectiveRisk,
    context.matchState,
    attributes.mental,
    config,
  );

  // --- Step 2: Side Selection ---
  // Both sides available for serves
  const side = selectSide(
    ["forehand", "backhand"],
    context.player.strokeCapabilities,
    rng,
    config,
  );

  // --- Step 3: Power ---
  const power = mapTendencyWithRisk(
    tendencies.speed,
    effectiveRisk,
    rng,
    config,
  );

  // --- Step 4: Spin Intensity ---
  const spinIntensity = mapTendencyWithRisk(
    tendencies.spinAmount,
    effectiveRisk,
    rng,
    config,
  );

  // --- Step 5: Spin Direction ---
  // backspinBias: 0=topspin, 50=mixed, 100=backspin
  // Map to topspin axis: 0→+1, 50→0, 100→-1
  const topspinBase = (50 - tendencies.backspinBias) / 50;
  // spinVariation controls per-serve noise on direction
  const variationScale = tendencies.spinVariation / 100;
  const topspin = clamp(
    topspinBase + rng.gaussian(0, variationScale * config.serveTopspinVariationScale),
    -1,
    1,
  );

  // sidespinBias: magnitude, random sign per serve
  const sidespinBase = tendencies.sidespinBias / 100;
  const sidespinSign = rng.next() > 0.5 ? 1 : -1;
  const sidespin = clamp(
    sidespinBase * sidespinSign + rng.gaussian(0, variationScale * config.serveSidespinVariationScale),
    -1,
    1,
  );

  // --- Step 6: Target Position ---
  const lengthMapped = mapTendency(tendencies.length, rng, config);
  const targetPosition = computeServeTarget(
    lengthMapped,
    effectiveRisk,
    rng,
    config,
  );

  // --- Step 7: Net Clearance ---
  // Serves typically skim the net. Higher risk = lower clearance.
  let netClearance =
    config.minNetClearance +
    (1 - effectiveRisk) * (config.maxServeNetClearance - config.minNetClearance);
  netClearance += rng.gaussian(0, config.serveClearanceNoiseStddev);
  netClearance = Math.max(config.minNetClearance, netClearance);

  // --- Step 8: Deception Effort ---
  const deceptionEffort = computeDeceptionEffort(
    attributes.deception,
    effectiveRisk,
    rng,
    config,
  );

  return {
    side,
    power,
    spinIntensity,
    spinDirection: { topspin, sidespin },
    targetPosition,
    netClearance,
    deceptionEffort,
  };
}
