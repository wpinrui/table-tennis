/**
 * Physics configuration — every balance-affecting value lives here.
 *
 * To tweak balance:
 * 1. Edit DEFAULT_PHYSICS_CONFIG below, or
 * 2. Pass Partial<PhysicsConfig> overrides to the DefaultPhysicsEngine constructor.
 *
 * No magic numbers anywhere else in the physics code.
 */

import type { RubberType } from "../types/index.js";

export interface RubberTypeModifier {
  /** Multiplier on outgoing spin generation (1.0 = full). */
  spinGeneration: number;
  /** Multiplier on outgoing speed (1.0 = full). */
  speedGeneration: number;
  /** How much incoming spin is reversed on contact (0 = none, 1 = full reversal). */
  spinReversal: number;
  /** How much incoming spin is absorbed/deadened (0 = none, 1 = fully killed). */
  spinAbsorption: number;
}

export interface PhysicsConfig {
  // --- Table geometry (cm) ---
  tableLength: number;
  tableWidth: number;
  netHeight: number;

  // --- Ball properties ---
  ballMass: number;           // grams
  ballDiameter: number;       // cm
  dragCoefficient: number;    // Cd — tune for pace
  magnusCoefficient: number;  // Cl — tune for spin curve effect
  gravity: number;            // cm/s²

  // --- Bounce ---
  restitution: number;        // coefficient of restitution
  surfaceFriction: number;    // spin-velocity coupling on bounce

  // --- Execution quality weights (tune for balance!) ---
  positionWeight: number;     // how much positional deficit hurts quality
  timePressureWeight: number; // how much time pressure hurts quality
  riskWeight: number;         // how much pushing ceilings hurts quality

  // --- Error model ---
  baseErrorStddev: number;    // base angular error in radians at quality=0

  // --- Movement ---
  maxRecoverySpeed: number;   // cm/s at footwork=100
  comfortableTime: number;    // seconds — below this, time pressure kicks in

  // --- Simulation ---
  timestep: number;           // integration timestep in seconds
  netContactMargin: number;   // cm margin for net clip detection
  edgeContactMargin: number;  // cm margin for edge contact detection

  // --- Serve ---
  serveContactHeight: number; // cm above table surface at serve contact
  serveStartDepth: number;    // cm behind end line at serve start

  // --- Speed scaling ---
  /** Converts player power ceiling (0-100) to max ball speed in cm/s. */
  powerToSpeed: number;
  /** Converts player spin ceiling (0-100) to max spin in rev/s. */
  spinToRevs: number;

  // --- Equipment multipliers ---
  rubberTypeModifiers: Record<RubberType, RubberTypeModifier>;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  // Table geometry
  tableLength: 274,
  tableWidth: 152.5,
  netHeight: 15.25,

  // Ball properties
  ballMass: 2.7,
  ballDiameter: 4.0,
  dragCoefficient: 0.4,
  magnusCoefficient: 0.6,
  gravity: 981,

  // Bounce
  restitution: 0.93,
  surfaceFriction: 0.25,

  // Execution quality weights
  positionWeight: 0.6,
  timePressureWeight: 0.4,
  riskWeight: 0.5,

  // Error model
  baseErrorStddev: 0.15,

  // Movement
  maxRecoverySpeed: 500,
  comfortableTime: 0.4,

  // Simulation
  timestep: 0.002,
  netContactMargin: 1.0,
  edgeContactMargin: 1.0,

  // Serve
  serveContactHeight: 30,
  serveStartDepth: 20,

  // Speed scaling
  powerToSpeed: 3000,
  spinToRevs: 150,

  // Equipment multipliers per rubber type
  rubberTypeModifiers: {
    inverted: {
      spinGeneration: 1.0,
      speedGeneration: 1.0,
      spinReversal: 0.0,
      spinAbsorption: 0.0,
    },
    shortPips: {
      spinGeneration: 0.5,
      speedGeneration: 1.15,
      spinReversal: 0.0,
      spinAbsorption: 0.3,
    },
    longPips: {
      spinGeneration: 0.2,
      speedGeneration: 0.7,
      spinReversal: 0.7,
      spinAbsorption: 0.1,
    },
    antispin: {
      spinGeneration: 0.1,
      speedGeneration: 0.6,
      spinReversal: 0.0,
      spinAbsorption: 0.85,
    },
  },
};

/** Merge a partial config with defaults. */
export function mergeConfig(
  overrides?: Partial<PhysicsConfig>,
): PhysicsConfig {
  if (!overrides) return { ...DEFAULT_PHYSICS_CONFIG };
  return {
    ...DEFAULT_PHYSICS_CONFIG,
    ...overrides,
    // Deep-merge rubberTypeModifiers if provided
    rubberTypeModifiers: overrides.rubberTypeModifiers
      ? { ...DEFAULT_PHYSICS_CONFIG.rubberTypeModifiers, ...overrides.rubberTypeModifiers }
      : { ...DEFAULT_PHYSICS_CONFIG.rubberTypeModifiers },
  };
}
