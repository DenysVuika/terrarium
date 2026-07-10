import { describe, expect, it } from 'vitest';

import { getDefaultConfig } from '@/config';
import type { SimContext } from '@/context';
import type { Rng } from '@/rng';
import { TERRAIN, World } from '@/world';
import { BaseCarnivoreBehavior } from './base-carnivore-behavior';

function createRng(chanceResults: boolean[] = []): Rng {
  const queue = [...chanceResults];
  return {
    next: () => 0,
    int: (min) => min,
    chance: (probability) => {
      if (probability <= 0) return false;
      return queue.shift() ?? false;
    },
    pick: (items) => items[0] ?? null,
  };
}

describe('BaseCarnivoreBehavior', () => {
  it('kills adjacent herbivore and updates kill stats', () => {
    const config = getDefaultConfig();
    config.insects.carnivores.preyFleeChance = 0;
    config.insects.carnivores.attackDamage = 10;

    const world = new World(3, createRng());
    const rng = createRng([false, false]);
    world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);
    world.nutrients = new Float32Array(9).fill(0);

    const carnivore = {
      id: 'c1',
      cell: world.index(1, 1),
      energy: 20,
      cooldown: 0,
      ap: 5,
      alive: true,
      moveToward: () => true,
      moveRandom: () => false,
      findSpawnCell: () => -1,
      spawnOffspring: () => ({ id: 'child' }),
    };

    const herbivore = {
      id: 'h1',
      cell: world.index(1, 0),
      alive: true,
      energy: 2,
      fleeFrom: () => {},
    };

    const ctx: SimContext = {
      world,
      config,
      rng,
      day: true,
      light: 100,
      o2: 100,
      co2: 50,
      plants: new Map(),
      insects: [],
      herbivores: [herbivore] as never,
      carnivores: [carnivore] as never,
      getInsectsByKind: () => [],
      occupied: new Set<number>([carnivore.cell, herbivore.cell]),
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
      nextId: () => 'id',
    };

    new BaseCarnivoreBehavior().tick(carnivore as never, ctx);

    expect(herbivore.alive).toBe(false);
    expect(ctx.stats.herbivoreDeaths).toBe(1);
    expect(ctx.stats.herbivoreKillsByCarnivores).toBe(1);
    expect(carnivore.energy).toBeGreaterThan(20);
  });

  it('handles flee and chase path when prey escapes', () => {
    const config = getDefaultConfig();
    config.insects.carnivores.preyFleeChance = 1;
    config.insects.carnivores.rivalFightChance = 1;

    const world = new World(3, createRng());
    const rng = createRng([true, true, false]);
    world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);
    world.nutrients = new Float32Array(9).fill(0);

    let chaseCalls = 0;
    const carnivore = {
      id: 'c2',
      cell: world.index(1, 1),
      energy: 30,
      cooldown: 0,
      ap: 9,
      alive: true,
      moveToward: () => {
        chaseCalls += 1;
        return true;
      },
      moveRandom: () => false,
      findSpawnCell: () => -1,
      spawnOffspring: () => ({ id: 'child' }),
    };

    let fleeCalls = 0;
    const herbivore = {
      id: 'h2',
      cell: world.index(1, 0),
      alive: true,
      energy: 10,
      fleeFrom: () => {
        fleeCalls += 1;
      },
    };

    const rival = {
      id: 'c3',
      cell: world.index(0, 1),
      alive: true,
      energy: 1,
      ap: 3,
    };

    const ctx: SimContext = {
      world,
      config,
      rng,
      day: true,
      light: 100,
      o2: 100,
      co2: 50,
      plants: new Map(),
      insects: [],
      herbivores: [herbivore] as never,
      carnivores: [carnivore, rival] as never,
      getInsectsByKind: () => [],
      occupied: new Set<number>([carnivore.cell, herbivore.cell, rival.cell]),
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
      nextId: () => 'id',
    };

    new BaseCarnivoreBehavior().tick(carnivore as never, ctx);

    expect(fleeCalls).toBe(1);
    expect(chaseCalls).toBe(1);
    expect(rival.alive).toBe(true);
    expect(ctx.stats.carnivoreDeaths).toBe(0);
    expect(ctx.stats.carnivoreKillsByCarnivores).toBe(0);
  });

  it('resolves rival fight kill when no herbivore attack is used', () => {
    const config = getDefaultConfig();
    config.insects.carnivores.preyFleeChance = 0;
    config.insects.carnivores.rivalFightChance = 1;
    config.insects.carnivores.restChanceNoPrey = 0;
    config.insects.carnivores.breed.chance = 0;

    const world = new World(3, createRng());
    const rng = createRng([true]);
    world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);
    world.nutrients = new Float32Array(9).fill(0);

    const carnivore = {
      id: 'c5',
      cell: world.index(1, 1),
      energy: 12,
      cooldown: 0,
      ap: 6,
      alive: true,
      moveToward: () => false,
      moveRandom: () => false,
      findSpawnCell: () => -1,
      spawnOffspring: () => ({ id: 'child' }),
    };

    const rival = {
      id: 'c6',
      cell: world.index(1, 0),
      alive: true,
      energy: 1,
      ap: 3,
    };

    const ctx: SimContext = {
      world,
      config,
      rng,
      day: true,
      light: 100,
      o2: 100,
      co2: 50,
      plants: new Map(),
      insects: [],
      herbivores: [],
      carnivores: [carnivore, rival] as never,
      getInsectsByKind: () => [],
      occupied: new Set<number>([carnivore.cell, rival.cell]),
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
      nextId: () => 'id',
    };

    new BaseCarnivoreBehavior().tick(carnivore as never, ctx);

    expect(rival.alive).toBe(false);
    expect(ctx.stats.carnivoreDeaths).toBe(1);
    expect(ctx.stats.carnivoreKillsByCarnivores).toBe(1);
  });

  it('uses rest behavior when no prey is found', () => {
    const config = getDefaultConfig();
    config.insects.carnivores.restChanceNoPrey = 1;
    config.insects.carnivores.breed.chance = 0;

    const world = new World(3, createRng());
    const rng = createRng([true]);
    world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);

    const carnivore = {
      id: 'c4',
      cell: world.index(1, 1),
      energy: 25,
      cooldown: 0,
      ap: 0,
      alive: true,
      moveToward: () => false,
      moveRandom: () => false,
      findSpawnCell: () => -1,
      spawnOffspring: () => ({ id: 'child' }),
    };

    const ctx: SimContext = {
      world,
      config,
      rng,
      day: true,
      light: 100,
      o2: 100,
      co2: 50,
      plants: new Map(),
      insects: [],
      herbivores: [],
      carnivores: [carnivore] as never,
      getInsectsByKind: () => [],
      occupied: new Set<number>([carnivore.cell]),
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
      nextId: () => 'id',
    };

    new BaseCarnivoreBehavior().tick(carnivore as never, ctx);

    expect(carnivore.energy).toBeCloseTo(25.3, 4);
    expect(ctx.stats.carnivoreBirths).toBe(0);
  });

  it('breeds when gates pass under prey-rich population', () => {
    const config = getDefaultConfig();
    config.insects.carnivores.breed.chance = 1;

    const world = new World(3, createRng());
    const rng = createRng([true]);
    world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);

    const child = { id: 'child', cell: world.index(2, 2), alive: true };
    const carnivore = {
      id: 'c4',
      cell: world.index(1, 1),
      energy: 25,
      cooldown: 0,
      ap: 0,
      alive: true,
      moveToward: () => false,
      moveRandom: () => false,
      findSpawnCell: () => world.index(2, 2),
      spawnOffspring: () => child,
    };

    const ctx: SimContext = {
      world,
      config,
      rng,
      day: true,
      light: 100,
      o2: 100,
      co2: 50,
      plants: new Map(),
      insects: [],
      herbivores: [
        { id: 'h-a', alive: true, cell: world.index(0, 0) },
        { id: 'h-b', alive: true, cell: world.index(0, 1) },
        { id: 'h-c', alive: true, cell: world.index(0, 2) },
        { id: 'h-d', alive: true, cell: world.index(1, 0) },
        { id: 'h-e', alive: true, cell: world.index(1, 2) },
        { id: 'h-f', alive: true, cell: world.index(2, 0) },
        { id: 'h-g', alive: true, cell: world.index(2, 2) },
      ] as never,
      carnivores: [carnivore] as never,
      getInsectsByKind: () => [],
      occupied: new Set<number>([carnivore.cell]),
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
      nextId: () => 'id',
    };

    new BaseCarnivoreBehavior().tick(carnivore as never, ctx);

    expect(carnivore.energy).toBe(
      25 - config.insects.carnivores.breed.energyCost,
    );
    expect(carnivore.ap).toBe(0);
    expect(ctx.stats.carnivoreBirths).toBe(1);
    expect(ctx.carnivores).toHaveLength(2);
  });
});
