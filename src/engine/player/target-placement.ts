/**
 * Target position computation for rally shots and serves.
 *
 * All coordinates in cm, origin at table center.
 * The player's side is determined by the sign of playerY:
 *   +Y player targets -Y half (opponent's side)
 *   -Y player targets +Y half (opponent's side)
 */

import type { Vec2 } from "../types/index.js";
import type { Rng } from "../rng.js";
import type { PlayerEngineConfig } from "./constants.js";
import { clamp } from "../math/vec-math.js";

/** Compute target Y magnitude from a depth bias (0=short, 1=deep). */
function computeDepthY(
  depthBias: number,
  targetSign: number,
  config: PlayerEngineConfig,
): number {
  const shortY = config.shortDepthFraction * config.tableHalfLength;
  const deepY = config.deepDepthFraction * config.tableHalfLength;
  const depthMag = shortY + depthBias * (deepY - shortY);
  return targetSign * depthMag;
}

/** Clamp a target position to the valid table area on one half. */
function clampToTableHalf(
  x: number,
  y: number,
  targetSign: number,
  config: PlayerEngineConfig,
): Vec2 {
  const clampedX = clamp(x, -config.tableHalfWidth, config.tableHalfWidth);
  const clampedY =
    targetSign < 0
      ? clamp(y, -config.tableHalfLength, 0)
      : clamp(y, 0, config.tableHalfLength);
  return { x: clampedX, y: clampedY };
}

/**
 * Compute target position on the opponent's half of the table.
 *
 * @param depthBias - Mapped depth tendency (0-1). 0=short, 1=deep.
 * @param riskFactor - Effective risk tolerance (0-1). Higher=tighter margins.
 * @param opponentPosition - Opponent's court position.
 * @param playerY - This player's Y position (sign determines which half to target).
 * @param rng - Seedable RNG.
 * @param config - Player engine config.
 * @returns Target position in table coordinates (cm).
 */
export function computeTargetPosition(
  depthBias: number,
  riskFactor: number,
  opponentPosition: Vec2,
  playerY: number,
  rng: Rng,
  config: PlayerEngineConfig,
): Vec2 {
  // Target the opposite half from the player
  const targetSign = playerY >= 0 ? -1 : 1;

  // --- Depth (Y) ---
  let targetY = computeDepthY(depthBias, targetSign, config);

  // --- Width (X) ---
  // Edge margin narrows with higher risk
  const effectiveMargin =
    config.safeMargin - riskFactor * (config.safeMargin - config.minEdgeMargin);
  const maxX = config.tableHalfWidth - effectiveMargin;

  // Bias away from opponent's X position
  const oppX = opponentPosition.x;
  const targetSide = oppX >= 0 ? -1 : 1;
  const baseX = targetSide * maxX * config.opponentAvoidanceWeight;
  const randomX = rng.gaussian(0, maxX * config.targetWidthNoiseScale);
  let targetX = baseX + randomX;

  // Per-shot jitter
  targetX += rng.gaussian(0, config.targetJitterStddev);
  targetY += targetSign * rng.gaussian(0, config.targetJitterStddev);

  return clampToTableHalf(targetX, targetY, targetSign, config);
}

/**
 * Compute serve target position on the receiver's half.
 *
 * @param lengthTendency - Mapped serve length tendency (0-1). 0=short, 1=long.
 * @param riskFactor - Mapped serve risk (0-1).
 * @param playerY - Server's Y position (sign determines which half to target).
 * @param rng - Seedable RNG.
 * @param config - Player engine config.
 * @returns Target position on the receiver's half (opposite from server).
 */
export function computeServeTarget(
  lengthTendency: number,
  riskFactor: number,
  playerY: number,
  rng: Rng,
  config: PlayerEngineConfig,
): Vec2 {
  // Target the opposite half from the server
  const targetSign = playerY >= 0 ? -1 : 1;

  let targetY = computeDepthY(lengthTendency, targetSign, config);

  // Width: use serve-specific range
  const maxX = config.tableHalfWidth * config.serveWidthRange;
  const effectiveMargin =
    config.safeMargin - riskFactor * (config.safeMargin - config.minEdgeMargin);
  const effectiveMaxX = Math.min(maxX, config.tableHalfWidth - effectiveMargin);

  // Random X placement within range
  let targetX = rng.gaussian(0, effectiveMaxX * config.serveWidthNoiseScale);

  // Per-shot jitter
  targetX += rng.gaussian(0, config.serveJitterStddev);
  targetY += targetSign * rng.gaussian(0, config.serveJitterStddev);

  return clampToTableHalf(targetX, targetY, targetSign, config);
}
