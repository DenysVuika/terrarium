import type { SimulationConfig } from '../../config';
import type { Rng } from '../../rng';
import type { Insect } from './insect';

/**
 * Defines how a species is created, seeded, and represented in the simulation.
 *
 * Registering a species here is the single integration point for a new insect
 * type: no changes to simulator.ts, repository.ts, or context.ts are needed.
 *
 * @example
 * ```ts
 * // src/entities/insects/decomposer.ts (at the bottom, after the class definition)
 * insectRegistry.register({
 *   kind: 'decomposer',
 *   behaviorIds: DECOMPOSER_BEHAVIOR_IDS,
 *   seedEnergyRange: [5, 10],
 *   initialCount: (config) => config.initialDecomposers ?? 0,
 *   create: (id, cell, energy, config, behaviorId) =>
 *     new Decomposer(id, cell, energy, config, behaviorId),
 * });
 * ```
 */
export interface InsectSpeciesDefinition {
  /** Stable unique identifier matching the insect's `kind` field. */
  kind: string;
  /** All valid behavior profile IDs for this species. */
  behaviorIds: readonly string[];
  /** Energy [min, max] used when seeding the initial population. */
  seedEnergyRange: [min: number, max: number];
  /** How many insects of this species to spawn at the start of a run. */
  initialCount(config: SimulationConfig): number;
  /** Creates a new insect instance. Called during seeding and offspring spawning. */
  create(id: string, cell: number, energy: number, config: SimulationConfig, behaviorId: string): Insect;
  /**
   * Optional hook called on each newly seeded insect right after `create`.
   * Use for species-specific initial state that can't be set in the constructor
   * (e.g., carnivore AP is randomised at seeding time).
   */
  afterSeed?(insect: Insect, rng: Rng): void;
}

class InsectRegistry {
  private readonly _species = new Map<string, InsectSpeciesDefinition>();

  /**
   * Register a new insect species.
   * Call this once per species, typically at the bottom of the species file.
   */
  register(def: InsectSpeciesDefinition): void {
    this._species.set(def.kind, def);
  }

  /** Returns all registered species in insertion order. */
  all(): InsectSpeciesDefinition[] {
    return [...this._species.values()];
  }

  /** Look up a single species by kind identifier. */
  get(kind: string): InsectSpeciesDefinition | undefined {
    return this._species.get(kind);
  }
}

/** Singleton registry — import this wherever species definitions are needed. */
export const insectRegistry = new InsectRegistry();