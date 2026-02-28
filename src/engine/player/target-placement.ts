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
import { clamp } from "../physics/vec-math.js";

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
  const shortY = config.shortDepthFraction * config.tableHalfLength;
  const deepY = config.deepDepthFraction * config.tableHalfLength;
  const depthMag = shortY + depthBias * (deepY - shortY);
  let targetY = targetSign * depthMag;

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

  // Clamp to valid table area on opponent's half
  targetX = clamp(targetX, -config.tableHalfWidth, config.tableHalfWidth);
  if (targetSign < 0) {
    targetY = clamp(targetY, -config.tableHalfLength, 0);
  } else {
    targetY = clamp(targetY, 0, config.tableHalfLength);
  }

  return { x: targetX, y: targetY };
}

/**
 * Compute serve target position on the receiver's half.
 *
 * @param lengthTendency - Mapped serve length tendency (0-1). 0=short, 1=long.
 * @param riskFactor - Mapped serve risk (0-1).
 * @param rng - Seedable RNG.
 * @param config - Player engine config.
 * @returns Target position on receiver's half (always -Y, server is at +Y).
 */
export function computeServeTarget(
  lengthTendency: number,
  riskFactor: number,
  rng: Rng,
  config: PlayerEngineConfig,
): Vec2 {
  // Server is always at +Y, so serves target -Y half
  const shortY = config.shortDepthFraction * config.tableHalfLength;
  const deepY = config.deepDepthFraction * config.tableHalfLength;
  const depthMag = shortY + lengthTendency * (deepY - shortY);
  let targetY = -depthMag;

  // Width: use serve-specific range
  const maxX = config.tableHalfWidth * config.serveWidthRange;
  const effectiveMargin =
    config.safeMargin - riskFactor * (config.safeMargin - config.minEdgeMargin);
  const effectiveMaxX = Math.min(maxX, config.tableHalfWidth - effectiveMargin);

  // Random X placement within range
  let targetX = rng.gaussian(0, effectiveMaxX * config.serveWidthNoiseScale);

  // Per-shot jitter
  targetX += rng.gaussian(0, config.serveJitterStddev);
  targetY += rng.gaussian(0, config.serveJitterStddev);

  // Clamp
  targetX = clamp(targetX, -config.tableHalfWidth, config.tableHalfWidth);
  targetY = clamp(targetY, -config.tableHalfLength, 0);

  return { x: targetX, y: targetY };
}
