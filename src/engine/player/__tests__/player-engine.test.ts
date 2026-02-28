import { describe, it, expect } from "vitest";
import { createRng } from "../../rng.js";
import { DEFAULT_PLAYER_ENGINE_CONFIG } from "../constants.js";
import {
  mapTendency,
  mapTendencyWithRisk,
  adjustRiskForPressure,
  computeDeceptionEffort,
} from "../tendency-mapper.js";
import { selectSide } from "../side-selection.js";
import { computeTargetPosition, computeServeTarget } from "../target-placement.js";
import { decideShot } from "../shot-decision.js";
import { decideServe } from "../serve-decision.js";
import { DefaultPlayerEngine, createDefaultPlayerEngineFactory } from "../index.js";
import type {
  Player,
  StrokeCapabilities,
  Equipment,
  StrokeTendencies,
  ServeTendencies,
  PlayerAttributes,
  ArrivalState,
  ShotContext,
  ServeContext,
  MatchState,
} from "../../types/index.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const cfg = DEFAULT_PLAYER_ENGINE_CONFIG;

function makeRng(seed = 42) {
  return createRng(seed);
}

const ATTACKER_ATTRIBUTES: PlayerAttributes = {
  footwork: 82,
  reaction: 78,
  spinRead: 75,
  deception: 70,
  stamina: 72,
  mental: 75,
  service: 80,
  adaptability: 65,
};

const CHOPPER_ATTRIBUTES: PlayerAttributes = {
  footwork: 90,
  reaction: 82,
  spinRead: 85,
  deception: 80,
  stamina: 88,
  mental: 78,
  service: 72,
  adaptability: 70,
};

const ATTACKER_CAPS: StrokeCapabilities = {
  forehand: { powerCeiling: 90, spinCeiling: 88, accuracy: 78, consistency: 80 },
  backhand: { powerCeiling: 78, spinCeiling: 80, accuracy: 72, consistency: 75 },
};

const CHOPPER_CAPS: StrokeCapabilities = {
  forehand: { powerCeiling: 62, spinCeiling: 78, accuracy: 72, consistency: 75 },
  backhand: { powerCeiling: 40, spinCeiling: 88, accuracy: 85, consistency: 88 },
};

const ATTACKER_EQUIP: Equipment = {
  blade: { speed: 88 },
  forehandRubber: { type: "inverted", spin: 90, speed: 85, control: 65 },
  backhandRubber: { type: "inverted", spin: 82, speed: 80, control: 72 },
};

const CHOPPER_EQUIP: Equipment = {
  blade: { speed: 55 },
  forehandRubber: { type: "inverted", spin: 85, speed: 70, control: 80 },
  backhandRubber: { type: "longPips", spin: 40, speed: 35, control: 90 },
};

const ATTACKER_STROKE_TENDENCIES: StrokeTendencies = {
  powerBias: 72,
  spinIntensity: 75,
  topspinBias: 82,
  sidespinUsage: 30,
  depthBias: 70,
  netClearance: 30,
  riskTolerance: 65,
};

const CHOPPER_STROKE_TENDENCIES: StrokeTendencies = {
  powerBias: 28,
  spinIntensity: 80,
  topspinBias: 20,
  sidespinUsage: 15,
  depthBias: 65,
  netClearance: 72,
  riskTolerance: 30,
};

const ATTACKER_SERVE_TENDENCIES: ServeTendencies = {
  length: 60,
  speed: 70,
  spinAmount: 75,
  spinVariation: 55,
  backspinBias: 35,
  sidespinBias: 65,
  risk: 60,
};

const CHOPPER_SERVE_TENDENCIES: ServeTendencies = {
  length: 25,
  speed: 30,
  spinAmount: 80,
  spinVariation: 70,
  backspinBias: 75,
  sidespinBias: 45,
  risk: 30,
};

function makeAttacker(): Player {
  return {
    name: "Zhang Wei",
    handedness: "right",
    elo: 2100,
    attributes: ATTACKER_ATTRIBUTES,
    equipment: ATTACKER_EQUIP,
    strokeCapabilities: ATTACKER_CAPS,
    strokeTendencies: ATTACKER_STROKE_TENDENCIES,
    serveTendencies: ATTACKER_SERVE_TENDENCIES,
    badges: [],
  };
}

