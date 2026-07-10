import type { SimContext } from '../../context';
import { TERRAIN } from '../../world';
import { Entity } from '../entity';

/** Kind is an open string so new species can be registered without editing this union. */
export type InsectKind = string;
export type InsectStage = 'egg' | 'larva' | 'adult';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Abstract base for all insect entities (Herbivore, Carnivore).
 *
 * Subclasses supply species-specific lifecycle parameters via abstract getters
 * and implement tickBehavior() for adult-stage actions (movement, eating, combat).
 *
 * Extension hooks allow subclasses to inject extra logic without overriding
 * the shared lifecycle loop:
 *   - tickExtraLifecycle()  — additional per-tick state updates (e.g. AP regen)
 *   - onAfterMove()         — side effects after a successful move (e.g. sand AP drain)
 *   - onDeath()             — cleanup and stat recording on death
 *   - extraMoveBias()       — per-cell score added in moveRandom (e.g. plant proximity)
 */
export abstract class Insect extends Entity {
  readonly kind: InsectKind;
  lastCell: number;
  age: number;
  stage: InsectStage;
  stageTicks: number;
  energy: number;
  starvationTicks: number;
  cooldown: number;
  stepCharge: number;

  constructor(kind: InsectKind, id: string, cell: number, energy: number) {
    super(id, cell);
    this.kind = kind;
    this.lastCell = -1;
    this.age = 0;
    this.stage = 'egg';
    this.stageTicks = 0;
    this.energy = energy;
    this.starvationTicks = 0;
    this.cooldown = 0;
    this.stepCharge = 0;
  }

  protected abstract get eggStageTicks(): number;
  protected abstract get larvaStageTicks(): number;
  protected abstract get maxAge(): number;
  protected abstract get starvationLimit(): number;
  protected abstract get metabolismPerTick(): number;
  protected abstract get dehydrationPenalty(): number;
  protected abstract get moveEnergyCost(): number;

  protected tickExtraLifecycle(_ctx: SimContext): void {}

  protected onAfterMove(_targetCell: number, _ctx: SimContext): void {}

  protected onDeath(_ctx: SimContext): void {}

  protected extraMoveBias(_cell: number, _ctx: SimContext): number {
    return 0;
  }

  tick(ctx: SimContext): void {
    this.tickLifecycle(ctx);
    if (this.alive && this.stage === 'adult') {
      this.tickBehavior(ctx);
    }
  }

  protected abstract tickBehavior(ctx: SimContext): void;

  protected tickLifecycle(ctx: SimContext): void {
    const { world, config } = ctx;
    const insectConfig = config.insects;

    this.age += 1;
    this.stageTicks += 1;

    const metabolismMultiplier = ctx.day ? 1 : config.climate.nightMetabolismMultiplier;
    this.energy -= this.metabolismPerTick * metabolismMultiplier;

    if (ctx.o2 < 10) {
      this.energy -= 1;
    }

    if (this.cooldown > 0) {
      this.cooldown -= 1;
    }

    this.stepCharge = clamp(this.stepCharge + insectConfig.stepChargePerTick, 0, 2.5);

    this.tickExtraLifecycle(ctx);

    if (this.stage === 'egg' && this.stageTicks >= this.eggStageTicks) {
      this.stage = 'larva';
      this.stageTicks = 0;
    } else if (this.stage === 'larva' && this.stageTicks >= this.larvaStageTicks) {
      this.stage = 'adult';
      this.stageTicks = 0;
    }

    const waterNeighbors = world
      .neighbors8(this.cell)
      .filter((neighbor) => world.water[neighbor] >= insectConfig.drinkAmount);

    if (waterNeighbors.length > 0) {
      const drinkCell = ctx.rng.pick(waterNeighbors);
      if (drinkCell !== null) {
        world.water[drinkCell] = clamp(world.water[drinkCell] - insectConfig.drinkAmount, 0, 100);
      }
    } else {
      this.energy -= this.dehydrationPenalty;
    }

    if (this.energy <= 0) {
      this.starvationTicks += 1;
    } else {
      this.starvationTicks = 0;
    }

    if (this.starvationTicks >= this.starvationLimit || this.age >= this.maxAge) {
      this.alive = false;
      ctx.occupied.delete(this.cell);
      world.nutrients[this.cell] = clamp(world.nutrients[this.cell] + 20, 0, 300);
      this.onDeath(ctx);
    }
  }

