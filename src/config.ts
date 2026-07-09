export const DEFAULT_CONFIG = {
  // World width/height in cells.
  size: 250,
  // Maximum number of simulation ticks before forced win.
  ticks: 100,
  // Seed for deterministic RNG and reproducible runs.
  seed: 'prototype-1',
  // Whether the terrarium lid starts open.
  lidOpen: true,

  // Number of ticks each day phase lasts.
  dayTicks: 1,
  // Number of ticks each night phase lasts.
  nightTicks: 1,
  // Multiplier applied to passive insect metabolism during night.
  nightMetabolismMultiplier: 0.7,

  // Plant shrink amount per tick during dark dormancy (resources still sufficient).
  plantNightShrink: 0.15,
  // Plant shrink amount per tick during true stress (insufficient resources).
  plantStressShrink: 0.5,

  // Initial number of plants spawned at simulation start.
  initialPlants: 1800,
  // Initial number of herbivores spawned at simulation start.
  initialHerbivores: 180,
  // Initial number of carnivores spawned at simulation start.
  initialCarnivores: 8,

  // Per-tick chance that a mature plant attempts reproduction.
  plantReproductionChance: 0.12,
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
  // Baseline moisture recharge for water terrain cells.
  moistureSeepageFromWater: 1.2,
  // Moisture added to non-water cells per adjacent water neighbor.
  moistureSeepageFromAdjacentWater: 0.35,

  // Amount of water consumed when an insect drinks.
  insectDrinkAmount: 0.5,
  // Step-charge recovered per tick for movement.
  insectStepChargePerTick: 1.2,
  // Step-charge cost multiplier for moving on sand.
  sandStepCost: 1.5,

  // Herbivore egg stage duration in ticks.
  eggStageTicks: 4,
  // Herbivore larva stage duration in ticks.
  larvaStageTicks: 2,
  // Carnivore egg stage duration in ticks.
  carnivoreEggStageTicks: 2,
  // Carnivore larva stage duration in ticks.
  carnivoreLarvaStageTicks: 1,

  // Energy loss per tick for herbivores without nearby drinkable water.
  herbivoreDehydrationPenalty: 0.5,
  // Energy loss per tick for carnivores without nearby drinkable water.
  carnivoreDehydrationPenalty: 0.2,

  // Minimum herbivore energy required to attempt reproduction.
  herbivoreBreedEnergyMin: 14,
  // Herbivore energy spent on successful reproduction.
  herbivoreBreedEnergyCost: 6,
  // Herbivore reproduction cooldown duration in ticks.
  herbivoreBreedCooldown: 18,
  // Herbivore chance to reproduce when all gates are met.
  herbivoreBreedChance: 0.12,
  // Maximum number of nearby herbivores (radius gate) allowed for herbivore reproduction.
  herbivoreBreedLocalCap: 3,
  // Soft global cap multiplier for herbivore population relative to plants.
  herbivorePopulationCapPerPlant: 0.0095,

  // Minimum carnivore energy required to attempt reproduction.
  carnivoreBreedEnergyMin: 16,
  // Carnivore energy spent on successful reproduction.
  carnivoreBreedEnergyCost: 7,
  // Carnivore reproduction cooldown duration in ticks.
  carnivoreBreedCooldown: 16,
  // Carnivore chance to reproduce when all gates are met.
  // Slightly reduced to curb late-game predator overgrowth.
  carnivoreBreedChance: 0.1,
  // Maximum number of nearby carnivores (radius gate) allowed for carnivore reproduction.
  carnivoreBreedLocalCap: 2,
  // Soft global cap multiplier for carnivore population relative to herbivores.
  carnivorePopulationCapPerHerbivore: 0.3,

  // Herbivore passive metabolism per tick before day/night multiplier.
  herbivoreMetabolismPerTick: 0.1,
  // Carnivore passive metabolism per tick before day/night multiplier.
  carnivoreMetabolismPerTick: 0.04,

  // Search radius for carnivores when locating prey.
  carnivoreHuntRadius: 4,
  // Chance carnivores fight rivals when eligible.
  carnivoreRivalFightChance: 0.12,
  // Minimum energy required for a carnivore to engage in rival combat.
  carnivoreRivalFightEnergyMin: 9,

  // Chance a carnivore rests (instead of roaming) when no prey target exists.
  carnivoreRestChanceNoPrey: 0.85,
  // Energy recovered when carnivore rest behavior triggers.
  carnivoreRestEnergyRecovery: 0.3,

  // Herbivore energy cost per successful movement step.
  herbivoreMoveEnergyCost: 0.8,
  // Carnivore energy cost per successful movement step.
  carnivoreMoveEnergyCost: 0.5,

  // Chance prey successfully flees when carnivore attacks.
  carnivorePreyFleeChance: 0.2,
  // Energy damage dealt to prey per carnivore hit.
  carnivoreAttackDamage: 2,
  // Energy gained by carnivore on successful prey kill.
  carnivoreKillEnergyGain: 7,
  // AP recovered by carnivore per tick.
  carnivoreApRegenPerTick: 1,

  // Consecutive ticks at non-positive energy before herbivore starvation death.
  herbivoreStarvationTicks: 5,
  // Consecutive ticks at non-positive energy before carnivore starvation death.
  carnivoreStarvationTicks: 8,

  // Maximum herbivore age in ticks.
  herbivoreMaxAge: 320,
  // Maximum carnivore age in ticks.
  carnivoreMaxAge: 180,
};

export type SimulationConfig = typeof DEFAULT_CONFIG;