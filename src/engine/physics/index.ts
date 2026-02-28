/**
 * DefaultPhysicsEngine — stateless physics implementation.
 *
 * All balance-affecting values come from PhysicsConfig.
 * Inject a seedable Rng for deterministic simulation.
 */

import type { Vec2, Vec3 } from "../types/index.js";
import type {
  StrokeCapabilities,
  Equipment,
  StrokeSide,
  Rubber,
} from "../types/index.js";
import type {
  PhysicsEngine,
  ArrivalState,
  ShotIntention,
  ServeIntention,
  BallFlight,
} from "../types/index.js";
import type { Rng } from "../rng.js";
import type { PhysicsConfig } from "./constants.js";
import { mergeConfig } from "./constants.js";
import { simulateFlight, simulateServe } from "./trajectory.js";
import { computeExecutionQuality, computeServeQuality, applyError } from "./execution.js";
import {
  v2lerp,
  v2dist,
  v3mag,
  v3sub,
  clamp,
} from "./vec-math.js";

export class DefaultPhysicsEngine implements PhysicsEngine {
  private readonly config: PhysicsConfig;
  private readonly rng: Rng;

  constructor(rng: Rng, config?: Partial<PhysicsConfig>) {
    this.rng = rng;
    this.config = mergeConfig(config);
  }

  /**
   * Analyze an incoming ball and compute the receiver's physical options.
   * Called BEFORE the player engine decides.
   */
  analyzeArrival(
    ball: BallFlight,
    receiverPosition: Vec2,
    receiverCapabilities: StrokeCapabilities,
    receiverFootwork: number,
  ): ArrivalState {
    // Ball arrival position: where the ball will be after bouncing
    // The ball's landing position is where it contacts the table.
    // After bounce, the ball rises — the receiver contacts it at some height.
    // Simplified: receiver contacts ball at landing position X/Y, at ~table height + bounce height
    const arrivalX = ball.landingPosition.x;
    const arrivalY = ball.landingPosition.y;

    // Estimate bounce height from landing velocity Z (post-bounce)
    // A reasonable contact height is ~20-40cm above table
    const contactHeight = 20 + Math.abs(ball.velocity.z) * 0.02;

    const ballPosition: Vec3 = {
      x: arrivalX,
      y: arrivalY,
      z: contactHeight,
    };

    // Time available = flight time (already computed in BallFlight)
    // We estimate from ball speed and distance
    const ballSpeed = v3mag(ball.velocity);
    const distance = v3mag(v3sub(ball.landingPosition, ball.startPosition));
    const timeAvailable = ballSpeed > 0 ? distance / ballSpeed : 0.5;

    // Positional deficit: how far the receiver must move to reach the ball
    const idealContactPos: Vec2 = { x: arrivalX, y: arrivalY };
    const distToContact = v2dist(receiverPosition, idealContactPos);

    // Max reach = footwork-based movement in available time
    const maxReach = (receiverFootwork / 100) * this.config.maxRecoverySpeed * timeAvailable;
    const positionalDeficit = maxReach > 0
      ? clamp(distToContact / maxReach, 0, 1)
      : distToContact > 0 ? 1 : 0;

    // Available sides: which paddle sides can reach the ball
    // Based on ball position relative to player, and whether player has time
    const availableSides = this.computeAvailableSides(
      receiverPosition,
      idealContactPos,
      positionalDeficit,
    );

    return {
      ballPosition,
      ballVelocity: ball.velocity,
      ballSpin: ball.spin,
      timeAvailable,
      availableSides,
      positionalDeficit,
    };
  }

