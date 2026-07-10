import type { SimulationConfig } from '../../config';
import type { SimContext } from '../../context';
import {
  HERBIVORE_BEHAVIOR_IDS,
  type HerbivoreBehaviorId,
  type InsectBehaviorStrategy,
  resolveHerbivoreBehavior,
} from '@/behaviors';
import { insectRegistry } from './insect-registry';
import { Insect } from './insect';

export class Herbivore extends Insect {
  readonly behaviorId: HerbivoreBehaviorId;
  private readonly behavior: InsectBehaviorStrategy<Herbivore>;
  private readonly _config: SimulationConfig;

  constructor(id: string, cell: number, energy: number, config: SimulationConfig, behaviorId: HerbivoreBehaviorId) {
    super('herbivore', id, cell, energy);
    this._config = config;
    this.behaviorId = behaviorId;
    this.behavior = resolveHerbivoreBehavior(behaviorId);
  }

  get config(): SimulationConfig {
    return this._config;
  }

  /** Spawn an offspring with a randomly chosen behavior profile. */
  spawnOffspring(ctx: SimContext, cell: number): Herbivore {
    const behaviorId = ctx.rng.pick(HERBIVORE_BEHAVIOR_IDS) ?? 'default';
    return new Herbivore(ctx.nextId('h'), cell, 5, this._config, behaviorId);
  }

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

  protected onDeath(ctx: SimContext): void {
    ctx.stats.herbivoreDeaths += 1;
  }

  /** Bias random movement toward cells with nearby plants. */
  protected extraMoveBias(cell: number, ctx: SimContext): number {
    return ctx.world.neighbors8(cell).filter((c) => ctx.plants.has(c)).length * 0.7;
  }

  protected tickBehavior(ctx: SimContext): void {
    this.behavior.tick(this, ctx);
  }
}

insectRegistry.register({
  kind: 'herbivore',
  behaviorIds: HERBIVORE_BEHAVIOR_IDS,
  seedEnergyRange: [6, 12],
  initialCount: (config) => config.initialHerbivores,
  create: (id, cell, energy, config, behaviorId) =>
    new Herbivore(id, cell, energy, config, behaviorId as HerbivoreBehaviorId),
});