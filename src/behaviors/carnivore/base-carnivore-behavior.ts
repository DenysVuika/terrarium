import type { SimContext } from '../../context';
import type { InsectBehaviorStrategy } from '../behavior';
import type { Carnivore, Herbivore } from '@/entities/insects';
import { clamp } from '../../math';

export class BaseCarnivoreBehavior implements InsectBehaviorStrategy<Carnivore> {
  private readonly huntRadiusDelta: number;
  private readonly restChanceScale: number;
  private readonly rivalFightChanceScale: number;

  constructor(options?: {
    huntRadiusDelta?: number;
    restChanceScale?: number;
    rivalFightChanceScale?: number;
  }) {
    this.huntRadiusDelta = options?.huntRadiusDelta ?? 0;
    this.restChanceScale = options?.restChanceScale ?? 1;
    this.rivalFightChanceScale = options?.rivalFightChanceScale ?? 1;
  }

  tick(entity: Carnivore, ctx: SimContext): void {
    const { world, config, rng } = ctx;
    const carnivoreConfig = config.insects.carnivores;
    const breedConfig = carnivoreConfig.breed;
    const huntRadius = Math.max(
      1,
      carnivoreConfig.huntRadius + this.huntRadiusDelta,
    );
    const restChance = Math.max(
      0,
      Math.min(1, carnivoreConfig.restChanceNoPrey * this.restChanceScale),
    );
    const rivalFightChance = Math.max(
      0,
      Math.min(
        1,
        carnivoreConfig.rivalFightChance * this.rivalFightChanceScale,
      ),
    );
    const satiated = entity.energy >= carnivoreConfig.satiatedEnergyThreshold;

    let attackUsed = false;
    let chaseUsed = false;

    const adjacentHerbivores = ctx.herbivores.filter(
      (h) => h.alive && world.neighbors8(entity.cell).includes(h.cell),
    );

    if (
      !satiated &&
      adjacentHerbivores.length > 0 &&
      entity.ap >= 3 &&
      !attackUsed
    ) {
      attackUsed = true;
      entity.ap -= 3;
      const prey = rng.pick(adjacentHerbivores);

      let escaped = false;
      if (prey && rng.chance(carnivoreConfig.preyFleeChance)) {
        escaped = prey.tryFleeFrom(entity.cell, ctx);
        if (escaped && !chaseUsed) {
          chaseUsed = true;
          entity.moveToward(prey.cell, ctx);
        }
      }

      if (prey && !escaped) {
        prey.energy -= carnivoreConfig.attackDamage;
        if (prey.energy <= 0) {
          prey.alive = false;
          ctx.occupied.delete(prey.cell);
          world.nutrients[prey.cell] = clamp(
            world.nutrients[prey.cell] + 20,
            0,
            config.world.nutrientsMax,
          );
          entity.energy += carnivoreConfig.killEnergyGain;
          entity.ap = clamp(entity.ap + 5, 0, 10);
          ctx.stats.herbivoreDeaths += 1;
          ctx.stats.herbivoreKillsByCarnivores += 1;
        }
      }
    }

    if (satiated && !attackUsed) {
      entity.moveRandom(ctx);
    } else if (!attackUsed) {
      const targetHerbivore = this.findNearestHerbivore(
        entity,
        huntRadius,
        ctx,
      );
      if (targetHerbivore) {
        entity.moveToward(targetHerbivore.cell, ctx);
      } else if (rng.chance(restChance)) {
        entity.energy += carnivoreConfig.restEnergyRecovery;
      } else {
        entity.moveRandom(ctx);
      }
    }

    const adjacentCarnivores = ctx.carnivores.filter(
      (other) =>
        other.alive &&
        other.id !== entity.id &&
        world.neighbors8(entity.cell).includes(other.cell),
    );

    if (
      !satiated &&
      !attackUsed &&
      adjacentCarnivores.length > 0 &&
      entity.ap >= 3 &&
      entity.energy >= carnivoreConfig.rivalFightEnergyMin &&
      rng.chance(rivalFightChance)
    ) {
      attackUsed = true;
      const rival = rng.pick(adjacentCarnivores);
      if (rival) {
        entity.ap -= 3;
        if (rival.ap >= 3) rival.ap -= 3;
        entity.energy -= 2;
        rival.energy -= 2;
        if (rival.energy <= 0) {
          rival.alive = false;
          rival.ap = 0;
          ctx.occupied.delete(rival.cell);
          world.nutrients[rival.cell] = clamp(
            world.nutrients[rival.cell] + 20,
            0,
            config.world.nutrientsMax,
          );
          entity.energy += 5;
          entity.ap = clamp(entity.ap + 5, 0, 10);
          ctx.stats.carnivoreDeaths += 1;
          ctx.stats.carnivoreKillsByCarnivores += 1;
        }
      }
    }

    const localCarnivores = world
      .neighbors8(entity.cell)
      .filter((cell) =>
        ctx.carnivores.some(
          (other) =>
            other.alive && other.cell === cell && other.id !== entity.id,
        ),
      ).length;
    const liveCarnivores = ctx.carnivores.filter((c) => c.alive).length;
    const liveHerbivores = ctx.herbivores.filter((h) => h.alive).length;
    const carnivoreGlobalCap = Math.max(
      1,
      Math.floor(liveHerbivores * breedConfig.populationCapPerHerbivore),
    );

    if (
      entity.energy >= breedConfig.energyMin &&
      entity.cooldown <= 0 &&
      localCarnivores < breedConfig.localCap &&
      liveCarnivores < carnivoreGlobalCap &&
      rng.chance(breedConfig.chance)
    ) {
      const spawnCell = entity.findSpawnCell(ctx);
      if (spawnCell >= 0) {
        entity.energy -= breedConfig.energyCost;
        entity.cooldown = breedConfig.cooldown;
        entity.ap = 0;
        const child = entity.spawnOffspring(ctx, spawnCell);
        ctx.carnivores.push(child);
        ctx.occupied.add(spawnCell);
        ctx.stats.carnivoreBirths += 1;
      }
    }
  }

  private findNearestHerbivore(
    entity: Carnivore,
    radius: number,
    ctx: SimContext,
  ): Herbivore | null {
    const origin = ctx.world.coords(entity.cell);
    let nearest: Herbivore | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const herbivore of ctx.herbivores) {
      if (!herbivore.alive) continue;
      const pos = ctx.world.coords(herbivore.cell);
      const dist = Math.abs(pos.x - origin.x) + Math.abs(pos.y - origin.y);
      if (dist <= radius && dist < bestDist) {
        bestDist = dist;
        nearest = herbivore;
      }
    }

    return nearest;
  }
}
