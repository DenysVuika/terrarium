import type { CarnivoreBehaviorId, HerbivoreBehaviorId } from '@/behaviors';

// Re-export for external consumers who need the id types.
export type { HerbivoreBehaviorId, CarnivoreBehaviorId };

export const DEFAULT_CONFIG = {
  world: {
    // World width/height in cells.
    size: 250,
    // Maximum number of simulation ticks before forced win.
    ticks: 100,
    // Seed for deterministic RNG and reproducible runs.
    seed: 'prototype-1',
    // Whether the terrarium lid starts open.
    lidOpen: true,
  },

  climate: {
    // Number of ticks each day phase lasts.
    dayTicks: 1,
    // Number of ticks each night phase lasts.
    nightTicks: 1,
    // Multiplier applied to passive insect metabolism during night.
    nightMetabolismMultiplier: 0.7,
    // Scale factor for gas exchange magnitudes (plants/insects).
    gasFluxScale: 0.003,
    // Damping pull toward gas midpoint for stability.
    gasMidpointPull: 0.08,
    // Chance a cell receives rain in a tick.
    rainChance: 0.11,
    // Water added to a cell when rain occurs.
    rainAmount: 8,
    // Chance a cell is affected by drought in a tick.
    droughtChance: 0.04,
    // Water removed from a cell when drought occurs.
    droughtAmount: 3,
    // Water evaporation per tick when lid is open.
    evaporationOpen: 0.16,
  },

  biome: {
    // Baseline moisture recharge for water terrain cells.
    moistureSeepageFromWater: 1.2,
    // Moisture added to non-water cells per adjacent water neighbor.
    moistureSeepageFromAdjacentWater: 0.35,
  },

  plants: {
    // Initial number of plants spawned at simulation start.
    initialCount: 1800,
    // Per-tick chance that a mature plant attempts reproduction.
    reproductionChance: 0.12,
    // Plant shrink amount per tick during dark dormancy (resources still sufficient).
    nightShrink: 0.15,
    // Plant shrink amount per tick during true stress (insufficient resources).
    stressShrink: 0.5,
  },

  insects: {
    // Amount of water consumed when an insect drinks.
    drinkAmount: 0.5,
    // Step-charge recovered per tick for movement.
    stepChargePerTick: 1.2,
    // Step-charge cost multiplier for moving on sand.
    sandStepCost: 1.5,

    herbivores: {
      // Initial number of herbivores spawned at simulation start.
      initialCount: 180,
      // Herbivore egg stage duration in ticks.
      eggStageTicks: 4,
      // Herbivore larva stage duration in ticks.
      larvaStageTicks: 2,
      // Energy loss per tick for herbivores without nearby drinkable water.
      dehydrationPenalty: 0.5,
      // Herbivore passive metabolism per tick before day/night multiplier.
      metabolismPerTick: 0.1,
      // Herbivore energy cost per successful movement step.
      moveEnergyCost: 0.8,
      // Consecutive ticks at non-positive energy before herbivore starvation death.
      starvationTicks: 5,
      // Maximum herbivore age in ticks.
      maxAge: 320,
      breed: {
        // Minimum herbivore energy required to attempt reproduction.
        energyMin: 14,
        // Herbivore energy spent on successful reproduction.
        energyCost: 6,
        // Herbivore reproduction cooldown duration in ticks.
        cooldown: 18,
        // Herbivore chance to reproduce when all gates are met.
        chance: 0.12,
        // Maximum number of nearby herbivores (radius gate) allowed for reproduction.
        localCap: 3,
        // Soft global cap multiplier for herbivore population relative to plants.
        populationCapPerPlant: 0.0095,
      },
    },

    carnivores: {
      // Initial number of carnivores spawned at simulation start.
      initialCount: 8,
      // Carnivore egg stage duration in ticks.
      eggStageTicks: 2,
      // Carnivore larva stage duration in ticks.
      larvaStageTicks: 1,
      // Energy loss per tick for carnivores without nearby drinkable water.
      dehydrationPenalty: 0.2,
      // Carnivore passive metabolism per tick before day/night multiplier.
      metabolismPerTick: 0.04,
      // Carnivore energy cost per successful movement step.
      moveEnergyCost: 0.5,
      // Search radius for carnivores when locating prey.
      huntRadius: 4,
      // Chance carnivores fight rivals when eligible.
      rivalFightChance: 0.12,
      // Minimum energy required for a carnivore to engage in rival combat.
      rivalFightEnergyMin: 9,
      // Chance a carnivore rests (instead of roaming) when no prey target exists.
      restChanceNoPrey: 0.85,
      // Energy recovered when carnivore rest behavior triggers.
      restEnergyRecovery: 0.3,
      // Chance prey successfully flees when carnivore attacks.
      preyFleeChance: 0.2,
      // Energy damage dealt to prey per carnivore hit.
      attackDamage: 2,
      // Energy gained by carnivore on successful prey kill.
      killEnergyGain: 7,
      // AP recovered by carnivore per tick.
      apRegenPerTick: 1,
      // Consecutive ticks at non-positive energy before carnivore starvation death.
      starvationTicks: 8,
      // Maximum carnivore age in ticks.
      maxAge: 180,
      breed: {
        // Minimum carnivore energy required to attempt reproduction.
        energyMin: 16,
        // Carnivore energy spent on successful reproduction.
        energyCost: 7,
        // Carnivore reproduction cooldown duration in ticks.
        cooldown: 16,
        // Carnivore chance to reproduce when all gates are met.
        // Slightly reduced to curb late-game predator overgrowth.
        chance: 0.1,
        // Maximum number of nearby carnivores (radius gate) allowed for reproduction.
        localCap: 2,
        // Soft global cap multiplier for carnivore population relative to herbivores.
        populationCapPerHerbivore: 0.3,
      },
    },
  },
};

export type SimulationConfig = typeof DEFAULT_CONFIG;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

export function getDefaultConfig(): SimulationConfig {
  return structuredClone(DEFAULT_CONFIG);
}
