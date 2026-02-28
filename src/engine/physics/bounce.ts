/**
 * Bounce mechanics — what happens when the ball contacts the table surface.
 *
 * Spin-velocity coupling on bounce:
 * - spin.y > 0 → adds to velocity.y (accelerates a +Y ball, decelerates a -Y ball)
 * - spin.y < 0 → subtracts from velocity.y (accelerates a -Y ball, decelerates a +Y ball)
 * - spin.x → deflects laterally
 * - Spin magnitude reduced by surface friction
 *
 * NOTE: The spin vector's relationship to "topspin"/"backspin" depends on the
 * ball's travel direction. See GitHub issue for spin convention details.
 */

import type { Vec3 } from "../types/index.js";
import type { PhysicsConfig } from "./constants.js";

export interface BounceResult {
  velocity: Vec3;
  spin: Vec3;
}

/**
 * Apply table bounce physics. Call when ball contacts table surface (Z ≈ 0).
 *
 * @param velocity - Ball velocity at moment of table contact
 * @param spin - Ball spin at moment of table contact (rev/s)
 * @param config - Physics config for restitution and friction values
 * @returns New velocity and spin after bounce
 */
export function applyBounce(
  velocity: Vec3,
  spin: Vec3,
  config: PhysicsConfig,
): BounceResult {
  const { restitution, surfaceFriction } = config;

  // Vertical velocity: reverse and reduce by coefficient of restitution
  const vz = -velocity.z * restitution;

  // Horizontal velocity modified by spin-surface interaction
  // spin.y adds directly to velocity.y (sign determines direction)
  // spin.x deflects laterally
  const spinEffect = surfaceFriction;
  const vx = velocity.x + spin.x * spinEffect;
  const vy = velocity.y + spin.y * spinEffect;

  // Spin reduced by surface friction (energy transfer to velocity)
  const spinRetention = 1 - surfaceFriction;
  const newSpin: Vec3 = {
    x: spin.x * spinRetention,
    y: spin.y * spinRetention,
    z: spin.z * spinRetention,
  };

  return {
    velocity: { x: vx, y: vy, z: vz },
    spin: newSpin,
  };
}