  /**
   * Execute a rally shot intention and produce the resulting ball flight.
   */
  executeShot(
    intention: ShotIntention,
    capabilities: StrokeCapabilities,
    equipment: Equipment,
    arrival: ArrivalState,
  ): BallFlight {
    const sideCaps = capabilities[intention.side];
    const rubber = intention.side === "forehand" ? equipment.forehandRubber : equipment.backhandRubber;

    // Convert intention fractions to absolute physical values
    const effectiveSpeed = this.effectiveSpeedCeiling(sideCaps.powerCeiling, equipment.blade.speed, rubber);
    const effectiveSpin = this.effectiveSpinCeiling(sideCaps.spinCeiling, rubber);

    const speed = intention.power * effectiveSpeed;
    const spinMag = intention.spinIntensity * effectiveSpin;

    // Risk level = max of how close to ceilings
    const riskLevel = Math.max(intention.power, intention.spinIntensity);

    // Execution quality
    const quality = computeExecutionQuality(
      sideCaps.consistency,
      arrival.positionalDeficit,
      arrival.timeAvailable,
      riskLevel,
      this.config,
    );

    // Compute intended velocity direction from contact point to target
    const intendedVelocity = this.computeVelocity(
      arrival.ballPosition,
      intention.targetPosition,
      intention.netClearance,
      speed,
    );

    // Compute intended spin vector
    const intendedSpin = this.computeSpinVector(
      spinMag,
      intention.spinDirection,
    );

    // Apply error
    const error = applyError(
      intendedVelocity,
      intendedSpin,
      quality,
      sideCaps.accuracy,
      this.config,
      this.rng,
    );

    // Simulate trajectory
    const trajectory = simulateFlight(
      arrival.ballPosition,
      error.velocity,
      error.spin,
      this.config,
      this.rng,
    );

    return {
      startPosition: arrival.ballPosition,
      velocity: error.velocity,
      spin: error.spin,
      apex: trajectory.apex,
      landingPosition: trajectory.landingPosition,
      netContact: trajectory.netContact,
      edgeContact: trajectory.edgeContact,
      executionQuality: quality,
    };
  }

  /**
   * Execute a serve intention and produce the resulting ball flight.
   */
  executeServe(
    intention: ServeIntention,
    capabilities: StrokeCapabilities,
    equipment: Equipment,
    serviceSkill: number,
  ): BallFlight {
    const sideCaps = capabilities[intention.side];
    const rubber = intention.side === "forehand" ? equipment.forehandRubber : equipment.backhandRubber;

    // Convert intention to physical values
    const effectiveSpeed = this.effectiveSpeedCeiling(sideCaps.powerCeiling, equipment.blade.speed, rubber);
    const effectiveSpin = this.effectiveSpinCeiling(sideCaps.spinCeiling, rubber);

    const speed = intention.power * effectiveSpeed;
    const spinMag = intention.spinIntensity * effectiveSpin;

    // Risk level
    const riskLevel = Math.max(intention.power, intention.spinIntensity);

    // Serve quality
    const quality = computeServeQuality(
      serviceSkill,
      sideCaps.consistency,
      riskLevel,
      this.config,
    );

    // Serve starts behind the server's end line
    // Convention: server is at +Y end, so startY = tableLength/2 + serveStartDepth
    const halfTable = this.config.tableLength / 2;
    const startPos: Vec3 = {
      x: 0,
      y: halfTable + this.config.serveStartDepth,
      z: this.config.serveContactHeight,
    };

    // Serve must bounce on server's half first, then reach receiver's half
    // Target for first bounce: somewhere on server's half
    const firstBounceTarget: Vec2 = {
      x: intention.targetPosition.x * 0.3, // Slight X offset toward intended side
      y: halfTable * 0.5, // Middle of server's half
    };

    // Compute velocity to reach first bounce target
    const serveVelocity = this.computeVelocity(
      startPos,
      firstBounceTarget,
      intention.netClearance,
      speed,
    );

    // Compute spin
    const intendedSpin = this.computeSpinVector(
      spinMag,
      intention.spinDirection,
    );

    // Apply error
    const error = applyError(
      serveVelocity,
      intendedSpin,
      quality,
      sideCaps.accuracy,
      this.config,
      this.rng,
    );

    // Simulate serve (two-phase: bounce on server half, then fly to receiver)
    const trajectory = simulateServe(
      startPos,
      error.velocity,
      error.spin,
      this.config,
      this.rng,
    );

    return {
      startPosition: startPos,
      velocity: error.velocity,
      spin: error.spin,
      apex: trajectory.apex,
      landingPosition: trajectory.landingPosition,
      netContact: trajectory.netContact,
      edgeContact: trajectory.edgeContact,
      executionQuality: quality,
    };
  }

