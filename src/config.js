'use strict';

const DEFAULT_CONFIG = {
  size: 250,
  ticks: 100,
  seed: 'prototype-1',
  lidOpen: true,
  initialPlants: 1800,
  initialHerbivores: 180,
  initialCarnivores: 20,
  plantReproductionChance: 0.12,
  gasFluxScale: 0.003,
  gasMidpointPull: 0.08,
  rainChance: 0.08,
  rainAmount: 6,
  droughtChance: 0.06,
  droughtAmount: 4,
  evaporationOpen: 0.25,
  insectDrinkAmount: 0.7,
  carnivoreApRegenPerTick: 1,
  herbivoreMaxAge: 130,
  carnivoreMaxAge: 150,
};

module.exports = {
  DEFAULT_CONFIG,
};
