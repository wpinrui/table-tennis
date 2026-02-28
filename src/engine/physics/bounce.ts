/**
 * Bounce mechanics — what happens when the ball contacts the table surface.
 *
 * The spin vector is a physical angular velocity (rev/s). Friction at the
 * table contact point transfers rotational energy to translational velocity:
 *
 * Surface velocity at contact = ω × (0, 0, -R)  =  (-ωy·R, ωx·R, 0)
 * Friction opposes this sliding → Δvx ∝ +ωy, Δvy ∝ -ωx
 *
 * This correctly gives:
 * - Topspin (ωx > 0 for -Y ball): vy decreases → ball accelerates forward
 * - Backspin (ωx < 0 for -Y ball): vy increases → ball decelerates
 * - Works symmetrically for +Y balls (ωx < 0 for topspin on +Y)
 *
 * Spin magnitude reduced by surface friction (energy transfer to velocity).
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

  // Horizontal velocity modified by spin-surface interaction.
  // Derived from contact-point surface velocity: ω × (0, 0, -R) = (-ωy·R, ωx·R, 0)
  // Friction opposes the surface sliding, so the effect on the ball is:
  //   Δvx = +ωy · friction,  Δvy = -ωx · friction
  // (Ball radius R is absorbed into the surfaceFriction coefficient.)
  const vx = velocity.x + spin.y * surfaceFriction;
  const vy = velocity.y - spin.x * surfaceFriction;

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
