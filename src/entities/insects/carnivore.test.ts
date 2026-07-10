import { describe, expect, it, vi } from 'vitest';

import { getDefaultConfig } from '@/config';
import type { SimContext } from '@/context';
import type { Rng } from '@/rng';
import { TERRAIN, World } from '@/world';
import { Carnivore } from './carnivore';
import { insectRegistry } from './insect-registry';

function createRng(overrides?: Partial<Rng>): Rng {
  return {
    next: overrides?.next ?? (() => 0),
    int: overrides?.int ?? ((min) => min),
    chance: overrides?.chance ?? (() => false),
    pick: overrides?.pick ?? ((items) => items[0] ?? null),
  };
}

class ProbeCarnivore extends Carnivore {
  public runExtraLifecycle(ctx: SimContext): void {
    this.tickExtraLifecycle(ctx);
  }

  public runAfterMove(cell: number, ctx: SimContext): void {
    this.onAfterMove(cell, ctx);
  }

  public runOnDeath(ctx: SimContext): void {
    this.onDeath(ctx);
  }

  public lifecycleSnapshot(): {
    eggTicks: number;
    larvaTicks: number;
    maxAge: number;
    starvationLimit: number;
    metabolismPerTick: number;
    dehydrationPenalty: number;
    moveEnergyCost: number;
  } {
    return {
      eggTicks: this.eggStageTicks,
      larvaTicks: this.larvaStageTicks,
      maxAge: this.maxAge,
      starvationLimit: this.starvationLimit,
      metabolismPerTick: this.metabolismPerTick,
      dehydrationPenalty: this.dehydrationPenalty,
      moveEnergyCost: this.moveEnergyCost,
    };
  }

  public runTickBehavior(ctx: SimContext): void {
    this.tickBehavior(ctx);
  }
}

function createContext(overrides?: {
  pick?: (items: string[]) => string | null;
  int?: (min: number, max: number) => number;
}): { ctx: SimContext; world: World } {
  const config = getDefaultConfig();
  const rng = createRng({
    pick: overrides?.pick as Rng['pick'] | undefined,
    int: overrides?.int,
  });
  const world = new World(3, rng);
  world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);

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
    carnivores: [],
    getInsectsByKind: () => [],
    occupied: new Set(),
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
    nextId: () => 'c-child',
  };

  return { ctx, world };
}

describe('Carnivore', () => {
  it('spawns offspring with selected behavior id', () => {
    const { ctx, world } = createContext({ pick: () => 'aggressive' });
    const parent = new Carnivore(
      'c-parent',
      world.index(1, 1),
      12,
      ctx.config,
      'default',
    );

    const child = parent.spawnOffspring(ctx, world.index(2, 2));

    expect(child.id).toBe('c-child');
    expect(child.cell).toBe(world.index(2, 2));
    expect(child.behaviorId).toBe('aggressive');
    expect(child.energy).toBe(7);
  });

  it('falls back to default behavior when rng pick returns null', () => {
    const { ctx, world } = createContext({ pick: () => null });
    const parent = new Carnivore(
      'c-parent',
      world.index(1, 1),
      12,
      ctx.config,
      'passive',
    );

    const child = parent.spawnOffspring(ctx, world.index(0, 0));

    expect(child.behaviorId).toBe('default');
  });

  it('regenerates AP with clamp and applies sand movement AP tax', () => {
    const { ctx, world } = createContext();
    const carnivore = new ProbeCarnivore(
      'c',
      world.index(1, 1),
      10,
      ctx.config,
      'default',
    );
    const sandCell = world.index(2, 2);
    world.terrain[sandCell] = TERRAIN.SAND;

    carnivore.ap = 10;
    carnivore.runExtraLifecycle(ctx);
    expect(carnivore.ap).toBe(10);

    carnivore.ap = 5;
    carnivore.runAfterMove(sandCell, ctx);
    expect(carnivore.ap).toBe(4);
  });

  it('resets AP and increments carnivore death stats in onDeath hook', () => {
    const { ctx, world } = createContext();
    const carnivore = new ProbeCarnivore(
      'c',
      world.index(1, 1),
      10,
      ctx.config,
      'default',
    );
    carnivore.ap = 7;

    carnivore.runOnDeath(ctx);

    expect(carnivore.ap).toBe(0);
    expect(ctx.stats.carnivoreDeaths).toBe(1);
  });

  it('reads lifecycle values from config and exposes config getter', () => {
    const { ctx, world } = createContext();
    const carnivore = new ProbeCarnivore(
      'c',
      world.index(1, 1),
      10,
      ctx.config,
      'default',
    );

    expect(carnivore.config).toBe(ctx.config);
    expect(carnivore.lifecycleSnapshot()).toEqual({
      eggTicks: ctx.config.insects.carnivores.eggStageTicks,
      larvaTicks: ctx.config.insects.carnivores.larvaStageTicks,
      maxAge: ctx.config.insects.carnivores.maxAge,
      starvationLimit: ctx.config.insects.carnivores.starvationTicks,
      metabolismPerTick: ctx.config.insects.carnivores.metabolismPerTick,
      dehydrationPenalty: ctx.config.insects.carnivores.dehydrationPenalty,
      moveEnergyCost: ctx.config.insects.carnivores.moveEnergyCost,
    });
  });

  it('delegates tickBehavior to resolved strategy', () => {
    const { ctx, world } = createContext();
    const carnivore = new ProbeCarnivore(
      'c',
      world.index(1, 1),
      10,
      ctx.config,
      'default',
    );
    const tick = vi.fn();

    (
      carnivore as unknown as {
        behavior: { tick: (entity: Carnivore, context: SimContext) => void };
      }
    ).behavior = { tick };

    carnivore.runTickBehavior(ctx);

    expect(tick).toHaveBeenCalledWith(carnivore, ctx);
  });

  it('creates carnivore via registry and applies afterSeed hook', () => {
    const { ctx, world } = createContext({ int: () => 4 });
    const definition = insectRegistry.get('carnivore');

    expect(definition).toBeDefined();
    const created = definition!.create(
      'c-reg',
      world.index(0, 1),
      11,
      ctx.config,
      'passive',
    );
    expect(created).toBeInstanceOf(Carnivore);

    definition!.afterSeed?.(created, ctx.rng);
    expect((created as Carnivore).ap).toBe(4);
  });
});
