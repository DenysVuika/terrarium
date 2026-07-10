import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('is deterministic for the same seed', () => {
    const rngA = createRng('seed-a');
    const rngB = createRng('seed-a');

    const valuesA = [rngA.next(), rngA.next(), rngA.next()];
    const valuesB = [rngB.next(), rngB.next(), rngB.next()];

    expect(valuesA).toEqual(valuesB);
  });

  it('returns null from pick when list is empty', () => {
    const rng = createRng('seed-b');
    expect(rng.pick([])).toBeNull();
  });

  it('picks an element from non-empty lists', () => {
    const rng = createRng('seed-pick');
    const value = rng.pick(['a', 'b', 'c']);

    expect(['a', 'b', 'c']).toContain(value);
  });

  it('supports non-string seed types deterministically', () => {
    const seeds: unknown[] = [null, 42, true, 7n, Symbol('sym'), { x: 1 }];

    for (const seed of seeds) {
      const a = createRng(seed);
      const b = createRng(seed);
      expect([a.next(), a.next(), a.next()]).toEqual([
        b.next(),
        b.next(),
        b.next(),
      ]);
    }
  });

  it('keeps int values within inclusive bounds', () => {
    const rng = createRng('seed-c');

    for (let i = 0; i < 100; i += 1) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });

  it('applies chance probability boundaries', () => {
    const rng = createRng('seed-d');
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });
});
