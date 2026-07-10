import { describe, expect, it } from 'vitest';

import { clamp } from './math';

describe('clamp', () => {
  it('returns value when already in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps values lower than min', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });

  it('clamps values higher than max', () => {
    expect(clamp(13, 0, 10)).toBe(10);
  });
});
