import { describe, expect, it } from 'vitest';

import { insectRegistry, Insect } from '@/entities/insects';
import { Plant } from '@/entities/plants';

describe('entity alias barrels', () => {
  it('expose plant and insect entry points via @ alias', () => {
    expect(Plant).toBeTypeOf('function');
    expect(Insect).toBeTypeOf('function');
  });

  it('preserves built-in species self-registration', () => {
    expect(insectRegistry.get('herbivore')).toBeDefined();
    expect(insectRegistry.get('carnivore')).toBeDefined();
  });
});
