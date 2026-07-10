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
});
