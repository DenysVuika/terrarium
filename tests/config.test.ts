import { describe, expect, it } from 'vitest';

import { getDefaultConfig } from '../src/config';

describe('getDefaultConfig', () => {
  it('returns an isolated deep clone of the default config', () => {
    const configA = getDefaultConfig();
    const configB = getDefaultConfig();

    configA.world.size = 42;
    configA.insects.herbivores.breed.cooldown = 99;

    expect(configB.world.size).toBe(250);
    expect(configB.insects.herbivores.breed.cooldown).toBe(18);
  });
});