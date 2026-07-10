import { describe, expect, it } from 'vitest';

import type { Rng } from './rng';
import { TERRAIN, World } from './world';

function createPredictableRng(): Rng {
  return {
    next: () => 0,
    int: (min) => min,
    chance: () => false,
    pick: (items) => items[0] ?? null,
  };
}

describe('World', () => {
  it('maps index and coordinates consistently', () => {
    const world = new World(4, createPredictableRng());

    expect(world.index(2, 3)).toBe(14);
    expect(world.coords(14)).toEqual({ x: 2, y: 3 });
  });

  it('returns 4-neighbors and 8-neighbors within bounds', () => {
    const world = new World(3, createPredictableRng());

    expect(world.neighbors4(world.index(0, 0))).toEqual([1, 3]);
    expect(world.neighbors4(world.index(1, 1)).sort((a, b) => a - b)).toEqual([
      1, 3, 5, 7,
    ]);

    expect(world.neighbors8(world.index(0, 0)).sort((a, b) => a - b)).toEqual([
      1, 3, 4,
    ]);
    expect(world.neighbors8(world.index(1, 1)).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 5, 6, 7, 8,
    ]);
  });

  it('falls back to linear scan when random probing misses all matches', () => {
    const world = new World(3, createPredictableRng());

    const target = world.randomCell((index) => index === 8);
    expect(target).toBe(8);
  });

  it('returns -1 from randomCell when no cell matches', () => {
    const world = new World(2, createPredictableRng());
    expect(world.randomCell(() => false)).toBe(-1);
  });

  it('recognizes soil and walkable terrain', () => {
    const world = new World(2, createPredictableRng());
    world.terrain = new Uint8Array([
      TERRAIN.SOIL,
      TERRAIN.WATER,
      TERRAIN.SAND,
      TERRAIN.EMPTY,
    ]);

    expect(world.isSoil(0)).toBe(true);
    expect(world.isSoil(1)).toBe(false);
    expect(world.isWalkable(0)).toBe(true);
    expect(world.isWalkable(2)).toBe(true);
    expect(world.isWalkable(1)).toBe(false);
    expect(world.isWalkable(3)).toBe(false);
  });
});
