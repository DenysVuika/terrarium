import type { SimulationConfig } from './config.ts';
import type { Rng } from './rng.ts';
import type { World } from './world.ts';
import type { Plant } from './entities/plant.ts';
import type { Herbivore } from './entities/herbivore.ts';
import type { Carnivore } from './entities/carnivore.ts';
import type { SimulationEvent } from './events.ts';

export interface TickStats {
  herbivoreBirths: number;
  carnivoreBirths: number;
  herbivoreDeaths: number;
  carnivoreDeaths: number;
  herbivoreKillsByCarnivores: number;
  carnivoreKillsByCarnivores: number;
}

/**
 * Per-tick simulation context passed to every entity's tick() call.
 * Provides shared world state, entity collections, RNG, and event hooks.
 */
export interface SimContext {
  world: World;
  config: SimulationConfig;
  rng: Rng;
  day: boolean;
  light: number;
  o2: number;
  co2: number;
  plants: Map<number, Plant>;
  herbivores: Herbivore[];
  carnivores: Carnivore[];
  /** Mutable set of occupied cells updated by entity movement each tick. */
  occupied: Set<number>;
  addEvent(msg: string): void;
  emitEvent(event: SimulationEvent): void;
  stats: TickStats;
  nextId(prefix: string): string;
}
