import type { SimulationConfig } from '../config.ts';
import type { SimContext } from '../context.ts';
import { TERRAIN } from '../world.ts';
import { CARNIVORE_BEHAVIOR_IDS, type CarnivoreBehaviorId } from './behavior.ts';
import { resolveCarnivoreBehavior } from './behavior-factory.ts';
import { Insect } from './insect.ts';

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
