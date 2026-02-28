/**
 * DefaultPlayerEngine — tendency-based player decision-making.
 *
 * Implements the PlayerEngine interface using the player's stroke/serve
 * tendencies and attributes. Inject a seedable Rng for deterministic
 * simulation.
 *
 * Stateful per match: tracks spin misread and stamina fatigue.
 */

import type {
  Player,
  PlayerEngine,
  PlayerEngineFactory,
  ShotContext,
  ServeContext,
  ShotIntention,
  ServeIntention,
  PointSummary,
} from "../types/index.js";
import type { Rng } from "../rng.js";
import type { PlayerEngineConfig } from "./constants.js";
import { mergePlayerConfig } from "./constants.js";
import { decideShot } from "./shot-decision.js";
import { decideServe } from "./serve-decision.js";
import {
  computeReadDifficulty,
  computeReadAccuracy,
  computePerceivedSpin,
} from "./spin-read.js";
import { clamp } from "../math/vec-math.js";

export class DefaultPlayerEngine implements PlayerEngine {
  private readonly player: Player;
  private readonly rng: Rng;
  private readonly config: PlayerEngineConfig;

  /** Spin misread from the most recent decideShot call (0-1). */
  private lastMisread: number = 0;
  /** Cumulative fatigue (0 = fresh, approaches 1 = exhausted). */
  private fatigue: number = 0;

  constructor(player: Player, rng: Rng, config?: Partial<PlayerEngineConfig>) {
    this.player = player;
    this.rng = rng;
    this.config = mergePlayerConfig(config);
  }

  decideServe(context: ServeContext): ServeIntention {
    return decideServe(context, this.rng, this.config);
  }

  decideShot(context: ShotContext): ShotIntention {
    const arrival = context.arrival;

    // --- Spin read pipeline ---
    // Find the opponent's deception effort from the last shot in the rally
    const lastShot = context.rallyHistory.length > 0
      ? context.rallyHistory[context.rallyHistory.length - 1]
      : undefined;
    const senderDeception = context.opponent.attributes.deception;
    // Use the last shot's deception effort if available, otherwise assume 0
    const deceptionEffort = lastShot?.deceptionEffort ?? 0;

    const readDifficulty = computeReadDifficulty(
      senderDeception, deceptionEffort, this.config,
    );
    const readAccuracy = computeReadAccuracy(
      this.player.attributes.spinRead, readDifficulty, this.config,
    );
    const { misread } = computePerceivedSpin(
      arrival.ballSpin, readAccuracy, this.rng, this.config,
    );
    this.lastMisread = misread;

    // --- Stamina drain ---
    // High stamina attribute (0-100) means slower drain
    const staminaResistance = this.player.attributes.stamina / 100;
    const drain =
      (this.config.staminaDrainBase +
        arrival.positionalDeficit * this.config.staminaDrainDeficitScale) *
      (1 - staminaResistance * 0.8); // Even stamina=100 still drains 20%
    this.fatigue = clamp(this.fatigue + drain, 0, 1);

    return decideShot(context, this.rng, this.config);
  }

  onPointEnd(_result: PointSummary): void {
    // Future: update momentum, adaptation state
  }

  onGameEnd(_gameWinner: string): void {
    // Between-game partial stamina recovery
    this.fatigue = clamp(
      this.fatigue * (1 - this.config.staminaGameRecovery), 0, 1,
    );
  }

  onTimeout(): void {
    // Timeout partial stamina recovery
    this.fatigue = clamp(
      this.fatigue * (1 - this.config.staminaTimeoutRecovery), 0, 1,
    );
  }

  getLastMisread(): number {
    return this.lastMisread;
  }

  getStaminaFactor(): number {
    return clamp(1 - this.fatigue, 0, 1);
  }
}

/**
 * Create a factory that produces DefaultPlayerEngine instances.
 *
 * The Rng is captured by the closure and shared across all player engines
 * created by this factory — both players consume from the same deterministic
 * stream, ensuring seed reproducibility.
 */
export function createDefaultPlayerEngineFactory(
  rng: Rng,
  config?: Partial<PlayerEngineConfig>,
): PlayerEngineFactory {
  return (player: Player) => new DefaultPlayerEngine(player, rng, config);
}
