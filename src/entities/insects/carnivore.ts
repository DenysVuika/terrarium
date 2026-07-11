import type { SimulationConfig } from '../../config';
import type { SimContext } from '../../context';
import {
  CARNIVORE_BEHAVIOR_IDS,
  type CarnivoreBehaviorId,
  type InsectBehaviorStrategy,
  resolveCarnivoreBehavior,
} from '@/behaviors';
import { TERRAIN } from '../../world';
import { insectRegistry } from './insect-registry';
import { Insect } from './insect';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class Carnivore extends Insect {
  ap: number;
  readonly behaviorId: CarnivoreBehaviorId;
  private readonly behavior: InsectBehaviorStrategy<Carnivore>;
  private readonly _config: SimulationConfig;

  constructor(
    id: string,
    cell: number,
    energy: number,
    config: SimulationConfig,
    behaviorId: CarnivoreBehaviorId,
  ) {
    super('carnivore', id, cell, energy);
    this._config = config;
    this.behaviorId = behaviorId;
    this.behavior = resolveCarnivoreBehavior(behaviorId);
    this.ap = 0;
  }

  get config(): SimulationConfig {
    return this._config;
  }

  /** Spawn an offspring with a randomly chosen behavior profile. */
  spawnOffspring(ctx: SimContext, cell: number): Carnivore {
    const behaviorId = ctx.rng.pick(CARNIVORE_BEHAVIOR_IDS) ?? 'default';
    return new Carnivore(ctx.nextId('c'), cell, 7, this._config, behaviorId);
  }

  protected get eggStageTicks(): number {
    return this._config.insects.carnivores.eggStageTicks;
  }
  protected get larvaStageTicks(): number {
    return this._config.insects.carnivores.larvaStageTicks;
  }
  protected get maxAge(): number {
    return this._config.insects.carnivores.maxAge;
  }
  protected get agePerTick(): number {
    return this._config.insects.carnivores.agePerTick;
  }
  protected get starvationLimit(): number {
    return this._config.insects.carnivores.starvationTicks;
  }
  protected get metabolismPerTick(): number {
    return this._config.insects.carnivores.metabolismPerTick;
  }
  protected get dehydrationPenalty(): number {
    return this._config.insects.carnivores.dehydrationPenalty;
  }
  protected get moveEnergyCost(): number {
    return this._config.insects.carnivores.moveEnergyCost;
  }

  protected tickExtraLifecycle(ctx: SimContext): void {
    this.ap = clamp(this.ap + ctx.config.insects.carnivores.apRegenPerTick, 0, 10);
  }

  protected onAfterMove(targetCell: number, ctx: SimContext): void {
    if (ctx.world.terrain[targetCell] === TERRAIN.SAND) {
      this.ap = clamp(this.ap - 1, 0, 10);
    }
  }

  protected onDeath(ctx: SimContext): void {
    this.ap = 0;
    ctx.stats.carnivoreDeaths += 1;
  }

  protected tickBehavior(ctx: SimContext): void {
    this.behavior.tick(this, ctx);
  }
}

insectRegistry.register({
  kind: 'carnivore',
  behaviorIds: CARNIVORE_BEHAVIOR_IDS,
  seedEnergyRange: [10, 18],
  initialCount: (config) => config.insects.carnivores.initialCount,
  create: (id, cell, energy, config, behaviorId) =>
    new Carnivore(id, cell, energy, config, behaviorId as CarnivoreBehaviorId),
  afterSeed: (insect, rng) => {
    (insect as Carnivore).ap = rng.int(1, 6);
  },
});