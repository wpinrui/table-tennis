/**
 * Player engine configuration — every balance-affecting value lives here.
 *
 * To tweak balance:
 * 1. Edit DEFAULT_PLAYER_ENGINE_CONFIG below, or
 * 2. Pass Partial<PlayerEngineConfig> overrides to the factory / constructor.
 *
 * No magic numbers anywhere else in the player engine code.
 */

export interface PlayerEngineConfig {
  // --- Tendency mapping ---
  /** Standard deviation for per-shot Gaussian variation (fraction of tendency). */
  tendencyVariationStddev: number;

  // --- Net clearance mapping ---
  /** Minimum net clearance in cm (tendency=0, net-skimming). */
  minNetClearance: number;
  /** Maximum net clearance in cm (tendency=100, high arc). */
  maxNetClearance: number;

  // --- Table geometry (derived from physics, duplicated for independence) ---
  /** Half-length of the table in cm (Y direction). */
  tableHalfLength: number;
  /** Half-width of the table in cm (X direction). */
  tableHalfWidth: number;

  // --- Target placement ---
  /** Margin from table edge for safest placement (cm). */
  safeMargin: number;
  /** Minimum margin from table edge even at maximum risk (cm). */
  minEdgeMargin: number;
  /** Weight for targeting away from opponent (0-1). */
  opponentAvoidanceWeight: number;

  // --- Depth placement ---
  /** Shortest shot: fraction of opponent half-table depth from net. */
  shortDepthFraction: number;
  /** Deepest shot: fraction of opponent half-table depth from net. */
  deepDepthFraction: number;

  // --- Recovery ---
  /** Ready position depth: distance from table center along Y (cm). */
  readyPositionDepth: number;
  /** How much recovery target shifts toward anticipated return (fraction). */
  recoveryAnticipationFraction: number;

  // --- Pressure modifiers ---
  /** Maximum risk adjustment under pressure (absolute, added/subtracted). */
  pressureRiskAdjustment: number;
  /** Mental score at which pressure effect is neutral (0-100). */
  mentalPressureThreshold: number;

  // --- Positional safety ---
  /** Positional deficit above which the engine forces safer play (0-1). */
  safetyDeficitThreshold: number;
  /** Risk reduction multiplier when deficit exceeds threshold (0-1). */
  deficitRiskReduction: number;

  // --- Side selection ---
  /** Weight for capability-based preference vs randomness (0-1). */
  strongSidePreferenceWeight: number;

  // --- Risk amplification ---
  /** How much risk amplifies tendency values toward extremes. */
  riskAmplification: number;

  // --- Serve ---
  /** Maximum serve net clearance (cm above net). */
  maxServeNetClearance: number;
  /** Serve width range as fraction of table half-width. */
  serveWidthRange: number;

  // --- Deception ---
  /** Base deception scale — how much of the deception attribute is used at zero risk. */
  deceptionBaseScale: number;
  /** Additional deception scale applied per unit of effective risk. */
  deceptionRiskScale: number;
  /** Gaussian noise stddev for per-shot deception variation. */
  deceptionNoiseStddev: number;

  // --- Spin direction noise ---
  /** Gaussian stddev for rally topspin direction noise. */
  topspinNoiseStddev: number;
  /** Gaussian stddev factor for rally sidespin direction noise. */
  sidespinNoiseStddev: number;
  /** Gaussian noise scale for serve topspin variation (multiplied by spinVariation). */
  serveTopspinVariationScale: number;
  /** Gaussian noise scale for serve sidespin variation (multiplied by spinVariation). */
  serveSidespinVariationScale: number;

  // --- Net clearance noise ---
  /** How much risk reduces net clearance (0-1 fraction). */
  netClearanceRiskReduction: number;
  /** Gaussian stddev for rally net clearance noise (cm). */
  shotClearanceNoiseStddev: number;
  /** Gaussian stddev for serve net clearance noise (cm). */
  serveClearanceNoiseStddev: number;

  // --- Target placement noise ---
  /** Width noise scale relative to maxX for rally shots. */
  targetWidthNoiseScale: number;
  /** Per-shot jitter stddev for rally target position (cm). */
  targetJitterStddev: number;
  /** Width noise scale relative to effectiveMaxX for serves. */
  serveWidthNoiseScale: number;
  /** Per-shot jitter stddev for serve target position (cm). */
  serveJitterStddev: number;
}

export const DEFAULT_PLAYER_ENGINE_CONFIG: PlayerEngineConfig = {
  // Tendency mapping
  tendencyVariationStddev: 0.08,

  // Net clearance
  minNetClearance: 1.0,
  maxNetClearance: 25.0,

  // Table geometry
  tableHalfLength: 137,
  tableHalfWidth: 76.25,

  // Target placement
  safeMargin: 15,
  minEdgeMargin: 3,
  opponentAvoidanceWeight: 0.6,

  // Depth placement
  shortDepthFraction: 0.2,
  deepDepthFraction: 0.95,

  // Recovery
  readyPositionDepth: 160,
  recoveryAnticipationFraction: 0.2,

  // Pressure modifiers
  pressureRiskAdjustment: 0.15,
  mentalPressureThreshold: 50,

  // Positional safety
  safetyDeficitThreshold: 0.5,
  deficitRiskReduction: 0.5,

  // Side selection
  strongSidePreferenceWeight: 0.3,

  // Risk amplification
  riskAmplification: 0.3,

  // Serve
  maxServeNetClearance: 8.0,
  serveWidthRange: 0.8,

  // Deception
  deceptionBaseScale: 0.5,
  deceptionRiskScale: 0.5,
  deceptionNoiseStddev: 0.05,

  // Spin direction noise
  topspinNoiseStddev: 0.1,
  sidespinNoiseStddev: 0.7,
  serveTopspinVariationScale: 0.5,
  serveSidespinVariationScale: 0.3,

  // Net clearance noise
  netClearanceRiskReduction: 0.3,
  shotClearanceNoiseStddev: 1.0,
  serveClearanceNoiseStddev: 0.5,

  // Target placement noise
  targetWidthNoiseScale: 0.3,
  targetJitterStddev: 3.0,
  serveWidthNoiseScale: 0.5,
  serveJitterStddev: 2.0,
};

/** Merge a partial config with defaults. */
export function mergePlayerConfig(
  overrides?: Partial<PlayerEngineConfig>,
): PlayerEngineConfig {
  if (!overrides) return { ...DEFAULT_PLAYER_ENGINE_CONFIG };
  return { ...DEFAULT_PLAYER_ENGINE_CONFIG, ...overrides };
}
