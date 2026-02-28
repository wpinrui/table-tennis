import { describe, it, expect } from "vitest";
import { createRng } from "../../rng.js";
import { DEFAULT_PHYSICS_CONFIG } from "../constants.js";
import { DefaultPhysicsEngine } from "../index.js";
import { simulateFlight } from "../trajectory.js";
import { applyBounce } from "../bounce.js";
import { computeExecutionQuality, computeServeQuality, applyError } from "../execution.js";
import {
  v3add, v3sub, v3scale, v3dot, v3cross, v3mag, v3normalize,
  v2dist, v2lerp, clamp,
} from "../vec-math.js";
import type { Vec3, Vec2 } from "../../types/index.js";
import type { BallFlight, ShotIntention, ServeIntention, StrokeCapabilities, Equipment } from "../../types/index.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const cfg = DEFAULT_PHYSICS_CONFIG;

function makeRng(seed = 42) {
  return createRng(seed);
}

const ATTACKER_CAPS: StrokeCapabilities = {
  forehand: { powerCeiling: 90, spinCeiling: 88, accuracy: 78, consistency: 80 },
  backhand: { powerCeiling: 78, spinCeiling: 80, accuracy: 72, consistency: 75 },
};

const ATTACKER_EQUIP: Equipment = {
  blade: { speed: 88 },
  forehandRubber: { type: "inverted", spin: 90, speed: 85, control: 65 },
  backhandRubber: { type: "inverted", spin: 82, speed: 80, control: 72 },
};

const CHOPPER_CAPS: StrokeCapabilities = {
  forehand: { powerCeiling: 62, spinCeiling: 78, accuracy: 72, consistency: 75 },
  backhand: { powerCeiling: 40, spinCeiling: 88, accuracy: 85, consistency: 88 },
};

const CHOPPER_EQUIP: Equipment = {
  blade: { speed: 55 },
  forehandRubber: { type: "inverted", spin: 85, speed: 70, control: 80 },
  backhandRubber: { type: "longPips", spin: 40, speed: 35, control: 90 },
};

// A standard ball flight for testing analyzeArrival
function makeIncomingBall(): BallFlight {
  return {
    startPosition: { x: 0, y: 100, z: 30 },
    velocity: { x: 10, y: -300, z: -50 },
    spin: { x: 0, y: 20, z: 0 },
    apex: { x: 5, y: 50, z: 40 },
    landingPosition: { x: 20, y: -80, z: 0 },
    netContact: false,
    edgeContact: false,
    executionQuality: 0.85,
  };
}

// ---------------------------------------------------------------------------
// Vector math tests
// ---------------------------------------------------------------------------

