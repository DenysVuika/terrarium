import { describe, expect, it } from 'vitest';

import { getDefaultConfig } from '@/config';
import type { SimContext } from '@/context';
import type { Rng } from '@/rng';
import { TERRAIN, World } from '@/world';
import { Insect } from './insect';

const pickFirst: Rng['pick'] = <T>(items: T[]) => items[0] ?? null;

function createRng(overrides?: Partial<Rng>): Rng {
  return {
    next: overrides?.next ?? (() => 0),
    int: overrides?.int ?? ((min) => min),
    chance: overrides?.chance ?? (() => false),
    pick: overrides?.pick ?? ((items) => items[0] ?? null),
  };
}

class TestInsect extends Insect {
  behaviorCalls = 0;
  deaths = 0;

  protected get eggStageTicks(): number {
    return 1;
  }

  protected get larvaStageTicks(): number {
    return 1;
  }

  protected get maxAge(): number {
    return 3;
  }

  protected get starvationLimit(): number {
    return 2;
  }

  protected get metabolismPerTick(): number {
    return 1;
  }

  protected get dehydrationPenalty(): number {
    return 0.5;
  }

  protected get moveEnergyCost(): number {
    return 0.25;
  }

  protected tickBehavior(): void {
    this.behaviorCalls += 1;
  }

  protected onDeath(): void {
    this.deaths += 1;
  }

  protected extraMoveBias(cell: number): number {
    return cell % 2 === 0 ? 0.5 : 0;
  }
}

class DefaultBiasInsect extends Insect {
  protected get eggStageTicks(): number {
    return 1;
  }

  protected get larvaStageTicks(): number {
    return 1;
  }

  protected get maxAge(): number {
    return 10;
  }

  protected get starvationLimit(): number {
    return 10;
  }

  protected get metabolismPerTick(): number {
    return 0;
  }

  protected get dehydrationPenalty(): number {
    return 0;
  }

  protected get moveEnergyCost(): number {
    return 0;
  }

  protected tickBehavior(): void {}

  public readDefaultBias(cell: number, ctx: SimContext): number {
    return this.extraMoveBias(cell, ctx);
  }
}

function createContext(options?: {
  o2?: number;
  day?: boolean;
  pick?: Rng['pick'];
  next?: () => number;
  waterMap?: Partial<Record<number, number>>;
}): {
  ctx: SimContext;
  world: World;
  config: ReturnType<typeof getDefaultConfig>;
} {
  const config = getDefaultConfig();
  const rng = createRng({
    pick: options?.pick,
    next: options?.next,
  });
  const world = new World(3, rng);
  world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);
  world.water = new Float32Array(9).fill(0);
  world.nutrients = new Float32Array(9).fill(0);

  if (options?.waterMap) {
    for (const [index, value] of Object.entries(options.waterMap)) {
      if (value !== undefined) {
        world.water[Number(index)] = value;
      }
    }
  }

  const ctx: SimContext = {
    world,
    config,
    rng,
    day: options?.day ?? true,
    light: 100,
    o2: options?.o2 ?? 100,
    co2: 50,
    plants: new Map(),
    insects: [],
    herbivores: [],
    carnivores: [],
    getInsectsByKind: () => [],
    occupied: new Set<number>(),
    addEvent: () => {},
    emitEvent: () => {},
    stats: {
      herbivoreBirths: 0,
      carnivoreBirths: 0,
      herbivoreDeaths: 0,
      carnivoreDeaths: 0,
      herbivoreKillsByCarnivores: 0,
      carnivoreKillsByCarnivores: 0,
    },
    nextId: () => 'x-1',
  };

  return { ctx, world, config };
}

