/** Supported tournament formats. */
export type TournamentFormat =
  | "singleElimination"
  | "doubleElimination"
  | "roundRobin"
  | "groupKnockout";

/** How players are seeded in the bracket. */
export type SeedingMethod = "elo" | "random";

/** Per-match scoring rules. Defaults follow ITTF standard. */
export interface MatchRules {
  /** Max games per match. Must be odd. First to >half wins. Default: 7. */
  bestOf: number;
  /** Points to win a game (before deuce). Default: 11. */
  pointsPerGame: number;
  /** Consecutive serves before rotation. During deuce: always 1. Default: 2. */
  servesPerRotation: number;
}

/** Group stage configuration (only for groupKnockout format). */
export interface GroupConfig {
  /** Number of groups. Players distributed by seeding. */
  numberOfGroups: number;
  /** Players advancing from each group to knockout stage. */
  advancePerGroup: number;
}

/**
 * Tournament configuration.
 * Each tournament is a JSON file in /tournaments/.
 */
export interface TournamentConfig {
  /** Optional display name (e.g., "Spring Open 2026"). */
  name?: string;
  /** Tournament structure. Only singleElimination in Phase 1. */
  format: TournamentFormat;
  /** Per-match scoring rules. */
  rules: MatchRules;
  /** Path to folder containing player JSON files. */
  playerSource: string;
  /** Optional list of player filenames to include. Default: all in folder. */
  playerList?: string[];
  /** RNG seed for reproducibility. Same seed + same config = same results. */
  seed: number;
  /** Bracket seeding method. Default: "elo". */
  seeding?: SeedingMethod;
  /** Whether to play a third-place match. Default: false. */
  thirdPlaceMatch?: boolean;
  /** Group stage config. Required when format is "groupKnockout". */
  groupConfig?: GroupConfig;
}
