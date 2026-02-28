/**
 * Bounce mechanics — what happens when the ball contacts the table surface.
 *
 * Spin-velocity coupling on bounce:
 * - Topspin (positive spin.y) → accelerates forward
 * - Backspin (negative spin.y) → decelerates / kicks back
 * - Sidespin (spin.x) → deflects laterally
 * - Spin magnitude reduced by surface friction
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
  // Topspin (positive spin.y) pushes ball forward on bounce
  // Backspin (negative spin.y) slows/reverses horizontal motion
  // Sidespin (spin.x) deflects laterally
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
