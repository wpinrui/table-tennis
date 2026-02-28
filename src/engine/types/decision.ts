import type { Vec2, Vec3, PointOutcomeReason } from "./results.js";
import type { Player, StrokeSide, StrokeCapabilities, Equipment } from "./player.js";

// ---------------------------------------------------------------------------
// Player Engine — input types
// ---------------------------------------------------------------------------

/**
 * Ball state as computed by the physics engine after it arrives on the
 * receiver's side. These are the ACTUAL physical properties — the player
 * engine is responsible for modelling perception (spin read / deception)
 * internally.
 */
export interface ArrivalState {
  /** Ball position at the moment the player must make contact (cm). */
  ballPosition: Vec3;
  /** Ball velocity at arrival (cm/s). */
  ballVelocity: Vec3;
  /** Ball spin at arrival (rev/s). Actual, not perceived. */
  ballSpin: Vec3;
  /** Seconds between the opponent's contact and this player's contact window. */
  timeAvailable: number;
  /** Which sides the player can physically reach given position + time. */
  availableSides: StrokeSide[];
  /**
   * How far the player is from the ideal contact point (0 = perfect position,
   * 1 = absolute maximum reach). Driven by footwork + time available.
   */
  positionalDeficit: number;
}

/**
 * Full context passed to the player engine when deciding a rally shot.
 * Contains everything the player "knows" — objective ball state, match
 * situation, and historical trends.
 */
export interface ShotContext {
  /** Ball arrival state from the physics engine. */
  arrival: ArrivalState;
  /** This player's current court position. */
  playerPosition: Vec2;
  /** Opponent's current court position. */
  opponentPosition: Vec2;
  /** This player's full data (attributes, equipment, capabilities, tendencies). */
  player: Player;
  /** Opponent's full data (observable in a real match — scouting report). */
  opponent: Player;
  /** Score state from the umpire. */
  matchState: MatchState;
  /** Previous shots in the current rally (most recent last). */
  rallyHistory: RecordedShot[];
  /** Summary of recent points for trend / adaptation analysis. */
  recentPoints: PointSummary[];
}

/**
 * Context passed to the player engine when deciding a serve.
 * No incoming ball — the server initiates play.
 */
export interface ServeContext {
  /** Server's court position (always behind the end line). */
  playerPosition: Vec2;
  /** Receiver's court position (always at the receiving position). */
  opponentPosition: Vec2;
  /** This player's full data. */
  player: Player;
  /** Opponent's full data. */
  opponent: Player;
  /** Score state from the umpire. */
  matchState: MatchState;
  /** Summary of recent points for trend / adaptation analysis. */
  recentPoints: PointSummary[];
}

// ---------------------------------------------------------------------------
// Player Engine — output types (intentions)
// ---------------------------------------------------------------------------

/**
 * The player engine's intended rally shot. Pure intention — no physics
 * knowledge. The physics engine determines what actually happens.
 */
export interface ShotIntention {
  /** Which side of the paddle to use. */
  side: StrokeSide;
  /** How much of the player's power ceiling to use (0 = soft, 1 = full power). */
  power: number;
  /** How much of the player's spin ceiling to use (0 = flat, 1 = max spin). */
  spinIntensity: number;
  /** Spin direction intention. */
  spinDirection: {
    /** -1 = pure backspin, 0 = flat, 1 = pure topspin. */
    topspin: number;
    /** -1 = left sidespin, 0 = none, 1 = right sidespin. */
    sidespin: number;
  };
  /** Target position on the table (cm, in table coordinate space). */
  targetPosition: Vec2;
  /** Intended net clearance height (cm above net). Higher = safer but more attackable. */
  netClearance: number;
  /** Deception effort (0 = honest motion, 1 = maximum disguise). */
  deceptionEffort: number;
  /** Recovery target — where the player intends to move after hitting (cm). */
  recoveryTarget: Vec2;
}

/**
 * The player engine's intended serve. Same structure as ShotIntention
 * but without recovery target (server always recovers to ready position).
 */
export interface ServeIntention {
  /** Which side of the paddle to use for the serve. */
  side: StrokeSide;
  /** Power fraction (0-1). */
  power: number;
  /** Spin intensity fraction (0-1). */
  spinIntensity: number;
  /** Spin direction intention. */
  spinDirection: {
    topspin: number;
    sidespin: number;
  };
  /** Target position on the RECEIVER's half of the table (cm). */
  targetPosition: Vec2;
  /** Intended net clearance height (cm above net). */
  netClearance: number;
  /** Deception effort (0-1). */
  deceptionEffort: number;
}

// ---------------------------------------------------------------------------
// Physics Engine — output types
// ---------------------------------------------------------------------------

/**
 * Output of the physics engine after executing a shot or serve.
 * Describes what physically happened to the ball.
 */
export interface BallFlight {
  /** Ball position at paddle contact (cm). */
  startPosition: Vec3;
  /** Ball velocity at paddle contact (cm/s). */
  velocity: Vec3;
  /** Ball spin at paddle contact (rev/s). */
  spin: Vec3;
  /** Highest point of the ball's arc (cm). */
  apex: Vec3;
  /**
   * Where the ball lands — table surface, floor, or net.
   * Z ≈ 0 for table contact. Null if ball hit the net and didn't cross.
   */
  landingPosition: Vec3;
  /** Whether the ball made contact with the net during flight. */
  netContact: boolean;
  /**
   * Whether the ball clipped the edge of the table. Edge contact produces
   * an unpredictable trajectory change.
   */
  edgeContact: boolean;
  /**
   * Execution quality achieved (0-1). Reflects how closely the actual shot
   * matched the intention, degraded by positional deficit, time pressure,
   * spin misread, stamina, and risk taken.
   */
  executionQuality: number;
  /** Total flight time from paddle contact to landing (seconds). */
  flightTime: number;
}