describe('Insect base behavior', () => {
  it('advances stages and only runs adult behavior', () => {
    const { ctx } = createContext();
    const insect = new TestInsect('test', 'i1', ctx.world.index(1, 1), 10);

    insect.tick(ctx);
    expect(insect.stage).toBe('larva');
    expect(insect.behaviorCalls).toBe(0);

    insect.tick(ctx);
    expect(insect.stage).toBe('adult');
    expect(insect.behaviorCalls).toBe(1);
  });

  it('applies oxygen and dehydration penalties and triggers starvation death', () => {
    const { ctx, world } = createContext({ o2: 5 });
    const cell = world.index(1, 1);
    const insect = new TestInsect('test', 'i2', cell, 0.1);
    ctx.occupied.add(cell);

    insect.tick(ctx);
    insect.tick(ctx);

    expect(insect.alive).toBe(false);
    expect(insect.deaths).toBe(1);
    expect(ctx.occupied.has(cell)).toBe(false);
    expect(world.nutrients[cell]).toBe(20);
  });

  it('drinks from nearby water instead of dehydration penalty', () => {
    const { ctx, world, config } = createContext({
      waterMap: { 0: 3 },
      pick: pickFirst,
    });
    const insect = new TestInsect('test', 'i3', world.index(1, 1), 10);

    const beforeEnergy = insect.energy;
    insect.tick(ctx);

    expect(world.water[0]).toBeCloseTo(3 - config.insects.drinkAmount, 5);
    expect(insect.energy).toBeCloseTo(beforeEnergy - 1, 5);
  });

  it('moveToward and moveRandom respect occupancy and spend step charge', () => {
    const { ctx, world } = createContext({ next: () => 0 });
    const origin = world.index(1, 1);
    const blocked = world.index(2, 1);
    const insect = new TestInsect('test', 'i4', origin, 10);
    insect.stepCharge = 2;

    ctx.occupied.add(origin);
    ctx.occupied.add(blocked);

    const movedToward = insect.moveToward(world.index(2, 2), ctx);
    expect(movedToward).toBe(true);
    expect(insect.cell).not.toBe(blocked);
    const afterToward = insect.cell;

    const movedRandom = insect.moveRandom(ctx);
    expect(movedRandom).toBe(true);
    expect(insect.cell).not.toBe(afterToward);
    expect(insect.stepCharge).toBeLessThan(2);
  });

  it('fails movement when step charge is insufficient', () => {
    const { ctx, world } = createContext();
    const insect = new TestInsect('test', 'i5', world.index(1, 1), 10);
    insect.stepCharge = 0;
    ctx.occupied.add(insect.cell);

    expect(insect.moveToward(world.index(2, 2), ctx)).toBe(false);
  });

  it('fleeFrom increases distance from predator when options exist', () => {
    const { ctx, world } = createContext();
    const insect = new TestInsect('test', 'i6', world.index(1, 1), 10);
    ctx.occupied.add(insect.cell);

    const predator = world.index(0, 0);
    const before =
      Math.abs(world.coords(insect.cell).x - world.coords(predator).x) +
      Math.abs(world.coords(insect.cell).y - world.coords(predator).y);

    insect.fleeFrom(predator, ctx);

    const after =
      Math.abs(world.coords(insect.cell).x - world.coords(predator).x) +
      Math.abs(world.coords(insect.cell).y - world.coords(predator).y);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it('finds nearest plant in radius and resolves spawn cell', () => {
    const { ctx, world } = createContext({ pick: pickFirst });
    const insect = new TestInsect('test', 'i7', world.index(1, 1), 10);

    ctx.plants.set(world.index(0, 0), { id: 'p1' } as never);
    ctx.plants.set(world.index(2, 2), { id: 'p2' } as never);

    expect(insect.findNearestPlant(1, ctx)).toBe(-1);
    expect(insect.findNearestPlant(3, ctx)).toBe(world.index(0, 0));

    const spawn = insect.findSpawnCell(ctx);
    expect(spawn).toBeGreaterThanOrEqual(0);
  });

  it('decrements cooldown during lifecycle tick when active', () => {
    const { ctx, world } = createContext({
      pick: pickFirst,
      waterMap: { 0: 10 },
    });
    const insect = new TestInsect('test', 'i8', world.index(1, 1), 10);
    insect.cooldown = 2;

    insect.tick(ctx);

    expect(insect.cooldown).toBe(1);
  });

  it('uses default extraMoveBias hook value when not overridden', () => {
    const { ctx, world } = createContext();
    const insect = new DefaultBiasInsect(
      'default',
      'i9',
      world.index(1, 1),
      10,
    );

    expect(insect.readDefaultBias(world.index(1, 1), ctx)).toBe(0);
  });

  it('fleeFrom keeps position when every neighbor is occupied', () => {
    const { ctx, world } = createContext();
    const origin = world.index(1, 1);
    const insect = new TestInsect('test', 'i10', origin, 10);
    ctx.occupied.add(origin);

    for (const cell of world.neighbors8(origin)) {
      ctx.occupied.add(cell);
    }

    insect.fleeFrom(world.index(0, 0), ctx);

    expect(insect.cell).toBe(origin);
  });

  it('findSpawnCell returns -1 when no free walkable neighbors or rng pick returns null', () => {
    const { ctx, world } = createContext({ pick: () => null });
    const origin = world.index(1, 1);
    const insect = new TestInsect('test', 'i11', origin, 10);

    for (const cell of world.neighbors8(origin)) {
      ctx.occupied.add(cell);
    }
    expect(insect.findSpawnCell(ctx)).toBe(-1);

    ctx.occupied.clear();
    expect(insect.findSpawnCell(ctx)).toBe(-1);
  });

  it('moveRandom can remain in place when step charge is too low for chosen target', () => {
    const { ctx, world } = createContext({ next: () => 0.99 });
    const origin = world.index(1, 1);
    const insect = new TestInsect('test', 'i12', origin, 10);
    ctx.occupied.add(origin);
    insect.lastCell = world.index(1, 0);
    insect.stepCharge = 1;

    const sandTarget = world.index(2, 2);
    world.terrain[sandTarget] = TERRAIN.SAND;
    world.water[sandTarget] = 100;

    const moved = insect.moveRandom(ctx);

    expect(moved).toBe(false);
    expect(insect.cell).toBe(origin);
  });
});
