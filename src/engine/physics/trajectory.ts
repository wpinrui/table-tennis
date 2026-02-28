/**
 * Ball trajectory simulation — Euler integration with gravity, drag, and Magnus effect.
 *
 * Simulates ball flight from paddle contact to landing (table, net, or floor).
 * Detects net crossings, table landings, edge contacts, and out-of-bounds.
 */

import type { Vec3 } from "../types/index.js";
import type { PhysicsConfig } from "./constants.js";
import type { Rng } from "../rng.js";
import { v3add, v3scale, v3cross, v3mag } from "./vec-math.js";
import { applyBounce } from "./bounce.js";

export interface TrajectoryResult {
  /** Highest point of the ball's arc. */
  apex: Vec3;
  /** Where the ball ends up (table surface, net, or floor). */
  landingPosition: Vec3;
  /** Ball velocity at landing. */
  landingVelocity: Vec3;
  /** Ball spin at landing. */
  landingSpin: Vec3;
  /** Whether the ball touched the net during flight. */
  netContact: boolean;
  /** Whether the ball clipped the table edge. */
  edgeContact: boolean;
  /** Whether the ball crossed the net (Y=0) successfully. */
  crossedNet: boolean;
  /** Whether the ball landed on the table surface. */
  landsOnTable: boolean;
  /** Total flight time in seconds. */
  flightTime: number;
}

/**
 * Simulate ball flight from contact point to landing.
 *
 * The simulation uses Euler integration with configurable timestep.
 * Forces: gravity (down), air drag (opposing velocity), Magnus (spin-velocity coupling).
 */
export function simulateFlight(
  startPos: Vec3,
  velocity: Vec3,
  spin: Vec3,
  config: PhysicsConfig,
  rng: Rng,
): TrajectoryResult {
  const dt = config.timestep;
  const halfTable = config.tableLength / 2; // ±137 cm in Y
  const halfWidth = config.tableWidth / 2;  // ±76.25 cm in X

  // Air drag precomputed factor: ½ρCdA
  const ballRadius = config.ballDiameter / 2;
  const ballArea = Math.PI * ballRadius * ballRadius;
  const dragFactor = 0.5 * config.airDensity * config.dragCoefficient * ballArea;
  const magnusFactor = config.magnusCoefficient * config.airDensity * ballArea;

  let pos = { ...startPos };
  let vel = { ...velocity };
  let spn = { ...spin };
  let apex: Vec3 = { ...startPos };
  let netContact = false;
  let edgeContact = false;
  let crossedNet = false;
  let time = 0;

  // Track which side of net the ball started on
  const startSide = Math.sign(startPos.y) || 1; // +1 or -1

  const MAX_STEPS = Math.ceil(config.maxFlightTime / dt);

  for (let step = 0; step < MAX_STEPS; step++) {
    time += dt;

    // --- Compute forces ---

    // Gravity
    const gravity: Vec3 = { x: 0, y: 0, z: -config.gravity };

    // Air drag: F = -dragFactor * |v| * v
    const speed = v3mag(vel);
    const drag = speed > 0
      ? v3scale(vel, -dragFactor * speed / config.ballMass)
      : { x: 0, y: 0, z: 0 };

    // Magnus effect: F = magnusFactor * (ω × v)
    // Convert spin from rev/s to rad/s for cross product
    const spinRad: Vec3 = v3scale(spn, 2 * Math.PI);
    const magnus = v3scale(v3cross(spinRad, vel), magnusFactor / config.ballMass);

    // --- Euler integration ---
    const accel = v3add(v3add(gravity, drag), magnus);
    vel = v3add(vel, v3scale(accel, dt));
    const newPos = v3add(pos, v3scale(vel, dt));

    // --- Track apex ---
    if (newPos.z > apex.z) {
      apex = { ...newPos };
    }

    // --- Net crossing detection (ball crosses Y=0) ---
    if (!crossedNet && Math.sign(newPos.y) !== startSide && Math.sign(newPos.y) !== 0) {
      // Interpolate exact position at Y=0
      const t = Math.abs(pos.y) / (Math.abs(pos.y) + Math.abs(newPos.y));
      const netZ = pos.z + (newPos.z - pos.z) * t;

      if (netZ <= 0) {
        // Ball went below table level at net — into net or floor
        return {
          apex,
          landingPosition: { x: pos.x + (newPos.x - pos.x) * t, y: 0, z: netZ },
          landingVelocity: vel,
          landingSpin: spn,
          netContact: true,
          edgeContact: false,
          crossedNet: false,
          landsOnTable: false,
          flightTime: time,
        };
      }

      if (netZ < config.netHeight) {
        // Ball clips the net
        if (netZ > config.netHeight - config.netContactMargin) {
          // Close enough to clip over — net contact, deflect trajectory
          netContact = true;
          // Reduce vertical and forward velocity (net absorbs energy)
          vel = {
            x: vel.x * config.netClipRetentionX,
            y: vel.y * config.netClipRetentionY,
            z: vel.z * config.netClipRetentionZ,
          };
          crossedNet = true;
        } else {
          // Into the net — point over
          const netX = pos.x + (newPos.x - pos.x) * t;
          return {
            apex,
            landingPosition: { x: netX, y: 0, z: netZ },
            landingVelocity: vel,
            landingSpin: spn,
            netContact: true,
            edgeContact: false,
            crossedNet: false,
            landsOnTable: false,
            flightTime: time,
          };
        }
      } else {
        crossedNet = true;
      }
    }

    // --- Table landing detection (Z ≤ 0 while potentially over table) ---
    if (newPos.z <= 0 && pos.z > 0) {
      // Interpolate exact landing position
      const t = pos.z / (pos.z - newPos.z);
      const landX = pos.x + (newPos.x - pos.x) * t;
      const landY = pos.y + (newPos.y - pos.y) * t;
      const landPos: Vec3 = { x: landX, y: landY, z: 0 };

      // Check if landing is on table
      const onTable =
        Math.abs(landX) <= halfWidth &&
        Math.abs(landY) <= halfTable;

      if (onTable) {
        // Check edge contact
        const distFromEdgeX = halfWidth - Math.abs(landX);
        const distFromEdgeY = halfTable - Math.abs(landY);
        const minEdgeDist = Math.min(distFromEdgeX, distFromEdgeY);

        if (minEdgeDist <= config.edgeContactMargin) {
          edgeContact = true;
          // Edge contact: apply random deflection
          const bounced = applyBounce(vel, spn, config);
          bounced.velocity.x += rng.gaussian(0, config.edgeDeflectionStddevX);
          bounced.velocity.y += rng.gaussian(0, config.edgeDeflectionStddevY);
          bounced.velocity.z *= config.edgeDeflectionMinZRetention + rng.next() * (1 - config.edgeDeflectionMinZRetention);
          vel = bounced.velocity;
          spn = bounced.spin;
        } else {
          // Normal table bounce
          const bounced = applyBounce(vel, spn, config);
          vel = bounced.velocity;
          spn = bounced.spin;
        }

        return {
          apex,
          landingPosition: landPos,
          landingVelocity: vel,
          landingSpin: spn,
          netContact,
          edgeContact,
          crossedNet,
          landsOnTable: true,
          flightTime: time,
        };
      } else {
        // Off table — ball hit the floor or went wide
        return {
          apex,
          landingPosition: landPos,
          landingVelocity: vel,
          landingSpin: spn,
          netContact,
          edgeContact,
          crossedNet,
          landsOnTable: false,
          flightTime: time,
        };
      }
    }

    pos = newPos;
  }

  // Timed out — ball still in the air after MAX_TIME (shouldn't happen)
  return {
    apex,
    landingPosition: pos,
    landingVelocity: vel,
    landingSpin: spn,
    netContact,
    edgeContact,
    crossedNet,
    landsOnTable: false,
    flightTime: time,
  };
}

