/**
 * Spin read & deception system.
 *
 * Computes how well a receiver perceives the incoming ball's spin,
 * based on the sender's deception ability/effort and the receiver's
 * spinRead attribute.
 *
 * Pipeline:
 *   readDifficulty  = f(sender deception attribute, shot deception effort)
 *   readAccuracy    = f(receiver spinRead, readDifficulty)
 *   perceivedSpin   = actualSpin + error(readAccuracy)
 *
 * The player engine receives ACTUAL spin from the physics engine.
 * Spin perception is handled internally — different engine
 * implementations can model perception differently (e.g. a robot
 * engine with perfect spin reading).
 */

import type { Vec3 } from "../types/index.js";
import type { Rng } from "../rng.js";
import type { PlayerEngineConfig } from "./constants.js";
import { clamp, v3mag, v3sub } from "../math/vec-math.js";

/**
 * Compute how difficult the incoming spin is to read.
 *
 * Uses a multiplicative model: both the sender's deception attribute
 * AND the effort on this shot must be high to create real difficulty.
 * This matches the design rule: "high deception + low variation gains
 * little" and "low deception + high variation is readable."
 *
 * @param senderDeception - Sender's deception attribute (0-100).
 * @param deceptionEffort - Deception effort applied to this shot (0-1).
 * @param config - Player engine config.
 * @returns Read difficulty in [0, 1]. Higher = harder to read.
 */
export function computeReadDifficulty(
  senderDeception: number,
  deceptionEffort: number,
  config: PlayerEngineConfig,
): number {
  return clamp(
    (senderDeception / 100) * deceptionEffort * config.readDifficultyScale,
    0,
    1,
  );
}

/**
 * Compute how accurately the receiver reads the incoming spin.
 *
 * Everyone has a base level of spin reading ability (`readAccuracyBase`).
 * The spinRead attribute adds on top. Read difficulty penalises accuracy.
 *
 * @param receiverSpinRead - Receiver's spinRead attribute (0-100).
 * @param readDifficulty - Difficulty of reading the spin (0-1).
 * @param config - Player engine config.
 * @returns Read accuracy in [minReadAccuracy, 1]. Higher = better read.
 */
export function computeReadAccuracy(
  receiverSpinRead: number,
  readDifficulty: number,
  config: PlayerEngineConfig,
): number {
  const base =
    config.readAccuracyBase +
    (receiverSpinRead / 100) * config.readAccuracySpinReadScale;
  const penalized = base - readDifficulty * config.readDifficultyPenalty;
  return clamp(penalized, config.minReadAccuracy, 1);
}

/**
 * Compute the perceived spin from actual spin and read accuracy.
 *
 * Adds Gaussian noise to each component of the actual spin vector,
 * scaled by the error factor (1 − readAccuracy) and the spin magnitude.
 * Stronger spin is harder to precisely quantify, and lower accuracy
 * produces larger errors — at very low accuracy the perceived direction
 * can flip entirely (catastrophic misread).
 *
 * Returns both the perceived spin and a normalised misread magnitude
 * (0 = perfect read, 1 = catastrophic misread).
 *
 * Zero-spin balls are always read correctly — there is nothing to
 * misperceive when there is no spin.
 *
 * @param actualSpin - Actual ball spin vector (rev/s).
 * @param readAccuracy - How accurately the spin is read (0-1).
 * @param rng - Seedable RNG.
 * @param config - Player engine config.
 */
export function computePerceivedSpin(
  actualSpin: Vec3,
  readAccuracy: number,
  rng: Rng,
  config: PlayerEngineConfig,
): { perceivedSpin: Vec3; misread: number } {
  const spinMag = v3mag(actualSpin);

  // No spin → nothing to misread
  if (spinMag < config.spinMisreadEpsilon) {
    return { perceivedSpin: { ...actualSpin }, misread: 0 };
  }

  const errorFactor = 1 - readAccuracy;
  const noiseScale = errorFactor * spinMag * config.spinNoiseStddev;

  const perceivedSpin: Vec3 = {
    x: actualSpin.x + rng.gaussian(0, noiseScale),
    y: actualSpin.y + rng.gaussian(0, noiseScale),
    z: actualSpin.z + rng.gaussian(0, noiseScale),
  };

  // Normalised misread: euclidean distance / spin magnitude, capped at 1
  const errorMag = v3mag(v3sub(perceivedSpin, actualSpin));

  return {
    perceivedSpin,
    misread: clamp(errorMag / spinMag, 0, 1),
  };
}