function makeChopper(): Player {
  return {
    name: "Kim Soo-jin",
    handedness: "right",
    elo: 1950,
    attributes: CHOPPER_ATTRIBUTES,
    equipment: CHOPPER_EQUIP,
    strokeCapabilities: CHOPPER_CAPS,
    strokeTendencies: CHOPPER_STROKE_TENDENCIES,
    serveTendencies: CHOPPER_SERVE_TENDENCIES,
    badges: [],
  };
}

function makeNeutralMatchState(): MatchState {
  return {
    score: { player1: 3, player2: 2 },
    gamesScore: { player1: 1, player2: 1 },
    gameNumber: 3,
    server: "Zhang Wei",
    player1Name: "Zhang Wei",
    player2Name: "Kim Soo-jin",
    isDeuce: false,
    isGamePoint: false,
    isMatchPoint: false,
  };
}

function makePressureMatchState(): MatchState {
  return {
    score: { player1: 10, player2: 9 },
    gamesScore: { player1: 2, player2: 3 },
    gameNumber: 6,
    server: "Zhang Wei",
    player1Name: "Zhang Wei",
    player2Name: "Kim Soo-jin",
    isDeuce: false,
    isGamePoint: true,
    isMatchPoint: true,
  };
}

function makeArrival(overrides?: Partial<ArrivalState>): ArrivalState {
  return {
    ballPosition: { x: 20, y: -80, z: 20 },
    ballVelocity: { x: 10, y: -300, z: -50 },
    ballSpin: { x: 0, y: 20, z: 0 },
    timeAvailable: 0.35,
    availableSides: ["forehand", "backhand"],
    positionalDeficit: 0.3,
    ...overrides,
  };
}

function makeShotContext(overrides?: Partial<ShotContext>): ShotContext {
  return {
    arrival: makeArrival(),
    playerPosition: { x: 0, y: 160 },
    opponentPosition: { x: 0, y: -160 },
    player: makeAttacker(),
    opponent: makeChopper(),
    matchState: makeNeutralMatchState(),
    rallyHistory: [],
    recentPoints: [],
    ...overrides,
  };
}

