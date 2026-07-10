import { describe, expect, it, vi } from 'vitest';

import { getDefaultConfig } from '@/config';
import type { SimContext } from '@/context';
import type { Rng } from '@/rng';
import { TERRAIN, World } from '@/world';
import { Herbivore } from './herbivore';
import { insectRegistry } from './insect-registry';

function createRng(overrides?: Partial<Rng>): Rng {
  return {
    next: overrides?.next ?? (() => 0),
    int: overrides?.int ?? ((min) => min),
    chance: overrides?.chance ?? (() => false),
    pick: overrides?.pick ?? ((items) => items[0] ?? null),
  };
}

class ProbeHerbivore extends Herbivore {
  public readBias(cell: number, ctx: SimContext): number {
    return this.extraMoveBias(cell, ctx);
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
}): { ctx: SimContext; world: World } {
  const config = getDefaultConfig();
  const rng = createRng({ pick: overrides?.pick as Rng['pick'] | undefined });
  const world = new World(3, rng);
  world.terrain = new Uint8Array(9).fill(TERRAIN.SOIL);
  world.water = new Float32Array(9).fill(100);
  world.nutrients = new Float32Array(9).fill(100);

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
    nextId: () => 'h-child',
  };

  return { ctx, world };
}

describe('Herbivore', () => {
  it('spawns offspring with selected behavior id', () => {
    const { ctx, world } = createContext({ pick: () => 'forager' });
    const parent = new Herbivore(
      'h-parent',
      world.index(1, 1),
      12,
      ctx.config,
      'default',
    );

    const child = parent.spawnOffspring(ctx, world.index(2, 2));

    expect(child.id).toBe('h-child');
    expect(child.cell).toBe(world.index(2, 2));
    expect(child.behaviorId).toBe('forager');
    expect(child.energy).toBe(5);
  });

  it('falls back to default behavior when rng pick returns null', () => {
    const { ctx, world } = createContext({ pick: () => null });
    const parent = new Herbivore(
      'h-parent',
      world.index(1, 1),
      12,
      ctx.config,
      'forager',
    );

    const child = parent.spawnOffspring(ctx, world.index(0, 0));

    expect(child.behaviorId).toBe('default');
  });

  it('computes random-move plant bias from adjacent plants', () => {
    const { ctx, world } = createContext();
    const herbivore = new ProbeHerbivore(
      'h',
      world.index(1, 1),
      10,
      ctx.config,
      'default',
    );
    const center = world.index(1, 1);

    ctx.plants.set(world.index(0, 0), { id: 'p1' } as never);
    ctx.plants.set(world.index(1, 0), { id: 'p2' } as never);

    expect(herbivore.readBias(center, ctx)).toBeCloseTo(1.4, 5);
  });

  it('increments herbivore death stats in onDeath hook', () => {
    const { ctx, world } = createContext();
    const herbivore = new ProbeHerbivore(
      'h',
      world.index(1, 1),
      10,
      ctx.config,
      'default',
    );

    herbivore.runOnDeath(ctx);

    expect(ctx.stats.herbivoreDeaths).toBe(1);
  });

  it('reads lifecycle values from config and exposes config getter', () => {
    const { ctx, world } = createContext();
    const herbivore = new ProbeHerbivore(
      'h',
      world.index(1, 1),
      10,
      ctx.config,
      'default',
    );

    expect(herbivore.config).toBe(ctx.config);
    expect(herbivore.lifecycleSnapshot()).toEqual({
      eggTicks: ctx.config.insects.herbivores.eggStageTicks,
      larvaTicks: ctx.config.insects.herbivores.larvaStageTicks,
      maxAge: ctx.config.insects.herbivores.maxAge,
      starvationLimit: ctx.config.insects.herbivores.starvationTicks,
      metabolismPerTick: ctx.config.insects.herbivores.metabolismPerTick,
      dehydrationPenalty: ctx.config.insects.herbivores.dehydrationPenalty,
      moveEnergyCost: ctx.config.insects.herbivores.moveEnergyCost,
    });
  });

  it('delegates tickBehavior to resolved strategy', () => {
    const { ctx, world } = createContext();
    const herbivore = new ProbeHerbivore(
      'h',
      world.index(1, 1),
      10,
      ctx.config,
      'default',
    );
    const tick = vi.fn();

    (
      herbivore as unknown as {
        behavior: { tick: (entity: Herbivore, context: SimContext) => void };
      }
    ).behavior = { tick };

    herbivore.runTickBehavior(ctx);

    expect(tick).toHaveBeenCalledWith(herbivore, ctx);
  });

  it('creates herbivore via registry factory', () => {
    const { ctx, world } = createContext();
    const definition = insectRegistry.get('herbivore');

    expect(definition).toBeDefined();
    const created = definition!.create(
      'h-reg',
      world.index(0, 1),
      9,
      ctx.config,
      'forager',
    );

    expect(created).toBeInstanceOf(Herbivore);
    expect(created.kind).toBe('herbivore');
  });
});
