/**
 * Rally shot decision algorithm.
 *
 * Translates a ShotContext into a ShotIntention using the player's
 * stroke tendencies, capabilities, and attributes. Per-shot variation
 * comes from the seedable RNG.
 */

import type { ShotContext, ShotIntention } from "../types/index.js";
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
import { computeTargetPosition } from "./target-placement.js";

/**
 * Decide a rally shot based on context and player tendencies.
 *
 * Steps:
 * 1. Compute effective risk (base tendency + pressure + positional safety)
 * 2. Select paddle side
 * 3. Map power, spin, direction, target, clearance, deception
 * 4. Compute recovery target
 */
export function decideShot(
  context: ShotContext,
  rng: Rng,
  config: PlayerEngineConfig,
): ShotIntention {
  const { strokeTendencies: tendencies, attributes } = context.player;
  const arrival = context.arrival;

  // --- Step 1: Effective Risk ---
  let effectiveRisk = mapTendency(tendencies.riskTolerance, rng, config);
  effectiveRisk = adjustRiskForPressure(
    effectiveRisk,
    context.matchState,
    attributes.mental,
    config,
  );

  // Positional safety: when stretched, play safer
  if (arrival.positionalDeficit > config.safetyDeficitThreshold) {
    const deficit =
      (arrival.positionalDeficit - config.safetyDeficitThreshold) /
      (1 - config.safetyDeficitThreshold);
    effectiveRisk *= 1 - deficit * config.deficitRiskReduction;
  }

  effectiveRisk = clamp(effectiveRisk, 0, 1);

  // --- Step 2: Side Selection ---
  const side = selectSide(
    arrival.availableSides,
    context.player.strokeCapabilities,
    rng,
    config,
  );

  // --- Step 3: Power ---
  const power = mapTendencyWithRisk(
    tendencies.powerBias,
    effectiveRisk,
    rng,
    config,
  );

  // --- Step 4: Spin Intensity ---
  const spinIntensity = mapTendencyWithRisk(
    tendencies.spinIntensity,
    effectiveRisk,
    rng,
    config,
  );

  // --- Step 5: Spin Direction ---
  // topspinBias: 0=backspin dominant, 50=flat, 100=topspin dominant → [-1, 1]
  const topspinBase = (tendencies.topspinBias - 50) / 50;
  const topspin = clamp(topspinBase + rng.gaussian(0, 0.1), -1, 1);

  // sidespinUsage: magnitude with random direction per shot
  const sidespinMag = tendencies.sidespinUsage / 100;
  const sidespin = clamp(sidespinMag * rng.gaussian(0, 0.7), -1, 1);

  // --- Step 6: Target Position ---
  const depthMapped = mapTendency(tendencies.depthBias, rng, config);
  const targetPosition = computeTargetPosition(
    depthMapped,
    effectiveRisk,
    context.opponentPosition,
    context.playerPosition.y,
    rng,
    config,
  );

  // --- Step 7: Net Clearance ---
  const netClearanceBase = tendencies.netClearance / 100;
  let netClearanceCm =
    config.minNetClearance +
    netClearanceBase * (config.maxNetClearance - config.minNetClearance);
  // Risk reduces clearance (aggressive players skim the net more)
  netClearanceCm *= 1 - effectiveRisk * 0.3;
  netClearanceCm += rng.gaussian(0, 1.0);
  netClearanceCm = Math.max(config.minNetClearance, netClearanceCm);

  // --- Step 8: Deception Effort ---
  const deceptionEffort = computeDeceptionEffort(
    attributes.deception,
    effectiveRisk,
    rng,
    config,
  );

  // --- Step 9: Recovery Target ---
  const playerEndSign = context.playerPosition.y >= 0 ? 1 : -1;
  const readyY = playerEndSign * config.readyPositionDepth;
  // Anticipate return: shift slightly opposite to where we aimed
  const anticipateX =
    -targetPosition.x * config.recoveryAnticipationFraction;
  const recoveryTarget = { x: anticipateX, y: readyY };

  return {
    side,
    power,
    spinIntensity,
    spinDirection: { topspin, sidespin },
    targetPosition,
    netClearance: netClearanceCm,
    deceptionEffort,
    recoveryTarget,
  };
}