function makeServeContext(overrides?: Partial<ServeContext>): ServeContext {
  return {
    playerPosition: { x: 0, y: 160 },
    opponentPosition: { x: 0, y: -160 },
    player: makeAttacker(),
    opponent: makeChopper(),
    matchState: makeNeutralMatchState(),
    recentPoints: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tendency mapper tests
// ---------------------------------------------------------------------------

describe("tendency-mapper", () => {
  it("maps tendency=0 to values near 0", () => {
    const rng = makeRng();
    const values = Array.from({ length: 100 }, () => mapTendency(0, rng, cfg));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(avg).toBeLessThan(0.15);
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it("maps tendency=100 to values near 1", () => {
    const rng = makeRng();
    const values = Array.from({ length: 100 }, () => mapTendency(100, rng, cfg));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(avg).toBeGreaterThan(0.85);
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it("maps tendency=50 to values centered around 0.5", () => {
    const rng = makeRng();
    const values = Array.from({ length: 100 }, () => mapTendency(50, rng, cfg));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    expect(avg).toBeGreaterThan(0.4);
    expect(avg).toBeLessThan(0.6);
  });

  it("always clamps output to [0, 1]", () => {
    const rng = makeRng();
    // Test extreme values and many samples
    for (let tendency = 0; tendency <= 100; tendency += 10) {
      for (let i = 0; i < 50; i++) {
        const v = mapTendency(tendency, rng, cfg);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic with the same seed", () => {
    const rng1 = makeRng(123);
    const rng2 = makeRng(123);
    const values1 = Array.from({ length: 20 }, () => mapTendency(65, rng1, cfg));
    const values2 = Array.from({ length: 20 }, () => mapTendency(65, rng2, cfg));
    expect(values1).toEqual(values2);
  });

  it("risk amplifies tendency away from center", () => {
    const rng1 = makeRng(42);
    const rng2 = makeRng(42);
    // High tendency (70) with risk should be pushed higher
    const noRisk = mapTendencyWithRisk(70, 0, rng1, cfg);
    const highRisk = mapTendencyWithRisk(70, 1, rng2, cfg);
    // With same seed, high risk should produce a higher value for above-center tendency
    // (because the amplification adds (0.7 - 0.5) * 1.0 * 0.3 = +0.06)
    expect(highRisk).toBeGreaterThan(noRisk);
  });
});

// ---------------------------------------------------------------------------
// Shared computation tests (adjustRiskForPressure, computeDeceptionEffort)
// ---------------------------------------------------------------------------

describe("adjustRiskForPressure", () => {
  it("returns base risk unchanged when not under pressure", () => {
    const neutral = makeNeutralMatchState();
    expect(adjustRiskForPressure(0.6, neutral, 50, cfg)).toBe(0.6);
  });

  it("high-mental player reduces risk under pressure", () => {
    const pressure = makePressureMatchState();
    const adjusted = adjustRiskForPressure(0.6, pressure, 90, cfg);
    expect(adjusted).toBeLessThan(0.6);
  });

  it("low-mental player increases risk under pressure", () => {
    const pressure = makePressureMatchState();
    const adjusted = adjustRiskForPressure(0.6, pressure, 20, cfg);
    expect(adjusted).toBeGreaterThan(0.6);
  });

  it("clamps result to [0, 1]", () => {
    const pressure = makePressureMatchState();
    expect(adjustRiskForPressure(0.01, pressure, 99, cfg)).toBeGreaterThanOrEqual(0);
    expect(adjustRiskForPressure(0.99, pressure, 1, cfg)).toBeLessThanOrEqual(1);
  });
});

describe("computeDeceptionEffort", () => {
  it("returns values in [0, 1]", () => {
    const rng = makeRng();
    for (let i = 0; i < 50; i++) {
      const v = computeDeceptionEffort(Math.random() * 100, Math.random(), rng, cfg);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("higher deception attribute produces higher effort on average", () => {
    let lowSum = 0;
    let highSum = 0;
    const n = 100;
    for (let seed = 0; seed < n; seed++) {
      const rng1 = makeRng(seed);
      const rng2 = makeRng(seed + 10000);
      lowSum += computeDeceptionEffort(20, 0.5, rng1, cfg);
      highSum += computeDeceptionEffort(80, 0.5, rng2, cfg);
    }
    expect(highSum / n).toBeGreaterThan(lowSum / n);
  });

  it("higher risk increases effort", () => {
    let lowRiskSum = 0;
    let highRiskSum = 0;
    const n = 100;
    for (let seed = 0; seed < n; seed++) {
      const rng1 = makeRng(seed);
      const rng2 = makeRng(seed);
      lowRiskSum += computeDeceptionEffort(70, 0.1, rng1, cfg);
      highRiskSum += computeDeceptionEffort(70, 0.9, rng2, cfg);
    }
    expect(highRiskSum / n).toBeGreaterThan(lowRiskSum / n);
  });

  it("is deterministic with the same seed", () => {
    const rng1 = makeRng(42);
    const rng2 = makeRng(42);
    expect(computeDeceptionEffort(70, 0.5, rng1, cfg))
      .toBe(computeDeceptionEffort(70, 0.5, rng2, cfg));
  });
});

// ---------------------------------------------------------------------------
// Side selection tests
// ---------------------------------------------------------------------------

describe("side-selection", () => {
  it("returns the only available side", () => {
    const rng = makeRng();
    expect(selectSide(["forehand"], ATTACKER_CAPS, rng, cfg)).toBe("forehand");
    expect(selectSide(["backhand"], ATTACKER_CAPS, rng, cfg)).toBe("backhand");
  });

  it("prefers stronger side statistically", () => {
    // Attacker forehand is clearly stronger (90+88+78+80=336 vs 78+80+72+75=305)
    let forehandCount = 0;
    for (let seed = 0; seed < 200; seed++) {
      const rng = makeRng(seed);
      if (selectSide(["forehand", "backhand"], ATTACKER_CAPS, rng, cfg) === "forehand") {
        forehandCount++;
      }
    }
    // Should pick forehand more often than backhand
    expect(forehandCount).toBeGreaterThan(100);
  });

  it("is deterministic with the same seed", () => {
    const rng1 = makeRng(77);
    const rng2 = makeRng(77);
    expect(selectSide(["forehand", "backhand"], ATTACKER_CAPS, rng1, cfg))
      .toBe(selectSide(["forehand", "backhand"], ATTACKER_CAPS, rng2, cfg));
  });
});

// ---------------------------------------------------------------------------
// Target placement tests
// ---------------------------------------------------------------------------

describe("target-placement", () => {
  it("depthBias=0 targets near net", () => {
    const rng = makeRng();
    const target = computeTargetPosition(0, 0.5, { x: 0, y: -160 }, 160, rng, cfg);
    // Player at +Y, targets -Y. Short depth → Y close to 0.
    expect(target.y).toBeGreaterThan(-60);
    expect(target.y).toBeLessThanOrEqual(0);
  });

  it("depthBias=1 targets near end line", () => {
    const rng = makeRng();
    const target = computeTargetPosition(1, 0.5, { x: 0, y: -160 }, 160, rng, cfg);
    // Deep target → Y close to -137
    expect(target.y).toBeLessThan(-100);
  });

  it("targets are always within table bounds", () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed);
      const target = computeTargetPosition(
        Math.random(),
        Math.random(),
        { x: (Math.random() - 0.5) * 100, y: -160 },
        160,
        rng,
        cfg,
      );
      expect(Math.abs(target.x)).toBeLessThanOrEqual(cfg.tableHalfWidth);
      expect(target.y).toBeGreaterThanOrEqual(-cfg.tableHalfLength);
      expect(target.y).toBeLessThanOrEqual(0);
    }
  });

  it("biases target X away from opponent position", () => {
    // Opponent is at +X (right side). Expect targets biased toward -X (left side).
    let leftCount = 0;
    for (let seed = 0; seed < 200; seed++) {
      const rng = makeRng(seed);
      const target = computeTargetPosition(
        0.5, 0.5, { x: 40, y: -160 }, 160, rng, cfg,
      );
      if (target.x < 0) leftCount++;
    }
    // Should bias left when opponent is right
    expect(leftCount).toBeGreaterThan(100);
  });

  it("serve targets are on receiver half (server at +Y)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = makeRng(seed);
      const target = computeServeTarget(0.5, 0.5, 160, rng, cfg);
      expect(target.y).toBeLessThanOrEqual(0);
      expect(target.y).toBeGreaterThanOrEqual(-cfg.tableHalfLength);
    }
  });

  it("serve targets are on receiver half (server at -Y)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = makeRng(seed);
      const target = computeServeTarget(0.5, 0.5, -160, rng, cfg);
      expect(target.y).toBeGreaterThanOrEqual(0);
      expect(target.y).toBeLessThanOrEqual(cfg.tableHalfLength);
    }
  });

  it("short serve tendency targets near net", () => {
    const rng = makeRng();
    const target = computeServeTarget(0, 0.3, 160, rng, cfg);
    expect(target.y).toBeGreaterThan(-60);
  });

  it("long serve tendency targets near end line", () => {
    const rng = makeRng();
    const target = computeServeTarget(1, 0.3, 160, rng, cfg);
    expect(target.y).toBeLessThan(-100);
  });
});

// ---------------------------------------------------------------------------
// Shot decision integration tests
// ---------------------------------------------------------------------------

describe("decideShot", () => {
  it("produces valid output ranges", () => {
    const rng = makeRng();
    const ctx = makeShotContext();
    const shot = decideShot(ctx, rng, cfg);

    expect(shot.power).toBeGreaterThanOrEqual(0);
    expect(shot.power).toBeLessThanOrEqual(1);
    expect(shot.spinIntensity).toBeGreaterThanOrEqual(0);
    expect(shot.spinIntensity).toBeLessThanOrEqual(1);
    expect(shot.spinDirection.topspin).toBeGreaterThanOrEqual(-1);
    expect(shot.spinDirection.topspin).toBeLessThanOrEqual(1);
    expect(shot.spinDirection.sidespin).toBeGreaterThanOrEqual(-1);
    expect(shot.spinDirection.sidespin).toBeLessThanOrEqual(1);
    expect(shot.deceptionEffort).toBeGreaterThanOrEqual(0);
    expect(shot.deceptionEffort).toBeLessThanOrEqual(1);
    expect(shot.netClearance).toBeGreaterThanOrEqual(cfg.minNetClearance);
    expect(["forehand", "backhand"]).toContain(shot.side);
  });

  it("attacker produces higher power than chopper", () => {
    let attackerPowerSum = 0;
    let chopperPowerSum = 0;
    const n = 100;

    for (let seed = 0; seed < n; seed++) {
      const rng1 = makeRng(seed);
      const rng2 = makeRng(seed + 10000);

      const attackerCtx = makeShotContext({ player: makeAttacker() });
      const chopperCtx = makeShotContext({ player: makeChopper() });

      attackerPowerSum += decideShot(attackerCtx, rng1, cfg).power;
      chopperPowerSum += decideShot(chopperCtx, rng2, cfg).power;
    }

    expect(attackerPowerSum / n).toBeGreaterThan(chopperPowerSum / n);
  });

  it("chopper produces more backspin (lower topspin value)", () => {
    let attackerTopspinSum = 0;
    let chopperTopspinSum = 0;
    const n = 100;

    for (let seed = 0; seed < n; seed++) {
      const rng1 = makeRng(seed);
      const rng2 = makeRng(seed + 10000);

      const attackerCtx = makeShotContext({ player: makeAttacker() });
      const chopperCtx = makeShotContext({ player: makeChopper() });

      attackerTopspinSum += decideShot(attackerCtx, rng1, cfg).spinDirection.topspin;
      chopperTopspinSum += decideShot(chopperCtx, rng2, cfg).spinDirection.topspin;
    }

    // Attacker topspinBias=82 → positive, Chopper topspinBias=20 → negative
    expect(attackerTopspinSum / n).toBeGreaterThan(chopperTopspinSum / n);
  });

  it("chopper has higher net clearance than attacker", () => {
    let attackerClearanceSum = 0;
    let chopperClearanceSum = 0;
    const n = 100;

    for (let seed = 0; seed < n; seed++) {
      const rng1 = makeRng(seed);
      const rng2 = makeRng(seed + 10000);

      const attackerCtx = makeShotContext({ player: makeAttacker() });
      const chopperCtx = makeShotContext({ player: makeChopper() });

      attackerClearanceSum += decideShot(attackerCtx, rng1, cfg).netClearance;
      chopperClearanceSum += decideShot(chopperCtx, rng2, cfg).netClearance;
    }

    // Chopper netClearance=72 vs Attacker netClearance=30
    expect(chopperClearanceSum / n).toBeGreaterThan(attackerClearanceSum / n);
  });

  it("high positional deficit reduces effective risk (safer shots)", () => {
    let normalPowerSum = 0;
    let stretchedPowerSum = 0;
    const n = 100;

    for (let seed = 0; seed < n; seed++) {
      const rng1 = makeRng(seed);
      const rng2 = makeRng(seed);

      const normalCtx = makeShotContext({
        arrival: makeArrival({ positionalDeficit: 0.2 }),
      });
      const stretchedCtx = makeShotContext({
        arrival: makeArrival({ positionalDeficit: 0.9 }),
      });

      normalPowerSum += decideShot(normalCtx, rng1, cfg).power;
      stretchedPowerSum += decideShot(stretchedCtx, rng2, cfg).power;
    }

    // Stretched player should produce slightly lower power due to reduced risk
    expect(normalPowerSum / n).toBeGreaterThan(stretchedPowerSum / n);
  });

  it("pressure affects risk based on mental attribute", () => {
    // Low mental player under pressure → risk increases → more extreme power
    const lowMentalPlayer = makeAttacker();
    lowMentalPlayer.attributes = { ...lowMentalPlayer.attributes, mental: 20 };

    const highMentalPlayer = makeAttacker();
    highMentalPlayer.attributes = { ...highMentalPlayer.attributes, mental: 90 };

    let lowMentalRiskAvg = 0;
    let highMentalRiskAvg = 0;
    const n = 100;

    for (let seed = 0; seed < n; seed++) {
      const rng1 = makeRng(seed);
      const rng2 = makeRng(seed);

      const lowCtx = makeShotContext({
        player: lowMentalPlayer,
        matchState: makePressureMatchState(),
      });
      const highCtx = makeShotContext({
        player: highMentalPlayer,
        matchState: makePressureMatchState(),
      });

      // Power is a proxy for risk level
      lowMentalRiskAvg += decideShot(lowCtx, rng1, cfg).power;
      highMentalRiskAvg += decideShot(highCtx, rng2, cfg).power;
    }

    // Low mental under pressure should produce higher risk (more power)
    expect(lowMentalRiskAvg / n).toBeGreaterThan(highMentalRiskAvg / n);
  });

  it("is deterministic with the same seed", () => {
    const rng1 = makeRng(99);
    const rng2 = makeRng(99);
    const ctx = makeShotContext();

    const shot1 = decideShot(ctx, rng1, cfg);
    const shot2 = decideShot(ctx, rng2, cfg);

    expect(shot1).toEqual(shot2);
  });

  it("recovery target is behind player end line", () => {
    const rng = makeRng();
    const ctx = makeShotContext({ playerPosition: { x: 0, y: 160 } });
    const shot = decideShot(ctx, rng, cfg);
    // Player at +Y, recovery should be at +Y (behind their end)
    expect(shot.recoveryTarget.y).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Serve decision tests
// ---------------------------------------------------------------------------

describe("decideServe", () => {
  it("produces valid output ranges", () => {
    const rng = makeRng();
    const ctx = makeServeContext();
    const serve = decideServe(ctx, rng, cfg);

    expect(serve.power).toBeGreaterThanOrEqual(0);
    expect(serve.power).toBeLessThanOrEqual(1);
    expect(serve.spinIntensity).toBeGreaterThanOrEqual(0);
    expect(serve.spinIntensity).toBeLessThanOrEqual(1);
    expect(serve.spinDirection.topspin).toBeGreaterThanOrEqual(-1);
    expect(serve.spinDirection.topspin).toBeLessThanOrEqual(1);
    expect(serve.spinDirection.sidespin).toBeGreaterThanOrEqual(-1);
    expect(serve.spinDirection.sidespin).toBeLessThanOrEqual(1);
    expect(serve.deceptionEffort).toBeGreaterThanOrEqual(0);
    expect(serve.deceptionEffort).toBeLessThanOrEqual(1);
    expect(serve.netClearance).toBeGreaterThanOrEqual(cfg.minNetClearance);
    expect(["forehand", "backhand"]).toContain(serve.side);
  });

  it("chopper serve has backspin bias (negative topspin)", () => {
    let topspinSum = 0;
    const n = 100;

    for (let seed = 0; seed < n; seed++) {
      const rng = makeRng(seed);
      const ctx = makeServeContext({ player: makeChopper() });
      topspinSum += decideServe(ctx, rng, cfg).spinDirection.topspin;
    }

    // Chopper backspinBias=75 → topspin axis should average negative
    expect(topspinSum / n).toBeLessThan(0);
  });

  it("attacker serve has topspin/flat bias", () => {
    let topspinSum = 0;
    const n = 100;

    for (let seed = 0; seed < n; seed++) {
      const rng = makeRng(seed);
      const ctx = makeServeContext({ player: makeAttacker() });
      topspinSum += decideServe(ctx, rng, cfg).spinDirection.topspin;
    }

    // Attacker backspinBias=35 → (50-35)/50 = +0.3 → average positive
    expect(topspinSum / n).toBeGreaterThan(0);
  });

  it("is deterministic with the same seed", () => {
    const rng1 = makeRng(55);
    const rng2 = makeRng(55);
    const ctx = makeServeContext();

    const serve1 = decideServe(ctx, rng1, cfg);
    const serve2 = decideServe(ctx, rng2, cfg);

    expect(serve1).toEqual(serve2);
  });

  it("targets are on receiver half (negative Y)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = makeRng(seed);
      const ctx = makeServeContext();
      const serve = decideServe(ctx, rng, cfg);
      expect(serve.targetPosition.y).toBeLessThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// DefaultPlayerEngine class tests
// ---------------------------------------------------------------------------

describe("DefaultPlayerEngine", () => {
  it("implements PlayerEngine interface correctly", () => {
    const rng = makeRng();
    const engine = new DefaultPlayerEngine(makeAttacker(), rng);

    const shotCtx = makeShotContext();
    const shot = engine.decideShot(shotCtx);
    expect(shot).toBeDefined();
    expect(shot.side).toBeDefined();
    expect(shot.power).toBeGreaterThanOrEqual(0);

    const serveCtx = makeServeContext();
    const serve = engine.decideServe(serveCtx);
    expect(serve).toBeDefined();
    expect(serve.side).toBeDefined();

    // Lifecycle hooks should not throw
    engine.onPointEnd({ winner: "Zhang Wei", server: "Zhang Wei", rallyLength: 3, reason: "unreturnable" });
    engine.onGameEnd("Zhang Wei");
    engine.onTimeout();
  });

  it("factory creates working engine instances", () => {
    const rng = makeRng();
    const factory = createDefaultPlayerEngineFactory(rng);

    const attackerEngine = factory(makeAttacker());
    const chopperEngine = factory(makeChopper());

    expect(attackerEngine).toBeInstanceOf(DefaultPlayerEngine);
    expect(chopperEngine).toBeInstanceOf(DefaultPlayerEngine);

    const ctx = makeShotContext();
    const attackerShot = attackerEngine.decideShot(ctx);
    const chopperShot = chopperEngine.decideShot({ ...ctx, player: makeChopper() });

    expect(attackerShot).toBeDefined();
    expect(chopperShot).toBeDefined();
  });
});
