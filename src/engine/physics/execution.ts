/**
 * Execution quality computation and error model.
 *
 * Execution quality (0-1) represents how well a player executes their
 * intended shot. Degraded by positional deficit, time pressure, and risk.
 *
 * The error model applies Gaussian noise to intended shot properties,
 * scaled by (1 - quality). Higher risk → lower quality → wider error.
 */

import type { Vec3 } from "../types/index.js";
import type { PhysicsConfig } from "./constants.js";
import type { Rng } from "../rng.js";
import { clamp } from "./vec-math.js";

/**
 * Compute execution quality (0-1) for a rally shot.
 *
 * @param consistency - Player's base consistency for this side (0-100)
 * @param positionalDeficit - How far from ideal contact point (0-1)
 * @param timeAvailable - Seconds available to prepare
 * @param riskLevel - How close to ceilings (0-1), max of power/spin fractions
 * @param config - Physics config for weight tuning
 */
export function computeExecutionQuality(
  consistency: number,
  positionalDeficit: number,
  timeAvailable: number,
  riskLevel: number,
  config: PhysicsConfig,
): number {
  const baseQuality = consistency / 100;

  const timePressure = 1 - clamp(timeAvailable / config.comfortableTime, 0, 1);

  const quality =
    baseQuality *
    (1 - positionalDeficit * config.positionWeight) *
    (1 - timePressure * config.timePressureWeight) *
    (1 - riskLevel * config.riskWeight);

  return clamp(quality, 0, 1);
}

/**
 * Compute execution quality for a serve.
 * No positional deficit or time pressure — quality based on service skill + risk.
 *
 * @param serviceSkill - Player's service attribute (0-100)
 * @param consistency - Player's stroke consistency for the serve side (0-100)
 * @param riskLevel - How close to ceilings (0-1)
 * @param config - Physics config for weight tuning
 */
export function computeServeQuality(
  serviceSkill: number,
  consistency: number,
  riskLevel: number,
  config: PhysicsConfig,
): number {
  // Serve quality blends service skill and consistency
  const baseQuality = ((serviceSkill / 100) + (consistency / 100)) / 2;
  const quality = baseQuality * (1 - riskLevel * config.riskWeight);
  return clamp(quality, 0, 1);
}

export interface ErrorResult {
  velocity: Vec3;
  spin: Vec3;
}

/**
 * Apply error to intended shot properties based on execution quality.
 *
 * @param intendedVelocity - Intended ball velocity (cm/s)
 * @param intendedSpin - Intended ball spin (rev/s)
 * @param quality - Execution quality (0-1)
 * @param accuracy - Player's accuracy for this side (0-100)
 * @param config - Physics config
 * @param rng - Seedable RNG
 * @returns Actual velocity and spin after error application
 */
export function applyError(
  intendedVelocity: Vec3,
  intendedSpin: Vec3,
  quality: number,
  accuracy: number,
  config: PhysicsConfig,
  rng: Rng,
): ErrorResult {
  const errorScale = 1 - quality;
  const accuracyFactor = 1 - accuracy / 100;

  // Accuracy lerps from accuracyErrorFloor (at accuracy=100) to 1.0 (at accuracy=0),
  // so even a perfectly executing player has a minimum error floor.
  const accuracyMultiplier = config.accuracyErrorFloor + (1 - config.accuracyErrorFloor) * accuracyFactor;

  // Angular deviation on velocity direction (radians)
  const angularErrorScale = config.baseErrorStddev * errorScale * accuracyMultiplier;
  const angleError = rng.gaussian(0, angularErrorScale);
  const elevationError = rng.gaussian(0, angularErrorScale * config.elevationErrorScale);

  // Rotate velocity by angular error (simplified: apply to x/y components)
  const cosA = Math.cos(angleError);
  const sinA = Math.sin(angleError);
  const cosE = Math.cos(elevationError);
  const sinE = Math.sin(elevationError);

  const velocity: Vec3 = {
    x: intendedVelocity.x * cosA - intendedVelocity.y * sinA,
    y: intendedVelocity.x * sinA + intendedVelocity.y * cosA,
    z: intendedVelocity.z * cosE + Math.sqrt(intendedVelocity.x ** 2 + intendedVelocity.y ** 2) * sinE,
  };

  // Spin magnitude error (percentage deviation)
  const spinError = 1 + rng.gaussian(0, errorScale * config.spinErrorScale);
  const spin: Vec3 = {
    x: intendedSpin.x * spinError,
    y: intendedSpin.y * spinError,
    z: intendedSpin.z * spinError,
  };

  return { velocity, spin };
}
