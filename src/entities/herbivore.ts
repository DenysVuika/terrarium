import type { SimulationConfig } from '../config.ts';
import type { SimContext } from '../context.ts';
import {
  HERBIVORE_BEHAVIOR_IDS,
  type HerbivoreBehaviorId,
} from './behavior.ts';
import { resolveHerbivoreBehavior } from './behavior-factory.ts';
import { insectRegistry } from './insect-registry.ts';
import { Insect } from './insect.ts';

export class Herbivore extends Insect {
  readonly behaviorId: HerbivoreBehaviorId;
  private readonly _config: SimulationConfig;

  constructor(
    id: string,
    cell: number,
    energy: number,
    config: SimulationConfig,
    behaviorId: HerbivoreBehaviorId,
  ) {
    super('herbivore', id, cell, energy);
    this._config = config;
    this.behaviorId = behaviorId;
  }

  get config(): SimulationConfig {
    return this._config;
  }

  /** Spawn an offspring with a randomly chosen behavior profile. */
  spawnOffspring(ctx: SimContext, cell: number): Herbivore {
    const behaviorId = ctx.rng.pick(HERBIVORE_BEHAVIOR_IDS) ?? 'default';
    return new Herbivore(ctx.nextId('h'), cell, 5, this._config, behaviorId);
  }

  // Species parameters

  protected get eggStageTicks(): number {
    return this._config.eggStageTicks;
  }
  protected get larvaStageTicks(): number {
    return this._config.larvaStageTicks;
  }
  protected get maxAge(): number {
    return this._config.herbivoreMaxAge;
  }
  protected get starvationLimit(): number {
    return this._config.herbivoreStarvationTicks;
  }
  protected get metabolismPerTick(): number {
    return this._config.herbivoreMetabolismPerTick;
  }
  protected get dehydrationPenalty(): number {
    return this._config.herbivoreDehydrationPenalty;
  }
  protected get moveEnergyCost(): number {
    return this._config.herbivoreMoveEnergyCost;
  }

  // Hooks

  protected onDeath(ctx: SimContext): void {
    ctx.stats.herbivoreDeaths += 1;
  }

  /** Bias random movement toward cells with nearby plants. */
  protected extraMoveBias(cell: number, ctx: SimContext): number {
    return (
      ctx.world.neighbors8(cell).filter((c) => ctx.plants.has(c)).length * 0.7
    );
  }

  protected tickBehavior(ctx: SimContext): void {
    resolveHerbivoreBehavior(this.behaviorId).tick(this, ctx);
  }
}

// Self-register so the simulator discovers this species without any imports in
// simulator.ts. New species follow the same pattern in their own files.
insectRegistry.register({
  kind: 'herbivore',
  behaviorIds: HERBIVORE_BEHAVIOR_IDS,
  seedEnergyRange: [6, 12],
  initialCount: (config) => config.initialHerbivores,
  create: (id, cell, energy, config, behaviorId) =>
    new Herbivore(id, cell, energy, config, behaviorId as HerbivoreBehaviorId),
});