/**
 * Simulate a serve trajectory. The serve has two phases:
 * 1. Ball goes from server's hand to server's half of the table (first bounce)
 * 2. Ball bounces and flies to the receiver's half
 *
 * Returns the complete trajectory from server contact to final landing.
 */
export function simulateServe(
  startPos: Vec3,
  velocity: Vec3,
  spin: Vec3,
  config: PhysicsConfig,
  rng: Rng,
): TrajectoryResult {
  // Phase 1: simulate to first bounce (should land on server's half)
  const phase1 = simulateFlight(startPos, velocity, spin, config, rng);

  if (!phase1.landsOnTable) {
    // Missed the table entirely — fault
    return phase1;
  }

  // Check if first bounce is on server's half (same Y sign as start)
  const serverSide = Math.sign(startPos.y) || 1;
  const landedOnServerHalf = Math.sign(phase1.landingPosition.y) === serverSide;

  if (!landedOnServerHalf) {
    // Bounced on wrong half — fault (this gets handled by umpire,
    // but we can flag it by returning the trajectory as-is)
    return phase1;
  }

  // Phase 2: continue from bounce to receiver's half
  const phase2 = simulateFlight(
    phase1.landingPosition,
    phase1.landingVelocity,
    phase1.landingSpin,
    config,
    rng,
  );

  // Combine both phases
  return {
    apex: phase1.apex.z > phase2.apex.z ? phase1.apex : phase2.apex,
    landingPosition: phase2.landingPosition,
    landingVelocity: phase2.landingVelocity,
    landingSpin: phase2.landingSpin,
    netContact: phase1.netContact || phase2.netContact,
    edgeContact: phase1.edgeContact || phase2.edgeContact,
    crossedNet: phase2.crossedNet,
    landsOnTable: phase2.landsOnTable,
    flightTime: phase1.flightTime + phase2.flightTime,
  };
}