  /**
   * Compute where a player ends up after recovery movement.
   */
  computeRecovery(
    currentPosition: Vec2,
    targetPosition: Vec2,
    footwork: number,
    timeAvailable: number,
  ): Vec2 {
    const maxDist = (footwork / 100) * this.config.maxRecoverySpeed * timeAvailable;
    const dist = v2dist(currentPosition, targetPosition);

    if (dist <= 0) return { ...currentPosition };

    const fraction = Math.min(1, maxDist / dist);
    return v2lerp(currentPosition, targetPosition, fraction);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute effective speed ceiling after equipment modifiers.
   * Player ceiling × blade speed × rubber speed × rubber type modifier.
   * Result in cm/s.
   */
  private effectiveSpeedCeiling(
    powerCeiling: number,
    bladeSpeed: number,
    rubber: Rubber,
  ): number {
    const rubberMod = this.config.rubberTypeModifiers[rubber.type];
    return (
      this.config.powerToSpeed *
      (powerCeiling / 100) *
      (bladeSpeed / 100) *
      (rubber.speed / 100) *
      rubberMod.speedGeneration
    );
  }

  /**
   * Compute effective spin ceiling after equipment modifiers.
   * Result in rev/s.
   */
  private effectiveSpinCeiling(spinCeiling: number, rubber: Rubber): number {
    const rubberMod = this.config.rubberTypeModifiers[rubber.type];
    return (
      this.config.spinToRevs *
      (spinCeiling / 100) *
      (rubber.spin / 100) *
      rubberMod.spinGeneration
    );
  }

  /**
   * Compute velocity vector to send ball from start to target with given net clearance.
   *
   * Uses projectile motion to find the initial z-velocity that:
   * 1. Lands the ball at z=0 at the target position, AND
   * 2. Clears the net (at Y=0) by at least netClearance cm.
   * If both constraints conflict, net clearance wins (ball overshoots target).
   */
  private computeVelocity(
    start: Vec3,
    target: Vec2,
    netClearance: number,
    speed: number,
  ): Vec3 {
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const horizontalDist = Math.sqrt(dx * dx + dy * dy);

    if (horizontalDist === 0) {
      return { x: 0, y: 0, z: -speed * 0.5 };
    }

    const g = this.config.gravity;
    const horizontalSpeed = speed * 0.85; // Most of the speed goes horizontal
    const totalFlightTime = horizontalDist / Math.max(horizontalSpeed, 1);

    // z(t) = start.z + vz*t - 0.5*g*t²
    // Constraint 1: land at z=0 → vz = (0.5*g*t_land² - start.z) / t_land
    const vzLand = (0.5 * g * totalFlightTime * totalFlightTime - start.z) / totalFlightTime;

    // Constraint 2: clear net at height targetNetHeight when crossing Y=0
    // Only applies when the ball actually crosses the net (start and target on opposite sides)
    let vz = vzLand;
    const ballCrossesNet = start.y * target.y < 0;
    if (ballCrossesNet) {
      const distToNet = Math.abs(start.y);
      const flightTimeToNet = distToNet / Math.max(horizontalSpeed, 1);
      const targetNetHeight = this.config.netHeight + netClearance;
      // z(t_net) >= targetNetHeight → vz >= (targetNetHeight - start.z + 0.5*g*t_net²) / t_net
      const vzNet = (targetNetHeight - start.z + 0.5 * g * flightTimeToNet * flightTimeToNet) / flightTimeToNet;
      vz = Math.max(vzLand, vzNet);
    }

    const dirX = dx / horizontalDist;
    const dirY = dy / horizontalDist;

    return {
      x: dirX * horizontalSpeed,
      y: dirY * horizontalSpeed,
      z: vz,
    };
  }

  /**
   * Compute spin vector from magnitude and direction intention.
   * Rubber type spin modifier is already applied in effectiveSpinCeiling,
   * so this method only decomposes magnitude into topspin/sidespin axes.
   */
  private computeSpinVector(
    magnitude: number,
    direction: { topspin: number; sidespin: number },
  ): Vec3 {
    // Topspin component → spin.y (positive = topspin, negative = backspin)
    // Sidespin component → spin.x
    // Gyrospin (spin.z) is a small residual
    const topspin = direction.topspin * magnitude;
    const sidespin = direction.sidespin * magnitude;

    // Normalize so the total magnitude stays at `magnitude`
    const total = Math.sqrt(topspin * topspin + sidespin * sidespin);
    const scale = total > 0 ? magnitude / total : 0;

    return {
      x: sidespin * scale,
      y: topspin * scale,
      z: 0, // No gyrospin for now
    };
  }

  /**
   * Determine which paddle sides are available given player and ball positions.
   */
  private computeAvailableSides(
    playerPos: Vec2,
    ballPos: Vec2,
    positionalDeficit: number,
  ): StrokeSide[] {
    // Ball relative to player in X axis
    // Positive X = to the player's right (forehand for right-hander)
    // Note: handedness is handled by the player engine, not physics.
    // Physics just reports which sides are geometrically reachable.
    const relativeX = ballPos.x - playerPos.x;

    if (positionalDeficit > 0.85) {
      // Severely stretched — only one side available (whichever is closer)
      return relativeX >= 0 ? ["forehand"] : ["backhand"];
    }

    // Both sides available
    return ["forehand", "backhand"];
  }
}
