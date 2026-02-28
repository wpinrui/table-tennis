import type { StrokeSide } from "./player.js";

/** 3D vector in cm. Origin at table center. X=width, Y=length, Z=height (table=0). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 2D court position (X, Y). Used for player positions. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Ball flight data for a single shot. Enough to reconstruct full trajectory. */
export interface BallTrajectory {
  /** Ball position at paddle contact (cm). */
  startPosition: Vec3;
  /** Ball velocity at paddle contact (cm/s). */
  velocity: Vec3;
  /** Ball spin at contact (rev/s). X=sidespin, Y=top/backspin, Z=gyrospin. +Y=topspin. */
  spin: Vec3;
  /** Highest point of the ball's arc (cm). */
  apex: Vec3;
  /** Where the ball lands or goes out of play (cm). Z≈0 for table contact. */
  landingPosition: Vec3;
}

/**
 * How a point ended.
 * Net touches and edge contacts during rallies are physics events (trajectory
 * deflections), not point outcomes — the rally simply continues with the
 * altered ball. The only net special case is a serve let (replay), which
 * is handled by the umpire and never produces a point outcome.
 */
export type PointOutcomeReason =
  | "unreturnable"
  | "unforcedError"
  | "offTable"
  | "intoNet";

/** A single shot in a rally. */
export interface Shot {
  /** Player who hit this shot. */
  player: string;
  /**
   * Which side of the paddle was used, or "serve" for the first shot.
   * Named shot types (loop, chop, etc.) are not tracked — shots are
   * described entirely by their physical properties in ballTrajectory.
   */
  side: StrokeSide | "serve";
  /** Ball flight data. */
  ballTrajectory: BallTrajectory;
  /** Both players' court positions when this shot was hit. */
  playerPositions: {
    player1: Vec2;
    player2: Vec2;
  };
  /** Execution quality (0-1). 1 = perfect conditions, lower = degraded by position/pressure/misread/stamina. */
  executionQuality: number;
}

/** Score state (points in a game, or games in a match). */
export interface Score {
  player1: number;
  player2: number;
}

/** A single point in a match. */
export interface Point {
  /** Which game this point belongs to (1-indexed). */
  gameNumber: number;
  /** Name of the serving player. */
  server: string;
  /** Score in the current game BEFORE this point was played. */
  scoreBefore: Score;
  /** Full rally — every shot from serve to point end. First shot is always the serve (side: "serve"). */
  shots: Shot[];
  /** How the point ended. */
  outcome: {
    winner: string;
    reason: PointOutcomeReason;
  };
}

/** Per-game score. */
export interface GameScore {
  player1Points: number;
  player2Points: number;
}

/** Aggregated statistics for one player in a match. */
export interface MatchPlayerStats {
  pointsWon: number;
  pointsLost: number;
  pointsWonOnServe: number;
  pointsWonOnReturn: number;
  avgRallyLength: number;
  unforcedErrors: number;
  winners: number;
}

/** A complete match between two players. */
export interface Match {
  /** Unique ID within the tournament. */
  matchId: string;
  /** Tournament round (0 = first round). */
  round: number;
  /** Player 1 name (typically higher seed). */
  player1: string;
  /** Player 2 name. */
  player2: string;
  /** Match winner name. */
  winner: string;
  /** Final match score (games won). */
  score: Score;
  /** Per-game scores. */
  games: GameScore[];
  /** Every point played, in order. */
  points: Point[];
  /** Per-player match statistics. */
  stats: {
    player1: MatchPlayerStats;
    player2: MatchPlayerStats;
  };
}

/** A round in the tournament bracket. */
export interface BracketRound {
  /** Round number (0 = first round). */
  round: number;
  /** Match IDs in this round, in bracket order. */
  matchIds: string[];
}

/** Final standing for a player. */
export interface Standing {
  player: string;
  /** Final position (1 = winner). */
  position: number;
}

/** Complete tournament results — output of a simulation run. */
export interface TournamentResults {
  /** Auto-generated UUID for this tournament run. */
  tournamentId: string;
  /** Display name from config (if provided). */
  tournamentName?: string;
  /** ISO 8601 timestamp of when the simulation was run. */
  date: string;
  /** RNG seed used. Re-run with this seed for identical results. */
  seed: number;
  /** Tournament format used. */
  format: string;
  /** All player names, in seeded order. */
  players: string[];
  /** Bracket organized by rounds. */
  bracket: BracketRound[];
  /** All matches with full detail. */
  matches: Match[];
  /** Final standings. */
  standings: Standing[];
}
