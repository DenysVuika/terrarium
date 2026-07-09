import type { SimulationConfig } from '../config.ts';
import type { SimContext } from '../context.ts';
import { TERRAIN } from '../world.ts';
import type { InsectBehaviorStrategy } from './behavior.ts';
import { Insect } from './insect.ts';
import type { Herbivore } from './herbivore.ts';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

class DefaultCarnivoreBehavior implements InsectBehaviorStrategy<Carnivore> {
  tick(entity: Carnivore, ctx: SimContext): void {
    const { world, config, rng } = ctx;
    let attackUsed = false;
    let chaseUsed = false;

    const adjacentHerbivores = ctx.herbivores.filter(
      (h) => h.alive && world.neighbors8(entity.cell).includes(h.cell),
    );

    if (adjacentHerbivores.length > 0 && entity.ap >= 3 && !attackUsed) {
      attackUsed = true;
      entity.ap -= 3;
      const prey = rng.pick(adjacentHerbivores);

      if (prey && rng.chance(config.carnivorePreyFleeChance)) {
        prey.energy -= 1;
        prey.fleeFrom(entity.cell, ctx);
        if (!chaseUsed) {
          chaseUsed = true;
          entity.moveToward(prey.cell, ctx);
        }
      } else if (prey) {
        prey.energy -= config.carnivoreAttackDamage;
        if (prey.energy <= 0) {
          prey.alive = false;
          ctx.occupied.delete(prey.cell);
          world.nutrients[prey.cell] = clamp(
            world.nutrients[prey.cell] + 20,
            0,
            300,
          );
          entity.energy += config.carnivoreKillEnergyGain;
          entity.ap = clamp(entity.ap + 5, 0, 10);
          ctx.stats.herbivoreDeaths += 1;
          ctx.stats.herbivoreKillsByCarnivores += 1;
        }
      }
    }

    if (!attackUsed) {
      const targetHerbivore = this.findNearestHerbivore(
        entity,
        config.carnivoreHuntRadius,
        ctx,
      );
      if (targetHerbivore) {
        entity.moveToward(targetHerbivore.cell, ctx);
      } else if (rng.chance(config.carnivoreRestChanceNoPrey)) {
        entity.energy += config.carnivoreRestEnergyRecovery;
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
      !attackUsed &&
      adjacentCarnivores.length > 0 &&
      entity.ap >= 3 &&
      entity.energy >= config.carnivoreRivalFightEnergyMin &&
      rng.chance(config.carnivoreRivalFightChance)
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
            300,
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
      Math.floor(liveHerbivores * config.carnivorePopulationCapPerHerbivore),
    );

    if (
      entity.energy >= config.carnivoreBreedEnergyMin &&
      entity.cooldown <= 0 &&
      localCarnivores < config.carnivoreBreedLocalCap &&
      liveCarnivores < carnivoreGlobalCap &&
      rng.chance(config.carnivoreBreedChance)
    ) {
      const spawnCell = entity.findSpawnCell(ctx);
      if (spawnCell >= 0) {
        entity.energy -= config.carnivoreBreedEnergyCost;
        entity.cooldown = config.carnivoreBreedCooldown;
        entity.ap = 0;
        const child = new Carnivore(
          ctx.nextId('c'),
          spawnCell,
          7,
          entity.config,
        );
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

const CARNIVORE_BEHAVIOR = new DefaultCarnivoreBehavior();

export class Carnivore extends Insect {
  ap: number;
  private readonly _config: SimulationConfig;

  constructor(
    id: string,
    cell: number,
    energy: number,
    config: SimulationConfig,
  ) {
    super('carnivore', id, cell, energy);
    this._config = config;
    this.ap = 0;
  }

  get config(): SimulationConfig {
    return this._config;
  }

  // ── Species parameters ──────────────────────────────────────────────────────

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

  // ── Hooks ───────────────────────────────────────────────────────────────────

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
    CARNIVORE_BEHAVIOR.tick(this, ctx);
  }
}
