import type { SimulationConfig } from './config';
import type { Rng } from './rng';
import type { World } from './world';
import type { Plant } from './entities/plant';
import type { Insect } from './entities/insect';
import type { Herbivore } from './entities/herbivore';
import type { Carnivore } from './entities/carnivore';
import type { SimulationEvent } from './events';

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
  /** All insects across every registered species (built-in and custom). */
  insects: Insect[];
  /** Herbivores — direct array reference, mutations (push) are reflected in the repository. */
  herbivores: Herbivore[];
  /** Carnivores — direct array reference, mutations (push) are reflected in the repository. */
  carnivores: Carnivore[];
  /** Returns live insects of an arbitrary registered kind. Useful in custom species behaviors. */
  getInsectsByKind(kind: string): Insect[];
  /** Mutable set of occupied cells updated by entity movement each tick. */
  occupied: Set<number>;
  addEvent(msg: string): void;
  emitEvent(event: SimulationEvent): void;
  stats: TickStats;
  nextId(prefix: string): string;
}