// ---------------------------------------------------------------------------
// Umpire Engine — types
// ---------------------------------------------------------------------------

/** Ruling after a serve. */
export type ServeRuling =
  | { result: "inPlay" }
  | { result: "let" }
  | { result: "fault"; reason: string };

/** Ruling after a rally shot. */
export type ShotRuling =
  | { result: "continue" }
  | { result: "point"; winner: string; reason: PointOutcomeReason };

// ---------------------------------------------------------------------------
// Match state — shared context from umpire + match engine
// ---------------------------------------------------------------------------

/** Score state passed to engines for decision-making. */
export interface MatchState {
  /** Current game score (points). */
  score: { player1: number; player2: number };
  /** Games won in this match. */
  gamesScore: { player1: number; player2: number };
  /** Current game number (1-indexed). */
  gameNumber: number;
  /** Name of the current server. */
  server: string;
  /** Player 1 name (for mapping score fields). */
  player1Name: string;
  /** Player 2 name. */
  player2Name: string;
  /** Whether the current game is at deuce (both ≥ pointsPerGame - 1). */
  isDeuce: boolean;
  /** Whether this point is game point for either player. */
  isGamePoint: boolean;
  /** Whether this point is match point for either player. */
  isMatchPoint: boolean;
}

// ---------------------------------------------------------------------------
// Recorded shot — what gets written to rally history and results
// ---------------------------------------------------------------------------

/** A shot as recorded in rally history (available to player engine for context). */
export interface RecordedShot {
  /** Player who hit this shot. */
  player: string;
  /** Which side was used. */
  side: StrokeSide;
  /** The ball flight that resulted. */
  ballFlight: BallFlight;
}

/** Minimal summary of a completed point (for trend analysis in player engine). */
export interface PointSummary {
  /** Who won the point. */
  winner: string;
  /** Who served. */
  server: string;
  /** Number of shots in the rally. */
  rallyLength: number;
  /** How the point ended. */
  reason: PointOutcomeReason;
}

// ---------------------------------------------------------------------------
// Engine interfaces — the swappable contracts
// ---------------------------------------------------------------------------

/**
 * Player Engine — the player's "brain". Stateful, created per player per
 * match. Translates game state into shot intentions. Internally handles
 * perception (spin read), psychology (momentum), adaptation (tendency
 * shifts), and fatigue effects on decision-making.
 *
 * Different implementations create fundamentally different players.
 * The default implementation uses strokeTendencies + strokeCapabilities
 * from the player file.
 */
export interface PlayerEngine {
  /** Decide what serve to hit. */
  decideServe(context: ServeContext): ServeIntention;
  /** Decide what rally shot to hit. */
  decideShot(context: ShotContext): ShotIntention;
  /** Called after each point — update internal state (momentum, adaptation, fatigue). */
  onPointEnd(result: PointSummary): void;
  /** Called after each game — between-game processing (partial recovery, mental reset). */
  onGameEnd(gameWinner: string): void;
  /** Called when this player takes a timeout. */
  onTimeout(): void;
}

/**
 * Physics Engine — pure math, stateless. No game knowledge.
 * Knows about ball physics AND player movement physics (footwork).
 */
export interface PhysicsEngine {
  /**
   * Analyze an incoming ball and the receiving player's physical options.
   * Called BEFORE the player engine decides (pre-decision analysis).
   */
  analyzeArrival(
    ball: BallFlight,
    receiverPosition: Vec2,
    receiverCapabilities: StrokeCapabilities,
    receiverFootwork: number,
  ): ArrivalState;

  /**
   * Execute a rally shot intention and produce the resulting ball flight.
   * Applies execution quality degradation based on risk, position, etc.
   */
  executeShot(
    intention: ShotIntention,
    capabilities: StrokeCapabilities,
    equipment: Equipment,
    arrival: ArrivalState,
  ): BallFlight;

  /**
   * Execute a serve intention and produce the resulting ball flight.
   * Applies error based on service attribute.
   */
  executeServe(
    intention: ServeIntention,
    capabilities: StrokeCapabilities,
    equipment: Equipment,
    serviceSkill: number,
  ): BallFlight;

  /**
   * Compute where a player ends up after recovery movement.
   * Called after each shot to update both players' positions.
   */
  computeRecovery(
    currentPosition: Vec2,
    targetPosition: Vec2,
    footwork: number,
    timeAvailable: number,
  ): Vec2;
}

/**
 * Umpire Engine — rules authority, owns score state.
 * Adjudicates serves and shots, tracks scoring, manages serve rotation.
 */
export interface UmpireEngine {
  /** Judge a serve. Only the umpire handles the serve-let special case. */
  judgeServe(ball: BallFlight): ServeRuling;
  /** Judge a rally shot. Returns continue or point-awarded. */
  judgeShot(ball: BallFlight): ShotRuling;
  /** Award a point and update internal score state. */
  awardPoint(winner: string): void;
  /** Get current match state (score, server, game number, flags). */
  getMatchState(): MatchState;
  /** Check if the current game is over. */
  isGameOver(): boolean;
  /** Check if the match is over. */
  isMatchOver(): boolean;
  /** Check if a player can still call a timeout. */
  canTimeout(player: string): boolean;
  /** Record that a player used their timeout. */
  useTimeout(player: string): void;
}

/**
 * Factory function that creates a PlayerEngine instance for a match.
 * The engine type is determined by the player's decisionEngine field
 * (defaults to "default").
 */
export type PlayerEngineFactory = (player: Player) => PlayerEngine;
