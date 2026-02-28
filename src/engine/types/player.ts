/** Playing hand — affects serve angles, forehand/backhand coverage, and cross-court dynamics. */
export type Handedness = "left" | "right";

/** Which side of the paddle the player uses for a stroke. */
export type StrokeSide = "forehand" | "backhand";

/** Rubber surface type. Fundamentally changes viable shots and ball behavior. */
export type RubberType = "inverted" | "shortPips" | "longPips" | "antispin";

/**
 * Global player attributes affecting all shots and overall play.
 * Scale: 0 (no ability) to 100 (theoretical human peak).
 */
export interface PlayerAttributes {
  /** Recovery speed between shots, ability to reach wide balls. */
  footwork: number;
  /** Response time to fast shots. Reduces time-pressure degradation. */
  reaction: number;
  /** Accuracy of reading incoming spin (direction + magnitude). Defensive skill. */
  spinRead: number;
  /** Ability to disguise spin (same motion, different spins). Offensive skill. */
  deception: number;
  /** Resistance to fatigue. Degrades all stats over long matches when low. */
  stamina: number;
  /** Performance under pressure (deuce, match point, comebacks). */
  mental: number;
  /** Serve execution skill. Determines error between intended and actual serve. */
  service: number;
  /** How quickly the player adjusts tactics mid-match based on what's working/failing. */
  adaptability: number;
}

/** Paddle rubber configuration. */
export interface Rubber {
  /** Surface type — determines spin interaction and viable shots. */
  type: RubberType;
  /** Spin generation capability (0-100). */
  spin: number;
  /** Speed capability (0-100). */
  speed: number;
  /** Control rating (0-100). Typically inversely correlated with speed. */
  control: number;
}

/** Paddle equipment configuration. */
export interface Equipment {
  blade: {
    /** Blade speed rating (0-100). Carbon = higher, all-wood = lower. */
    speed: number;
  };
  forehandRubber: Rubber;
  backhandRubber: Rubber;
}

/**
 * Physical ceilings for one side of the paddle (forehand or backhand).
 * The closer a player pushes toward these ceilings, the higher the risk
 * of execution error. Equipment modifies effective ceilings at runtime.
 */
export interface SideCapabilities {
  /** Maximum power this side can generate (0-100). */
  powerCeiling: number;
  /** Maximum spin this side can generate (0-100). */
  spinCeiling: number;
  /** Base placement accuracy at comfortable effort (0-100). */
  accuracy: number;
  /** Shot-to-shot reliability (0-100). Low = occasional shanks even in ideal conditions. */
  consistency: number;
}

/** Per-side stroke capabilities. */
export interface StrokeCapabilities {
  forehand: SideCapabilities;
  backhand: SideCapabilities;
}

/**
 * Stroke tendencies — the player's playstyle DNA for rally shots.
 * These are BASE values consumed by the default player engine.
 * The engine adjusts them mid-match based on adaptability.
 * Custom player engines may interpret or ignore these.
 * All values 0-100.
 */
export interface StrokeTendencies {
  /** How hard they typically hit (0 = soft touch, 100 = full power). */
  powerBias: number;
  /** How much spin they typically apply (0 = flat, 100 = heavy spin). */
  spinIntensity: number;
  /** Spin direction bias (0 = backspin dominant, 50 = flat/mixed, 100 = topspin dominant). */
  topspinBias: number;
  /** How much sidespin mixed into shots (0 = none, 100 = heavy). */
  sidespinUsage: number;
  /** Shot depth preference (0 = short game near net, 100 = deep driving game). */
  depthBias: number;
  /** Trajectory height preference (0 = net-skimming, 100 = high arc). */
  netClearance: number;
  /** Willingness to push toward ceilings and aim for lines (0 = conservative, 100 = gambler). */
  riskTolerance: number;
}

/**
 * Serve tendency profile. Continuous physical tendencies that define what kinds
 * of serves a player attempts. The engine samples from these to generate each
 * serve's intended properties, then applies error based on the service attribute.
 * Base values adjusted mid-match by adaptability.
 */
export interface ServeTendencies {
  /** Placement depth (0=short, 100=long). */
  length: number;
  /** Speed tendency (0=slow, 100=fast). */
  speed: number;
  /** Spin magnitude tendency (0=flat, 100=heavy spin). */
  spinAmount: number;
  /** Serve-to-serve spin variation (0=same every time, 100=wildly varied). */
  spinVariation: number;
  /** Backspin vs topspin bias (0=pure topspin, 50=equal, 100=pure backspin). */
  backspinBias: number;
  /** Sidespin amount (0=no sidespin, 100=heavy sidespin). */
  sidespinBias: number;
  /** Aggression (0=safe margins, 100=tight to net/edges, more aces + more faults). */
  risk: number;
}

/**
 * A table tennis player.
 * Each player is a separate JSON file in /players/.
 */
export interface Player {
  /** Player's display name. Must be unique across all player files. */
  name: string;
  /** Playing hand. */
  handedness: Handedness;
  /** Starting ELO rating. Optional — unrated players are seeded last. */
  elo?: number;
  /**
   * Which decision engine to use for this player. Defaults to "default".
   * The default engine uses strokeTendencies + serveTendencies + attributes.
   * Custom engines may interpret player data differently.
   */
  decisionEngine?: string;
  /** Global attributes affecting all play. */
  attributes: PlayerAttributes;
  /** Paddle equipment. */
  equipment: Equipment;
  /** Per-side stroke ceilings (forehand/backhand). Equipment rubber maps to the corresponding side. */
  strokeCapabilities: StrokeCapabilities;
  /** Rally shot style tendencies. Base values adjusted mid-match by the player engine. */
  strokeTendencies: StrokeTendencies;
  /** Serve tendency profile. */
  serveTendencies: ServeTendencies;
  /** Optional badges (designed but not active in Phase 1). */
  badges?: string[];
}
