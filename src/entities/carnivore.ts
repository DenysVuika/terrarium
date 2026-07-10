import type { SimulationConfig } from '../config';
import type { SimContext } from '../context';
import {
  CARNIVORE_BEHAVIOR_IDS,
  type CarnivoreBehaviorId,
  resolveCarnivoreBehavior,
} from '@/behaviors';
import { TERRAIN } from '../world';
import { insectRegistry } from './insect-registry';
import { Insect } from './insect';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class Carnivore extends Insect {
  ap: number;
  readonly behaviorId: CarnivoreBehaviorId;
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

  // Species parameters

  protected get eggStageTicks(): number {
    return this._config.carnivoreEggStageTicks;
  }
  protected get larvaStageTicks(): number {
    return this._config.carnivoreLarvaStageTicks;
  }
  protected get maxAge(): number {
    return this._config.carnivoreMaxAge;
  }
  protected get starvationLimit(): number {
    return this._config.carnivoreStarvationTicks;
  }
  protected get metabolismPerTick(): number {
    return this._config.carnivoreMetabolismPerTick;
  }
  protected get dehydrationPenalty(): number {
    return this._config.carnivoreDehydrationPenalty;
  }
  protected get moveEnergyCost(): number {
    return this._config.carnivoreMoveEnergyCost;
  }

  // Hooks

  protected tickExtraLifecycle(ctx: SimContext): void {
    this.ap = clamp(this.ap + ctx.config.carnivoreApRegenPerTick, 0, 10);
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
    resolveCarnivoreBehavior(this.behaviorId).tick(this, ctx);
  }
}

// Self-register so the simulator discovers this species without any imports in
// simulator.ts. New species follow the same pattern in their own files.
insectRegistry.register({
  kind: 'carnivore',
  behaviorIds: CARNIVORE_BEHAVIOR_IDS,
  seedEnergyRange: [10, 18],
  initialCount: (config) => config.initialCarnivores,
  create: (id, cell, energy, config, behaviorId) =>
    new Carnivore(id, cell, energy, config, behaviorId as CarnivoreBehaviorId),
  afterSeed: (insect, rng) => {
    (insect as Carnivore).ap = rng.int(1, 6);
  },
});
