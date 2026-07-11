import { describe, expect, it } from 'vitest';

import { getDefaultConfig } from './config';
import { Simulator } from './simulator';
import { TERRAIN } from './world';

function createBareSimulator(lidOpen: boolean): Simulator {
  const config = getDefaultConfig();

  config.world.size = 2;
  config.world.ticks = 10;
  config.world.seed = 'lid-test';
  config.world.lidOpen = lidOpen;

  config.plants.initialCount = 0;
  config.insects.herbivores.initialCount = 0;
  config.insects.carnivores.initialCount = 0;

  config.climate.rainChance = 0;
  config.climate.droughtChance = 0;
  config.climate.evaporationOpen = 0.16;

  config.biome.moistureSeepageFromWater = 0;
  config.biome.moistureSeepageFromAdjacentWater = 0;

  return new Simulator(config);
}

describe('Simulator lid mechanics', () => {
  it('applies evaporation when lid is open', () => {
    const simulator = createBareSimulator(true);

    simulator.world.terrain.fill(TERRAIN.SOIL);
    simulator.world.water.fill(10);

    simulator.processWeatherAndCellResources();

    for (const water of simulator.world.water) {
      expect(water).toBeCloseTo(9.84, 6);
    }
  });

  it('does not evaporate water when lid is closed', () => {
    const simulator = createBareSimulator(false);

    simulator.world.terrain.fill(TERRAIN.SOIL);
    simulator.world.water.fill(10);

    simulator.processWeatherAndCellResources();

    for (const water of simulator.world.water) {
      expect(water).toBeCloseTo(10, 6);
    }
  });

  it('respects lid toggles at runtime for resource updates', () => {
    const simulator = createBareSimulator(false);

    simulator.world.terrain.fill(TERRAIN.SOIL);
    simulator.world.water.fill(10);

    simulator.processWeatherAndCellResources();
    expect(simulator.world.water[0]).toBeCloseTo(10, 6);

    simulator.config.world.lidOpen = true;
    simulator.processWeatherAndCellResources();
    expect(simulator.world.water[0]).toBeCloseTo(9.84, 6);
  });

  it('maps light to day/night and lid state', () => {
    const simulator = createBareSimulator(true);

    simulator.day = true;
    simulator.config.world.lidOpen = true;
    expect(simulator.getCurrentLight()).toBe(100);

    simulator.config.world.lidOpen = false;
    expect(simulator.getCurrentLight()).toBe(50);

    simulator.day = false;
    expect(simulator.getCurrentLight()).toBe(0);
  });

  it('still gains net water on water terrain when seepage exceeds evaporation', () => {
    const simulator = createBareSimulator(true);

    simulator.config.biome.moistureSeepageFromWater = 1.2;
    simulator.world.terrain.fill(TERRAIN.WATER);
    simulator.world.water.fill(10);

    simulator.processWeatherAndCellResources();

    // Water terrain receives seepage baseline each tick, which can mask evaporation.
    expect(simulator.world.water[0]).toBeCloseTo(11.04, 6);
  });
});
