import type { SimulationConfig } from '../config.ts';
import type { SimContext } from '../context.ts';
import { TERRAIN } from '../world.ts';
import { Insect } from './insect.ts';
import type { Herbivore } from './herbivore.ts';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

  // ── Adult behaviour ─────────────────────────────────────────────────────────

  protected tickBehavior(ctx: SimContext): void {
    const { world, config, rng } = ctx;
    let attackUsed = false;
    let chaseUsed = false;

    // 1. Attack an adjacent herbivore if AP allows (one attack per tick)
    const adjacentHerbivores = ctx.herbivores.filter(
      (h) => h.alive && world.neighbors8(this.cell).includes(h.cell),
    );

    if (adjacentHerbivores.length > 0 && this.ap >= 3 && !attackUsed) {
      attackUsed = true;
      this.ap -= 3;
      const prey = rng.pick(adjacentHerbivores);

      if (prey && rng.chance(config.carnivorePreyFleeChance)) {
        // Prey escapes — carnivore may chase once
        prey.energy -= 1;
        prey.fleeFrom(this.cell, ctx);
        if (!chaseUsed) {
          chaseUsed = true;
          this.moveToward(prey.cell, ctx);
        }
      } else if (prey) {
        // Prey is caught
        prey.energy -= config.carnivoreAttackDamage;
        if (prey.energy <= 0) {
          prey.alive = false;
          ctx.occupied.delete(prey.cell);
          world.nutrients[prey.cell] = clamp(
            world.nutrients[prey.cell] + 20,
            0,
            300,
          );
          this.energy += config.carnivoreKillEnergyGain;
          this.ap = clamp(this.ap + 5, 0, 10);
          ctx.stats.herbivoreDeaths += 1;
          ctx.stats.herbivoreKillsByCarnivores += 1;
        }
      }
    }

    // 2. Hunt: move toward nearest herbivore, rest if none found
    if (!attackUsed) {
      const targetHerbivore = this.findNearestHerbivore(
        config.carnivoreHuntRadius,
        ctx,
      );
      if (targetHerbivore) {
        this.moveToward(targetHerbivore.cell, ctx);
      } else if (rng.chance(config.carnivoreRestChanceNoPrey)) {
        this.energy += config.carnivoreRestEnergyRecovery;
      } else {
        this.moveRandom(ctx);
      }
    }

    // 3. Opportunistic rival combat (only when no attack was used this tick)
    const adjacentCarnivores = ctx.carnivores.filter(
      (other) =>
        other.alive &&
        other.id !== this.id &&
        world.neighbors8(this.cell).includes(other.cell),
    );

    if (
      !attackUsed &&
      adjacentCarnivores.length > 0 &&
      this.ap >= 3 &&
      this.energy >= config.carnivoreRivalFightEnergyMin &&
      rng.chance(config.carnivoreRivalFightChance)
    ) {
      attackUsed = true;
      const rival = rng.pick(adjacentCarnivores);
      if (rival) {
        this.ap -= 3;
        if (rival.ap >= 3) rival.ap -= 3;
        this.energy -= 2;
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
          this.energy += 5;
          this.ap = clamp(this.ap + 5, 0, 10);
          ctx.stats.carnivoreDeaths += 1;
          ctx.stats.carnivoreKillsByCarnivores += 1;
        }
      }
    }

    // 4. Reproduction
    const localCarnivores = world
      .neighbors8(this.cell)
      .filter((cell) =>
        ctx.carnivores.some(
          (other) => other.alive && other.cell === cell && other.id !== this.id,
        ),
      ).length;
    const liveCarnivores = ctx.carnivores.filter((c) => c.alive).length;
    const liveHerbivores = ctx.herbivores.filter((h) => h.alive).length;
    const carnivoreGlobalCap = Math.max(
      1,
      Math.floor(liveHerbivores * config.carnivorePopulationCapPerHerbivore),
    );

    if (
      this.energy >= config.carnivoreBreedEnergyMin &&
      this.cooldown <= 0 &&
      localCarnivores < config.carnivoreBreedLocalCap &&
      liveCarnivores < carnivoreGlobalCap &&
      rng.chance(config.carnivoreBreedChance)
    ) {
      const spawnCell = this.findSpawnCell(ctx);
      if (spawnCell >= 0) {
        this.energy -= config.carnivoreBreedEnergyCost;
        this.cooldown = config.carnivoreBreedCooldown;
        this.ap = 0;
        const child = new Carnivore(
          ctx.nextId('c'),
          spawnCell,
          7,
          this._config,
        );
        ctx.carnivores.push(child);
        ctx.occupied.add(spawnCell);
        ctx.stats.carnivoreBirths += 1;
      }
    }
  }

  private findNearestHerbivore(
    radius: number,
    ctx: SimContext,
  ): Herbivore | null {
    const origin = ctx.world.coords(this.cell);
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
