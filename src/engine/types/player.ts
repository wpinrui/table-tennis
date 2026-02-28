/** Playing hand — affects serve angles, forehand/backhand coverage, and cross-court dynamics. */
export type Handedness = "left" | "right";

/** Rubber surface type. Fundamentally changes viable shots and ball behavior. */
export type RubberType = "inverted" | "shortPips" | "longPips" | "antispin";

/** Rally shot types available during play. */
export type ShotType =
  | "topspinLoop"
  | "push"
  | "block"
  | "smash"
  | "chop"
  | "flick";

/** Serve types in a player's arsenal. */
export type ServeType =
  | "shortBackspin"
  | "longTopspin"
  | "pendulum"
  | "reversePendulum"
  | "tomahawk";

/** All shot types (rally + serve) that can appear in simulation output. */
export type AnyShotType = ShotType | ServeType;

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
 * Min/max spin magnitude for a shot type.
 * Wide range = varied (deceptive with high deception stat).
 * Narrow range = predictable.
 */
export interface SpinRange {
  /** Minimum spin magnitude (0-100). */
  min: number;
  /** Maximum spin magnitude (0-100). Must be >= min. */
  max: number;
}

/** Skill ratings for a specific shot type. Scale: 0-100. */
export interface ShotRatings {
  /** Maximum power the player can generate on this shot. */
  power: number;
  /** Range of spin magnitude the player can apply. */
  spinRange: SpinRange;
  /** Placement accuracy. Determines Gaussian error width around intended target. */
  accuracy: number;
  /** Shot-to-shot reliability. Low = occasional shanks even in ideal conditions. */
  consistency: number;
}

/** Shot preference weights — the player's playstyle DNA. */
export type ShotPreferences = Record<ShotType, number>;

/** Shot repertoire — skill ratings per shot type. */
export type ShotRepertoire = Record<ShotType, ShotRatings>;

/** Serve arsenal — skill ratings per serve type. */
export type ServeArsenal = Record<ServeType, ShotRatings>;

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
  /** Global attributes affecting all play. */
  attributes: PlayerAttributes;
  /** Paddle equipment. */
  equipment: Equipment;
  /** Shot preference weights (playstyle DNA). Normalized at runtime. */
  preferences: ShotPreferences;
  /** Rally shot skill ratings. */
  shots: ShotRepertoire;
  /** Serve skill ratings. */
  serves: ServeArsenal;
  /** Optional badges (designed but not active in Phase 1). */
  badges?: string[];
}
