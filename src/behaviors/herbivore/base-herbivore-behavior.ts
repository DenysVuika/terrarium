import type { SimContext } from '../../context';
import type { InsectBehaviorStrategy } from '../behavior';
import type { Herbivore } from '@/entities/insects';
import { clamp } from '../../math';

export class BaseHerbivoreBehavior implements InsectBehaviorStrategy<Herbivore> {
  private readonly plantSearchRadius: number;
  private readonly consumePlantChance: number;

  constructor(options?: { plantSearchRadius?: number; consumePlantChance?: number }) {
    this.plantSearchRadius = Math.max(1, options?.plantSearchRadius ?? 2);
    this.consumePlantChance = clamp(options?.consumePlantChance ?? 0.8, 0, 1);
  }

  tick(entity: Herbivore, ctx: SimContext): void {
    const { world, config, rng } = ctx;

    const targetPlant = entity.findNearestPlant(this.plantSearchRadius, ctx);
    if (targetPlant >= 0) {
      entity.moveToward(targetPlant, ctx);
    } else {
      entity.moveRandom(ctx);
    }

    const consumablePlants = [entity.cell]
      .concat(world.neighbors8(entity.cell))
      .filter((cell, index, cells) => cells.indexOf(cell) === index)
      .filter((cell) => ctx.plants.has(cell));

    if (consumablePlants.length > 0 && rng.chance(this.consumePlantChance)) {
      const plantCell = rng.pick(consumablePlants);
      if (plantCell !== null) {
        ctx.plants.delete(plantCell);
        world.nutrients[plantCell] = clamp(world.nutrients[plantCell] + 50, 0, 300);
        entity.energy += 5;
      }
    }

    const localHerbivores = world
      .neighbors8(entity.cell)
      .filter((cell) => ctx.herbivores.some((h) => h.alive && h.cell === cell && h.id !== entity.id)).length;
    const liveHerbivores = ctx.herbivores.filter((h) => h.alive).length;
    const herbivoreGlobalCap = Math.max(1, Math.floor(ctx.plants.size * config.herbivorePopulationCapPerPlant));

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
        const child = entity.spawnOffspring(ctx, spawnCell);
        ctx.herbivores.push(child);
        ctx.occupied.add(spawnCell);
        ctx.stats.herbivoreBirths += 1;
      }
    }
  }
}
