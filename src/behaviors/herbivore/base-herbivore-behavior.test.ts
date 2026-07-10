import { describe, expect, it } from 'vitest';

import { getDefaultConfig } from '@/config';
import type { SimContext } from '@/context';
import type { Rng } from '@/rng';
import { TERRAIN, World } from '@/world';
import { BaseHerbivoreBehavior } from './base-herbivore-behavior';

function createRng(chanceResults: boolean[] = []): Rng {
  const queue = [...chanceResults];
  return {
    next: () => 0,
    int: (min) => min,
    chance: () => queue.shift() ?? false,
    pick: (items) => items[0] ?? null,
  };
}

describe('BaseHerbivoreBehavior', () => {
  it('moves toward plants, consumes one, and spawns offspring when gates pass', () => {
    const config = getDefaultConfig();
    config.insects.herbivores.breed.chance = 1;
    const world = new World(3, createRng());
    const rng = createRng([true, true]);
    world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);
    world.nutrients = new Float32Array(9).fill(0);

    const child = { id: 'child', cell: world.index(2, 2), alive: true };
    const entity = {
      id: 'h1',
      cell: world.index(1, 1),
      energy: 20,
      cooldown: 0,
      alive: true,
      findNearestPlant: () => world.index(1, 0),
      moveToward: () => true,
      moveRandom: () => false,
      findSpawnCell: () => world.index(2, 2),
      spawnOffspring: () => child,
    };

    const herbivores = [entity as never];
    const plants = new Map<number, never>([
      [world.index(1, 0), { id: 'plant' } as never],
    ]);
    for (let index = 100; index < 340; index += 1) {
      plants.set(index, { id: `p-${index}` } as never);
    }
    const ctx: SimContext = {
      world,
      config,
      rng,
      day: true,
      light: 100,
      o2: 100,
      co2: 50,
      plants: plants as never,
      insects: [],
      herbivores: herbivores as never,
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
      nextId: () => 'id',
    };

    const behavior = new BaseHerbivoreBehavior();
    behavior.tick(entity as never, ctx);

    expect(plants.has(world.index(1, 0))).toBe(false);
    expect(world.nutrients[world.index(1, 0)]).toBe(50);
    expect(entity.energy).toBe(19);
    expect(entity.cooldown).toBe(config.insects.herbivores.breed.cooldown);
    expect(herbivores).toHaveLength(2);
    expect(ctx.stats.herbivoreBirths).toBe(1);
  });

  it('falls back to random movement and does not breed when gates fail', () => {
    const config = getDefaultConfig();
    config.insects.herbivores.breed.chance = 0;
    const world = new World(3, createRng());
    const rng = createRng([false]);

    let movedRandom = 0;
    const entity = {
      id: 'h2',
      cell: world.index(1, 1),
      energy: 5,
      cooldown: 2,
      alive: true,
      findNearestPlant: () => -1,
      moveToward: () => false,
      moveRandom: () => {
        movedRandom += 1;
        return true;
      },
      findSpawnCell: () => -1,
      spawnOffspring: () => ({ id: 'child' }),
    };

    const herbivores = [
      entity as never,
      { ...entity, id: 'h3', cell: world.index(0, 0) } as never,
    ];
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
      herbivores: herbivores as never,
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
      nextId: () => 'id',
    };

    new BaseHerbivoreBehavior().tick(entity as never, ctx);

    expect(movedRandom).toBe(1);
    expect(ctx.stats.herbivoreBirths).toBe(0);
    expect(herbivores).toHaveLength(2);
  });
});
