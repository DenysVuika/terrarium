import { describe, expect, it } from 'vitest';

import { getDefaultConfig } from '@/config';
import type { SimContext } from '@/context';
import type { Rng } from '@/rng';
import { TERRAIN, World } from '@/world';
import { Plant } from './plant';

const pickFirst: Rng['pick'] = <T>(items: T[]) => items[0] ?? null;

function createRng(overrides?: Partial<Rng>): Rng {
  return {
    next: overrides?.next ?? (() => 0),
    int: overrides?.int ?? ((min) => min),
    chance: overrides?.chance ?? (() => false),
    pick: overrides?.pick ?? ((items) => items[0] ?? null),
  };
}

function createPlantContext(options?: {
  light?: number;
  co2?: number;
  chance?: boolean;
  pick?: Rng['pick'];
  nutrients?: number;
  water?: number;
  hasNeighborPlant?: boolean;
}): {
  ctx: SimContext;
  world: World;
  plants: Map<number, Plant>;
  config: ReturnType<typeof getDefaultConfig>;
} {
  const config = getDefaultConfig();
  const rng = createRng({
    chance: () => options?.chance ?? false,
    pick: options?.pick,
  });
  const world = new World(3, rng);
  world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);
  world.water = new Float32Array(9).fill(50);
  world.nutrients = new Float32Array(9).fill(100);

  const center = world.index(1, 1);
  world.water[center] = options?.water ?? 80;
  world.nutrients[center] = options?.nutrients ?? 100;

  const plants = new Map<number, Plant>();
  if (options?.hasNeighborPlant) {
    plants.set(world.index(1, 0), new Plant('existing', world.index(1, 0), 80));
  }

  const ctx: SimContext = {
    world,
    config,
    rng,
    day: true,
    light: options?.light ?? 100,
    o2: 100,
    co2: options?.co2 ?? 50,
    plants,
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
    nextId: (prefix: string) => `${prefix}-1`,
  };

  return { ctx, world, plants, config };
}

describe('Plant', () => {
  it('grows under good conditions and can recover from wilt', () => {
    const { ctx } = createPlantContext({
      light: 100,
      water: 90,
      nutrients: 120,
    });
    const plant = new Plant('p1', ctx.world.index(1, 1), 60);
    plant.wilted = true;
    plant.recoverTicks = 2;

    const child = plant.tick(ctx);

    expect(child).toBeNull();
    expect(plant.growth).toBe(61);
    expect(plant.wilted).toBe(false);
    expect(plant.recoverTicks).toBe(0);
  });

  it('applies CO2 penalty while still growing in good conditions', () => {
    const { ctx } = createPlantContext({ co2: 95 });
    const plant = new Plant('p2', ctx.world.index(1, 1), 50);

    plant.tick(ctx);

    expect(plant.growth).toBe(50.5);
  });

  it('shrinks during night dormancy when resources are sufficient', () => {
    const { ctx } = createPlantContext({ light: 0, water: 80, nutrients: 90 });
    const plant = new Plant('p3', ctx.world.index(1, 1), 40);

    plant.tick(ctx);

    expect(plant.growth).toBeCloseTo(39.85, 4);
    expect(plant.recoverTicks).toBe(0);
  });

  it('dies under stress when growth is below threshold and returns nutrients', () => {
    const { ctx, world } = createPlantContext({
      light: 10,
      water: 0,
      nutrients: 5,
    });
    const cell = world.index(1, 1);
    world.nutrients[cell] = 10;
    const plant = new Plant('p4', cell, 9);

    const child = plant.tick(ctx);

    expect(child).toBeNull();
    expect(plant.alive).toBe(false);
    expect(world.nutrients[cell]).toBeGreaterThan(50);
  });

  it('enters wilted state under stress when growth is still recoverable', () => {
    const { ctx } = createPlantContext({ light: 10, water: 0, nutrients: 10 });
    const plant = new Plant('p5', ctx.world.index(1, 1), 50);

    plant.tick(ctx);

    expect(plant.alive).toBe(true);
    expect(plant.wilted).toBe(true);
    expect(plant.growth).toBe(49.5);
  });

  it('reproduces to adjacent empty soil when mature and chance passes', () => {
    const { ctx, world, plants } = createPlantContext({
      chance: true,
      nutrients: 120,
      water: 90,
      pick: pickFirst,
      hasNeighborPlant: true,
    });
    const cell = world.index(1, 1);
    plants.set(cell, new Plant('parent', cell, 90));
    const parent = plants.get(cell)!;

    const child = parent.tick(ctx);

    expect(child).toBeInstanceOf(Plant);
    expect(child?.id).toBe('p-1');
    expect(child?.cell).not.toBe(world.index(1, 0));
    expect(world.nutrients[cell]).toBeLessThan(120);
  });
});
