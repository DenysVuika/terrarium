import type { SimContext } from '../../context';
import { Entity } from '../entity';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nutrientDrainByGrowth(growth: number): number {
  if (growth < 20) return 0.2;
  if (growth < 80) return 0.5;
  return 1;
}

/**
 * A plant entity that grows, reproduces, wilts, and decays.
 * tick() returns a child Plant when reproduction occurs, or null otherwise.
 * Sets alive=false when the plant dies (caller removes it from the map).
 */
export class Plant extends Entity {
  growth: number;
  wilted: boolean;
  recoverTicks: number;
  stressTicks: number;

  constructor(id: string, cell: number, growth: number) {
    super(id, cell);
    this.growth = growth;
    this.wilted = false;
    this.recoverTicks = 0;
    this.stressTicks = 0;
  }

  tick(ctx: SimContext): Plant | null {
    const { world, config, rng } = ctx;
    const plantConfig = config.plants;

    const drain = nutrientDrainByGrowth(this.growth);
    world.nutrients[this.cell] = clamp(
      world.nutrients[this.cell] - drain,
      0,
      300,
    );

    const hasResources =
      world.water[this.cell] > 30 && world.nutrients[this.cell] > 20;
    const conditionsGood = ctx.light >= 50 && hasResources;
    const co2Penalty = ctx.co2 > 90 ? 0.5 : 1;

    if (conditionsGood) {
      this.growth = clamp(this.growth + co2Penalty, 0, 100);
      if (this.wilted) {
        this.recoverTicks += 1;
        if (this.recoverTicks >= 3) {
          this.wilted = false;
          this.recoverTicks = 0;
        }
      }
    } else if (ctx.light === 0 && hasResources) {
      this.growth = clamp(this.growth - plantConfig.nightShrink, 0, 100);
      this.recoverTicks = 0;
    } else {
      if (this.growth < 10) {
        this.alive = false;
        world.nutrients[this.cell] = clamp(
          world.nutrients[this.cell] + 50,
          0,
          300,
        );
        return null;
      }
      this.growth = clamp(this.growth - plantConfig.stressShrink, 0, 100);
      this.wilted = true;
      this.recoverTicks = 0;
    }

    // Reproduction: mature plant spreads a seed to an adjacent empty soil cell
    if (
      this.growth >= 80 &&
      world.nutrients[this.cell] > 50 &&
      rng.chance(plantConfig.reproductionChance)
    ) {
      const options = world
        .neighbors4(this.cell)
        .filter(
          (neighbor) => world.isSoil(neighbor) && !ctx.plants.has(neighbor),
        );

      if (options.length > 0) {
        const target = rng.pick(options);
        if (target !== null) {
          world.nutrients[this.cell] = clamp(
            world.nutrients[this.cell] - 10,
            0,
            300,
          );
          return new Plant(ctx.nextId('p'), target, 0);
        }
      }
    }

    return null;
  }
}
