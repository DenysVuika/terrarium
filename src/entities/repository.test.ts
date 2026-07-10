import { describe, expect, it } from 'vitest';

import type { Insect } from './insects';
import { EntityRepository } from './repository';

function createInsect(kind: string, cell: number, alive = true): Insect {
  return {
    id: `${kind}-${cell}`,
    kind,
    cell,
    alive,
    lastCell: -1,
    age: 0,
    stage: 'adult',
    stageTicks: 0,
    energy: 1,
    starvationTicks: 0,
    cooldown: 0,
    stepCharge: 0,
    tick: () => {},
    moveToward: () => false,
    moveRandom: () => false,
    fleeFrom: () => {},
    findNearestPlant: () => -1,
    findSpawnCell: () => -1,
  } as unknown as Insect;
}

describe('EntityRepository', () => {
  it('groups insects by kind and exposes typed species getters', () => {
    const repository = new EntityRepository();
    const herbivore = createInsect('herbivore', 4);
    const carnivore = createInsect('carnivore', 9);

    repository.addInsect(herbivore);
    repository.addInsect(carnivore);

    expect(repository.getByKind('herbivore')).toHaveLength(1);
    expect(repository.getByKind('carnivore')).toHaveLength(1);
    expect(repository.herbivores).toHaveLength(1);
    expect(repository.carnivores).toHaveLength(1);
    expect(repository.allInsects()).toHaveLength(2);
  });

  it('tracks occupancy and live counts across species', () => {
    const repository = new EntityRepository();
    const aliveHerbivore = createInsect('herbivore', 1, true);
    const deadHerbivore = createInsect('herbivore', 2, false);
    const aliveCarnivore = createInsect('carnivore', 3, true);

    repository.addInsect(aliveHerbivore);
    repository.addInsect(deadHerbivore);
    repository.addInsect(aliveCarnivore);

    expect(repository.isOccupied(1)).toBe(true);
    expect(repository.isOccupied(2)).toBe(false);
    expect(repository.countLiveHerbivores()).toBe(1);
    expect(repository.countLiveCarnivores()).toBe(1);
    expect(repository.countLiveInsects()).toBe(2);
    expect([...repository.buildOccupiedSet()].sort((a, b) => a - b)).toEqual([
      1, 3,
    ]);
  });

  it('removes dead insects on cleanup', () => {
    const repository = new EntityRepository();
    const live = createInsect('herbivore', 6, true);
    const dead = createInsect('herbivore', 7, false);

    repository.addInsect(live);
    repository.addInsect(dead);
    repository.cleanupDead();

    expect(repository.getByKind('herbivore')).toHaveLength(1);
    expect(repository.getByKind('herbivore')[0]?.cell).toBe(6);
  });
});
