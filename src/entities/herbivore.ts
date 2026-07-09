import type { SimulationConfig } from '../config.ts';
import type { SimContext } from '../context.ts';
import { Insect } from './insect.ts';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class Herbivore extends Insect {
  private readonly _config: SimulationConfig;

  constructor(
    id: string,
    cell: number,
    energy: number,
    config: SimulationConfig,
  ) {
    super(id, cell, energy);
    this._config = config;
  }

  // ── Species parameters ──────────────────────────────────────────────────────

  protected get isCarnivore(): boolean {
    return false;
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

  // ── Adult behaviour ─────────────────────────────────────────────────────────

  protected tickBehavior(ctx: SimContext): void {
    const { world, config, rng } = ctx;

    // Movement: seek the nearest plant within radius 2, or roam
    const targetPlant = this.findNearestPlant(2, ctx);
    if (targetPlant >= 0) {
      this.moveToward(targetPlant, ctx);
    } else {
      this.moveRandom(ctx);
    }

    // Eating: consume an adjacent (or same-cell) plant with 80% success
    const consumablePlants = [this.cell]
      .concat(world.neighbors8(this.cell))
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
        this.energy += 5;
      }
    }

    // Reproduction
    const localHerbivores = world
      .neighbors8(this.cell)
      .filter((cell) =>
        ctx.herbivores.some(
          (h) => h.alive && h.cell === cell && h.id !== this.id,
        ),
      ).length;
    const liveHerbivores = ctx.herbivores.filter((h) => h.alive).length;
    const herbivoreGlobalCap = Math.max(
      1,
      Math.floor(ctx.plants.size * config.herbivorePopulationCapPerPlant),
    );

    if (
      this.energy >= config.herbivoreBreedEnergyMin &&
      this.cooldown <= 0 &&
      localHerbivores < config.herbivoreBreedLocalCap &&
      liveHerbivores < herbivoreGlobalCap &&
      rng.chance(config.herbivoreBreedChance)
    ) {
      const spawnCell = this.findSpawnCell(ctx);
      if (spawnCell >= 0) {
        this.energy -= config.herbivoreBreedEnergyCost;
        this.cooldown = config.herbivoreBreedCooldown;
        const child = new Herbivore(
          ctx.nextId('h'),
          spawnCell,
          5,
          this._config,
        );
        ctx.herbivores.push(child);
        ctx.occupied.add(spawnCell);
        ctx.stats.herbivoreBirths += 1;
      }
    }
  }
}