describe("vec-math", () => {
  it("adds Vec3 correctly", () => {
    const r = v3add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 });
    expect(r).toEqual({ x: 5, y: 7, z: 9 });
  });

  it("subtracts Vec3 correctly", () => {
    const r = v3sub({ x: 4, y: 5, z: 6 }, { x: 1, y: 2, z: 3 });
    expect(r).toEqual({ x: 3, y: 3, z: 3 });
  });

  it("computes magnitude", () => {
    expect(v3mag({ x: 3, y: 4, z: 0 })).toBeCloseTo(5);
  });

  it("normalizes a vector", () => {
    const n = v3normalize({ x: 0, y: 0, z: 5 });
    expect(n).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("normalizes zero vector safely", () => {
    const n = v3normalize({ x: 0, y: 0, z: 0 });
    expect(n).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("cross product is correct", () => {
    const r = v3cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expect(r).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("v2dist computes distance", () => {
    expect(v2dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });

  it("v2lerp interpolates correctly", () => {
    const r = v2lerp({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5);
    expect(r).toEqual({ x: 5, y: 10 });
  });

  it("v2lerp clamps t to [0,1]", () => {
    const r = v2lerp({ x: 0, y: 0 }, { x: 10, y: 10 }, 2.0);
    expect(r).toEqual({ x: 10, y: 10 });
  });

  it("clamp works", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// RNG tests
// ---------------------------------------------------------------------------

describe("rng", () => {
  it("is deterministic with same seed", () => {
    const rng1 = createRng(123);
    const rng2 = createRng(123);
    const vals1 = Array.from({ length: 10 }, () => rng1.next());
    const vals2 = Array.from({ length: 10 }, () => rng2.next());
    expect(vals1).toEqual(vals2);
  });

  it("produces different values with different seeds", () => {
    const rng1 = createRng(123);
    const rng2 = createRng(456);
    const vals1 = Array.from({ length: 10 }, () => rng1.next());
    const vals2 = Array.from({ length: 10 }, () => rng2.next());
    expect(vals1).not.toEqual(vals2);
  });

  it("produces values in [0, 1)", () => {
    const rng = createRng(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("gaussian produces values around mean", () => {
    const rng = createRng(42);
    const values = Array.from({ length: 10000 }, () => rng.gaussian(0, 1));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeCloseTo(0, 0); // Within 0.5 of 0
  });
});

// ---------------------------------------------------------------------------
// Bounce mechanics tests
// ---------------------------------------------------------------------------

describe("bounce", () => {
  it("reverses vertical velocity with restitution", () => {
    const result = applyBounce(
      { x: 100, y: -200, z: -50 },
      { x: 0, y: 0, z: 0 },
      cfg,
    );
    expect(result.velocity.z).toBeGreaterThan(0);
    expect(result.velocity.z).toBeCloseTo(50 * cfg.restitution);
  });

  it("topspin accelerates forward on bounce", () => {
    const noSpin = applyBounce({ x: 0, y: -200, z: -50 }, { x: 0, y: 0, z: 0 }, cfg);
    // For a -Y ball, topspin axis is +X (ωx > 0). Bounce formula: vy -= ωx * friction
    const topSpin = applyBounce({ x: 0, y: -200, z: -50 }, { x: 30, y: 0, z: 0 }, cfg);
    // Topspin should make Y more negative (faster forward)
    expect(topSpin.velocity.y).toBeLessThan(noSpin.velocity.y);
  });

  it("backspin decelerates forward on bounce", () => {
    const noSpin = applyBounce({ x: 0, y: -200, z: -50 }, { x: 0, y: 0, z: 0 }, cfg);
    // For a -Y ball, backspin axis is -X (ωx < 0). Bounce formula: vy -= ωx * friction
    const backSpin = applyBounce({ x: 0, y: -200, z: -50 }, { x: -30, y: 0, z: 0 }, cfg);
    // Backspin should slow forward motion
    expect(backSpin.velocity.y).toBeGreaterThan(noSpin.velocity.y);
  });

  it("spin magnitude reduces after bounce", () => {
    const result = applyBounce(
      { x: 0, y: -200, z: -50 },
      { x: 10, y: 30, z: 5 },
      cfg,
    );
    expect(Math.abs(result.spin.x)).toBeLessThan(10);
    expect(Math.abs(result.spin.y)).toBeLessThan(30);
    expect(Math.abs(result.spin.z)).toBeLessThan(5);
  });
});

// ---------------------------------------------------------------------------
// Execution quality tests
// ---------------------------------------------------------------------------

describe("execution quality", () => {
  it("perfect conditions → high quality", () => {
    const q = computeExecutionQuality(80, 0, 0.5, 0, cfg);
    expect(q).toBeGreaterThan(0.7);
  });

  it("high positional deficit → reduced quality", () => {
    const qGood = computeExecutionQuality(80, 0, 0.5, 0, cfg);
    const qBad = computeExecutionQuality(80, 0.9, 0.5, 0, cfg);
    expect(qBad).toBeLessThan(qGood);
  });

  it("time pressure → reduced quality", () => {
    const qRelaxed = computeExecutionQuality(80, 0, 0.5, 0, cfg);
    const qRushed = computeExecutionQuality(80, 0, 0.05, 0, cfg);
    expect(qRushed).toBeLessThan(qRelaxed);
  });

  it("high risk → reduced quality", () => {
    const qSafe = computeExecutionQuality(80, 0, 0.5, 0.2, cfg);
    const qRisky = computeExecutionQuality(80, 0, 0.5, 0.95, cfg);
    expect(qRisky).toBeLessThan(qSafe);
  });

  it("quality clamped to [0, 1]", () => {
    const q = computeExecutionQuality(100, 0, 1.0, 0, cfg);
    expect(q).toBeLessThanOrEqual(1);
    expect(q).toBeGreaterThanOrEqual(0);
  });

  it("serve quality uses service skill", () => {
    const qHigh = computeServeQuality(90, 80, 0.3, cfg);
    const qLow = computeServeQuality(30, 80, 0.3, cfg);
    expect(qHigh).toBeGreaterThan(qLow);
  });
});

// ---------------------------------------------------------------------------
// Error model tests
// ---------------------------------------------------------------------------

describe("error model", () => {
  it("high quality → minimal error", () => {
    const rng = makeRng();
    const vel: Vec3 = { x: 0, y: -300, z: 50 };
    const spin: Vec3 = { x: 0, y: 20, z: 0 };
    const result = applyError(vel, spin, 0.99, 90, cfg, rng);

    // Velocity should be very close to intended
    expect(result.velocity.x).toBeCloseTo(vel.x, 0);
    expect(result.velocity.y).toBeCloseTo(vel.y, 0);
  });

  it("low quality → larger velocity error", () => {
    const rng1 = makeRng(100);
    const rng2 = makeRng(100);
    const vel: Vec3 = { x: 0, y: -300, z: 50 };
    const spin: Vec3 = { x: 0, y: 20, z: 0 };

    // Collect velocity deviations over multiple trials
    let highQualityError = 0;
    let lowQualityError = 0;
    for (let i = 0; i < 100; i++) {
      const r1 = applyError(vel, spin, 0.95, 80, cfg, rng1);
      const r2 = applyError(vel, spin, 0.2, 80, cfg, rng2);
      highQualityError += Math.abs(r1.velocity.x - vel.x) + Math.abs(r1.velocity.y - vel.y);
      lowQualityError += Math.abs(r2.velocity.x - vel.x) + Math.abs(r2.velocity.y - vel.y);
    }
    expect(lowQualityError).toBeGreaterThan(highQualityError);
  });
});

// ---------------------------------------------------------------------------
// Trajectory simulation tests
// ---------------------------------------------------------------------------

describe("trajectory", () => {
  it("ball with no spin lands on table with standard velocity", () => {
    const rng = makeRng();
    // Ball starts above table near one end, aimed at opposite half
    // Moderate speed with gentle arc — should clear net and land on table
    const result = simulateFlight(
      { x: 0, y: 100, z: 25 },
      { x: 0, y: -600, z: 50 },
      { x: 0, y: 0, z: 0 },
      cfg,
      rng,
    );
    expect(result.landsOnTable).toBe(true);
    expect(result.landingPosition.z).toBeCloseTo(0, 0);
  });

  it("gravity always brings ball down", () => {
    const rng = makeRng();
    // Ball going mostly up
    const result = simulateFlight(
      { x: 0, y: 50, z: 30 },
      { x: 0, y: -500, z: 500 },
      { x: 0, y: 0, z: 0 },
      cfg,
      rng,
    );
    // Should eventually come down
    expect(result.landingPosition.z).toBeLessThanOrEqual(0.1);
  });

  it("apex is above start position for upward trajectory", () => {
    const rng = makeRng();
    const result = simulateFlight(
      { x: 0, y: 100, z: 20 },
      { x: 0, y: -1000, z: 400 },
      { x: 0, y: 0, z: 0 },
      cfg,
      rng,
    );
    expect(result.apex.z).toBeGreaterThan(20);
  });

  it("ball aimed into net hits net", () => {
    const rng = makeRng();
    // Ball starting close to net at low height, aimed flat — should hit net
    const result = simulateFlight(
      { x: 0, y: 30, z: 10 },
      { x: 0, y: -2000, z: -20 },
      { x: 0, y: 0, z: 0 },
      cfg,
      rng,
    );
    expect(result.crossedNet).toBe(false);
    expect(result.netContact).toBe(true);
  });

  it("ball aimed high clears net", () => {
    const rng = makeRng();
    // Ball starting near one end with strong upward arc
    const result = simulateFlight(
      { x: 0, y: 100, z: 25 },
      { x: 0, y: -1500, z: 400 },
      { x: 0, y: 0, z: 0 },
      cfg,
      rng,
    );
    expect(result.crossedNet).toBe(true);
  });

  it("ball going wide lands off table", () => {
    const rng = makeRng();
    const result = simulateFlight(
      { x: 0, y: 100, z: 30 },
      { x: 2000, y: -500, z: 200 },
      { x: 0, y: 0, z: 0 },
      cfg,
      rng,
    );
    // Should go off the side
    expect(result.landsOnTable).toBe(false);
  });

  it("flight time is positive", () => {
    const rng = makeRng();
    const result = simulateFlight(
      { x: 0, y: 100, z: 30 },
      { x: 0, y: -300, z: 50 },
      { x: 0, y: 0, z: 0 },
      cfg,
      rng,
    );
    expect(result.flightTime).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DefaultPhysicsEngine integration tests
// ---------------------------------------------------------------------------

describe("DefaultPhysicsEngine", () => {
  it("analyzeArrival returns valid ArrivalState", () => {
    const engine = new DefaultPhysicsEngine(makeRng());
    const ball = makeIncomingBall();
    const receiverPos: Vec2 = { x: 0, y: -150 };

    const arrival = engine.analyzeArrival(ball, receiverPos, ATTACKER_CAPS, 82);

    expect(arrival.ballPosition.z).toBeGreaterThan(0);
    expect(arrival.timeAvailable).toBeGreaterThan(0);
    expect(arrival.positionalDeficit).toBeGreaterThanOrEqual(0);
    expect(arrival.positionalDeficit).toBeLessThanOrEqual(1);
    expect(arrival.availableSides.length).toBeGreaterThan(0);
  });

  it("executeShot returns valid BallFlight", () => {
    const engine = new DefaultPhysicsEngine(makeRng());
    const ball = makeIncomingBall();
    const receiverPos: Vec2 = { x: 0, y: -150 };
    const arrival = engine.analyzeArrival(ball, receiverPos, ATTACKER_CAPS, 82);

    const intention: ShotIntention = {
      side: "forehand",
      power: 0.7,
      spinIntensity: 0.6,
      spinDirection: { topspin: 0.8, sidespin: 0.1 },
      targetPosition: { x: 20, y: 80 },
      netClearance: 5,
      deceptionEffort: 0.3,
      recoveryTarget: { x: 0, y: -150 },
    };

    const flight = engine.executeShot(intention, ATTACKER_CAPS, ATTACKER_EQUIP, arrival);

    expect(flight.startPosition.z).toBeGreaterThan(0);
    expect(flight.apex.z).toBeGreaterThanOrEqual(flight.startPosition.z);
    expect(flight.executionQuality).toBeGreaterThan(0);
    expect(flight.executionQuality).toBeLessThanOrEqual(1);
  });

  it("executeServe returns valid BallFlight", () => {
    const engine = new DefaultPhysicsEngine(makeRng());

    const intention: ServeIntention = {
      side: "forehand",
      power: 0.5,
      spinIntensity: 0.7,
      spinDirection: { topspin: -0.6, sidespin: 0.4 },
      targetPosition: { x: -30, y: -80 },
      netClearance: 3,
      deceptionEffort: 0.5,
    };

    const flight = engine.executeServe(intention, ATTACKER_CAPS, ATTACKER_EQUIP, 80);

    expect(flight.startPosition.z).toBeGreaterThan(0);
    expect(flight.executionQuality).toBeGreaterThan(0);
    expect(flight.executionQuality).toBeLessThanOrEqual(1);
  });

  it("computeRecovery moves toward target", () => {
    const engine = new DefaultPhysicsEngine(makeRng());
    const current: Vec2 = { x: -50, y: -150 };
    const target: Vec2 = { x: 0, y: -150 };

    const result = engine.computeRecovery(current, target, 80, 0.3);

    // Should be closer to target than current
    const distBefore = v2dist(current, target);
    const distAfter = v2dist(result, target);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it("high footwork recovers further than low footwork", () => {
    const engine = new DefaultPhysicsEngine(makeRng());
    const current: Vec2 = { x: -80, y: -150 };
    const target: Vec2 = { x: 0, y: -150 };
    const time = 0.3;

    const fast = engine.computeRecovery(current, target, 95, time);
    const slow = engine.computeRecovery(current, target, 40, time);

    const distFast = v2dist(fast, target);
    const distSlow = v2dist(slow, target);
    expect(distFast).toBeLessThan(distSlow);
  });

  it("seed reproducibility — same seed produces identical results", () => {
    const engine1 = new DefaultPhysicsEngine(createRng(999));
    const engine2 = new DefaultPhysicsEngine(createRng(999));

    const ball = makeIncomingBall();
    const pos: Vec2 = { x: 0, y: -150 };

    const arrival1 = engine1.analyzeArrival(ball, pos, ATTACKER_CAPS, 82);
    const arrival2 = engine2.analyzeArrival(ball, pos, ATTACKER_CAPS, 82);

    expect(arrival1).toEqual(arrival2);

    const intention: ShotIntention = {
      side: "forehand",
      power: 0.7,
      spinIntensity: 0.6,
      spinDirection: { topspin: 0.8, sidespin: 0.1 },
      targetPosition: { x: 20, y: 80 },
      netClearance: 5,
      deceptionEffort: 0.3,
      recoveryTarget: { x: 0, y: -150 },
    };

    const flight1 = engine1.executeShot(intention, ATTACKER_CAPS, ATTACKER_EQUIP, arrival1);
    const flight2 = engine2.executeShot(intention, ATTACKER_CAPS, ATTACKER_EQUIP, arrival2);

    expect(flight1).toEqual(flight2);
  });

  it("equipment affects speed ceiling — fast blade produces faster shots", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const fastEngine = new DefaultPhysicsEngine(rng1);
    const slowEngine = new DefaultPhysicsEngine(rng2);

    const ball = makeIncomingBall();
    const pos: Vec2 = { x: 0, y: -150 };

    const arrival1 = fastEngine.analyzeArrival(ball, pos, ATTACKER_CAPS, 82);
    const arrival2 = slowEngine.analyzeArrival(ball, pos, CHOPPER_CAPS, 90);

    const intention: ShotIntention = {
      side: "forehand",
      power: 0.8,
      spinIntensity: 0.5,
      spinDirection: { topspin: 0.9, sidespin: 0 },
      targetPosition: { x: 0, y: 80 },
      netClearance: 5,
      deceptionEffort: 0,
      recoveryTarget: { x: 0, y: -150 },
    };

    const fastFlight = fastEngine.executeShot(intention, ATTACKER_CAPS, ATTACKER_EQUIP, arrival1);
    const slowFlight = slowEngine.executeShot(intention, CHOPPER_CAPS, CHOPPER_EQUIP, arrival2);

    // Fast equipment should produce higher ball speed
    const fastSpeed = v3mag(fastFlight.velocity);
    const slowSpeed = v3mag(slowFlight.velocity);
    expect(fastSpeed).toBeGreaterThan(slowSpeed);
  });

  it("longPips rubber generates less spin than inverted", () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);
    const engine1 = new DefaultPhysicsEngine(rng1);
    const engine2 = new DefaultPhysicsEngine(rng2);

    const ball = makeIncomingBall();
    const pos: Vec2 = { x: 0, y: -150 };

    // Same intention, different equipment (backhand side)
    const arrival1 = engine1.analyzeArrival(ball, pos, ATTACKER_CAPS, 82);
    const arrival2 = engine2.analyzeArrival(ball, pos, CHOPPER_CAPS, 90);

    const intention: ShotIntention = {
      side: "backhand",
      power: 0.5,
      spinIntensity: 0.8,
      spinDirection: { topspin: -0.8, sidespin: 0 },
      targetPosition: { x: 0, y: 80 },
      netClearance: 10,
      deceptionEffort: 0,
      recoveryTarget: { x: 0, y: -150 },
    };

    const invertedFlight = engine1.executeShot(intention, ATTACKER_CAPS, ATTACKER_EQUIP, arrival1);
    const longPipsFlight = engine2.executeShot(intention, CHOPPER_CAPS, CHOPPER_EQUIP, arrival2);

    // Inverted should produce more spin
    const invertedSpin = v3mag(invertedFlight.spin);
    const longPipsSpin = v3mag(longPipsFlight.spin);
    expect(invertedSpin).toBeGreaterThan(longPipsSpin);
  });
});
