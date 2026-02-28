/**
 * DefaultPlayerEngine — tendency-based player decision-making.
 *
 * Implements the PlayerEngine interface using the player's stroke/serve
 * tendencies and attributes. Inject a seedable Rng for deterministic
 * simulation.
 *
 * Lifecycle hooks (onPointEnd, onGameEnd, onTimeout) are stubbed — future
 * features (adaptation, fatigue, momentum) will populate them.
 */

import type {
  PlayerEngine,
  PlayerEngineFactory,
  ShotContext,
  ServeContext,
  ShotIntention,
  ServeIntention,
  PointSummary,
} from "../types/index.js";
import type { Player } from "../types/index.js";
import type { Rng } from "../rng.js";
import type { PlayerEngineConfig } from "./constants.js";
import { mergePlayerConfig } from "./constants.js";
import { decideShot } from "./shot-decision.js";
import { decideServe } from "./serve-decision.js";

export class DefaultPlayerEngine implements PlayerEngine {
  private readonly player: Player;
  private readonly rng: Rng;
  private readonly config: PlayerEngineConfig;

  constructor(player: Player, rng: Rng, config?: Partial<PlayerEngineConfig>) {
    this.player = player;
    this.rng = rng;
    this.config = mergePlayerConfig(config);
  }

  decideServe(context: ServeContext): ServeIntention {
    return decideServe(context, this.rng, this.config);
  }

  decideShot(context: ShotContext): ShotIntention {
    return decideShot(context, this.rng, this.config);
  }

  onPointEnd(_result: PointSummary): void {
    // Future: update momentum, adaptation state, fatigue
  }

  onGameEnd(_gameWinner: string): void {
    // Future: between-game mental reset, partial stamina recovery
  }

  onTimeout(): void {
    // Future: mental reset, partial recovery
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
