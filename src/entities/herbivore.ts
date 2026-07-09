import type { SimulationConfig } from '../config.ts';
import type { SimContext } from '../context.ts';
import { resolveHerbivoreBehavior } from './behavior-factory.ts';
import { Insect } from './insect.ts';

export class Herbivore extends Insect {
  private readonly _config: SimulationConfig;

  constructor(
    id: string,
    cell: number,
    energy: number,
    config: SimulationConfig,
  ) {
    super('herbivore', id, cell, energy);
    this._config = config;
  }

  get config(): SimulationConfig {
    return this._config;
  }

  spawnOffspring(ctx: SimContext, cell: number): Herbivore {
    return new Herbivore(ctx.nextId('h'), cell, 5, this._config);
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
    resolveHerbivoreBehavior(this._config.herbivoreBehavior).tick(this, ctx);
  }
}