  moveToward(targetCell: number, ctx: SimContext): boolean {
    const { world, rng } = ctx;
    const target = world.coords(targetCell);

    const options = world.neighbors8(this.cell).filter((cell) => world.isWalkable(cell) && !ctx.occupied.has(cell));

    if (!options.length) return false;

    options.sort((left, right) => {
      const leftPos = world.coords(left);
      const rightPos = world.coords(right);
      let leftDist = Math.abs(leftPos.x - target.x) + Math.abs(leftPos.y - target.y);
      let rightDist = Math.abs(rightPos.x - target.x) + Math.abs(rightPos.y - target.y);

      if (this.lastCell >= 0 && left === this.lastCell) leftDist += 0.35;
      if (this.lastCell >= 0 && right === this.lastCell) rightDist += 0.35;

      leftDist += rng.next() * 0.05;
      rightDist += rng.next() * 0.05;
      return leftDist - rightDist;
    });

    return this.tryMove(options[0], ctx);
  }

  moveRandom(ctx: SimContext): boolean {
    const { world, rng } = ctx;

    const options = world.neighbors8(this.cell).filter((cell) => world.isWalkable(cell) && !ctx.occupied.has(cell));

    if (!options.length) return false;

    let bestScore = Number.NEGATIVE_INFINITY;
    let bestCell = options[0];

    for (const option of options) {
      let score = rng.next();
      score += world.water[option] * 0.02;
      if (this.lastCell >= 0 && option === this.lastCell) score -= 2;
      score += this.extraMoveBias(option, ctx);

      if (score > bestScore) {
        bestScore = score;
        bestCell = option;
      }
    }

    return this.tryMove(bestCell, ctx);
  }

  protected tryMove(targetCell: number, ctx: SimContext): boolean {
    const { world, config } = ctx;
    const terrain = world.terrain[targetCell];
    const stepCost = terrain === TERRAIN.SAND ? config.insects.sandStepCost : 1;

    if (this.stepCharge < stepCost) return false;

    const previousCell = this.cell;
    ctx.occupied.delete(this.cell);
    this.cell = targetCell;
    this.lastCell = previousCell;
    ctx.occupied.add(this.cell);

    this.stepCharge -= stepCost;
    this.energy -= this.moveEnergyCost;

    this.onAfterMove(targetCell, ctx);

    return true;
  }

  fleeFrom(predatorCell: number, ctx: SimContext): void {
    const { world } = ctx;
    const predator = world.coords(predatorCell);

    const options = world.neighbors8(this.cell).filter((cell) => world.isWalkable(cell) && !ctx.occupied.has(cell));

    if (!options.length) return;

    options.sort((left, right) => {
      const leftPos = world.coords(left);
      const rightPos = world.coords(right);
      let leftDist = Math.abs(leftPos.x - predator.x) + Math.abs(leftPos.y - predator.y);
      let rightDist = Math.abs(rightPos.x - predator.x) + Math.abs(rightPos.y - predator.y);

      if (this.lastCell >= 0 && left === this.lastCell) leftDist -= 0.35;
      if (this.lastCell >= 0 && right === this.lastCell) rightDist -= 0.35;

      return rightDist - leftDist;
    });

    const previousCell = this.cell;
    ctx.occupied.delete(this.cell);
    this.cell = options[0];
    this.lastCell = previousCell;
    ctx.occupied.add(this.cell);
  }

  findNearestPlant(radius: number, ctx: SimContext): number {
    const origin = ctx.world.coords(this.cell);
    let nearest = -1;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const cell of ctx.plants.keys()) {
      const pos = ctx.world.coords(cell);
      const dist = Math.abs(pos.x - origin.x) + Math.abs(pos.y - origin.y);
      if (dist <= radius && dist < bestDist) {
        bestDist = dist;
        nearest = cell;
      }
    }

    return nearest;
  }

  findSpawnCell(ctx: SimContext): number {
    const options = ctx.world
      .neighbors8(this.cell)
      .filter((cell) => ctx.world.isWalkable(cell) && !ctx.occupied.has(cell));
    const pick = options.length ? ctx.rng.pick(options) : null;
    return pick ?? -1;
  }
}