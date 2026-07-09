import type { SimulationConfig } from '../config.ts';
import type { SimContext } from '../context.ts';
import type {
  HerbivoreBehaviorId,
  InsectBehaviorStrategy,
} from './behavior.ts';
import { Insect } from './insect.ts';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

class DefaultHerbivoreBehavior implements InsectBehaviorStrategy<Herbivore> {
  tick(entity: Herbivore, ctx: SimContext): void {
    const { world, config, rng } = ctx;

    const targetPlant = entity.findNearestPlant(2, ctx);
    if (targetPlant >= 0) {
      entity.moveToward(targetPlant, ctx);
    } else {
      entity.moveRandom(ctx);
    }

    const consumablePlants = [entity.cell]
      .concat(world.neighbors8(entity.cell))
      .filter((cell, index, cells) => cells.indexOf(cell) === index)
      .filter((cell) => ctx.plants.has(cell));

    if (consumablePlants.length > 0 && rng.chance(0.8)) {
      const plantCell = rng.pick(consumablePlants);
      if (plantCell !== null) {
        ctx.plants.delete(plantCell);
        world.nutrients[plantCell] = clamp(
          world.nutrients[plantCell] + 50,
          0,
          300,
        );
        entity.energy += 5;
      }
    }

    const localHerbivores = world
      .neighbors8(entity.cell)
      .filter((cell) =>
        ctx.herbivores.some(
          (h) => h.alive && h.cell === cell && h.id !== entity.id,
        ),
      ).length;
    const liveHerbivores = ctx.herbivores.filter((h) => h.alive).length;
    const herbivoreGlobalCap = Math.max(
      1,
      Math.floor(ctx.plants.size * config.herbivorePopulationCapPerPlant),
    );

    if (
      entity.energy >= config.herbivoreBreedEnergyMin &&
      entity.cooldown <= 0 &&
      localHerbivores < config.herbivoreBreedLocalCap &&
      liveHerbivores < herbivoreGlobalCap &&
      rng.chance(config.herbivoreBreedChance)
    ) {
      const spawnCell = entity.findSpawnCell(ctx);
      if (spawnCell >= 0) {
        entity.energy -= config.herbivoreBreedEnergyCost;
        entity.cooldown = config.herbivoreBreedCooldown;
        const child = new Herbivore(
          ctx.nextId('h'),
          spawnCell,
          5,
          entity.config,
        );
        ctx.herbivores.push(child);
        ctx.occupied.add(spawnCell);
        ctx.stats.herbivoreBirths += 1;
      }
    }
  }
}

class ForagerHerbivoreBehavior implements InsectBehaviorStrategy<Herbivore> {
  tick(entity: Herbivore, ctx: SimContext): void {
    const { world, config, rng } = ctx;

    // More plant-seeking profile: wider search and slightly higher consume chance.
    const targetPlant = entity.findNearestPlant(3, ctx);
    if (targetPlant >= 0) {
      entity.moveToward(targetPlant, ctx);
    } else {
      entity.moveRandom(ctx);
    }

    const consumablePlants = [entity.cell]
      .concat(world.neighbors8(entity.cell))
      .filter((cell, index, cells) => cells.indexOf(cell) === index)
      .filter((cell) => ctx.plants.has(cell));

    if (consumablePlants.length > 0 && rng.chance(0.9)) {
      const plantCell = rng.pick(consumablePlants);
      if (plantCell !== null) {
        ctx.plants.delete(plantCell);
        world.nutrients[plantCell] = clamp(
          world.nutrients[plantCell] + 50,
          0,
          300,
        );
        entity.energy += 5;
      }
    }

    const localHerbivores = world
      .neighbors8(entity.cell)
      .filter((cell) =>
        ctx.herbivores.some(
          (h) => h.alive && h.cell === cell && h.id !== entity.id,
        ),
      ).length;
    const liveHerbivores = ctx.herbivores.filter((h) => h.alive).length;
    const herbivoreGlobalCap = Math.max(
      1,
      Math.floor(ctx.plants.size * config.herbivorePopulationCapPerPlant),
    );

    if (
      entity.energy >= config.herbivoreBreedEnergyMin &&
      entity.cooldown <= 0 &&
      localHerbivores < config.herbivoreBreedLocalCap &&
      liveHerbivores < herbivoreGlobalCap &&
      rng.chance(config.herbivoreBreedChance)
    ) {
      const spawnCell = entity.findSpawnCell(ctx);
      if (spawnCell >= 0) {
        entity.energy -= config.herbivoreBreedEnergyCost;
        entity.cooldown = config.herbivoreBreedCooldown;
        const child = new Herbivore(
          ctx.nextId('h'),
          spawnCell,
          5,
          entity.config,
        );
        ctx.herbivores.push(child);
        ctx.occupied.add(spawnCell);
        ctx.stats.herbivoreBirths += 1;
      }
    }
  }
}

const HERBIVORE_BEHAVIORS: Record<
  HerbivoreBehaviorId,
  InsectBehaviorStrategy<Herbivore>
> = {
  default: new DefaultHerbivoreBehavior(),
  forager: new ForagerHerbivoreBehavior(),
};

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

  // ── Species parameters ──────────────────────────────────────────────────────

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

  // ── Hooks ───────────────────────────────────────────────────────────────────

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
    const strategy =
      HERBIVORE_BEHAVIORS[this._config.herbivoreBehavior] ??
      HERBIVORE_BEHAVIORS.default;
    strategy.tick(this, ctx);
  }
}
