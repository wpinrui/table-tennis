/** ELO rating change from a single tournament. */
export interface EloHistoryEntry {
  tournamentId: string;
  tournamentName?: string;
  /** ISO 8601 timestamp. */
  date: string;
  eloBefore: number;
  eloAfter: number;
  /** Net change (eloAfter - eloBefore). */
  eloChange: number;
}

/** Win/loss record against a specific opponent. */
export interface HeadToHeadRecord {
  wins: number;
  losses: number;
}

/** Competitive record for a single player across all tournaments. */
export interface PlayerRecord {
  currentElo: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  /** True if matchesPlayed < provisionalThreshold. Higher K-factor applies. */
  provisional: boolean;
  /** One entry per tournament, ordered chronologically. */
  history: EloHistoryEntry[];
  /** Head-to-head records keyed by opponent name. */
  headToHead: Record<string, HeadToHeadRecord>;
}

/** ELO system configuration. */
export interface EloConfig {
  /** K-factor for established players. Default: 32. */
  kFactor: number;
  /** K-factor for provisional players. Default: 64. */
  provisionalKFactor: number;
  /** Matches before a player is no longer provisional. Default: 10. */
  provisionalThreshold: number;
}

/**
 * ELO ledger — tracks ratings and competitive history across tournaments.
 * Stored in /results/ledger.json. Separate from player files.
 */
export interface Ledger {
  /** Per-player records keyed by player name. */
  players: Record<string, PlayerRecord>;
  /** ELO system configuration. */
  config: EloConfig;
}
