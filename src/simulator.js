'use strict';

const { World, TERRAIN } = require('./world');
const { createRng } = require('./rng');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stageFromGrowth(growth) {
  if (growth < 20) return 'seed';
  if (growth < 80) return 'sprout';
  return 'mature';
}

function nutrientDrainByGrowth(growth) {
  if (growth < 20) return 0.2;
  if (growth < 80) return 0.5;
  return 1;
}

class Simulator {
  constructor(config) {
    this.config = config;
    this.rng = createRng(config.seed);
    this.world = new World(config.size, this.rng);

    this.tick = 0;
    this.day = true;

    this.o2 = 100;
    this.co2 = 50;

    this.lowO2Ticks = 0;
    this.highCO2Ticks = 0;
    this.lowWaterTicks = 0;

    this.plants = new Map();
    this.herbivores = [];
    this.carnivores = [];
    this.entityId = 0;

    this.history = [];
    this.outcome = null;

    this.seedInitialPopulation();
  }

  nextId(prefix) {
    this.entityId += 1;
    return `${prefix}-${this.entityId}`;
  }

  seedInitialPopulation() {
    for (let i = 0; i < this.config.initialPlants; i += 1) {
      const cell = this.world.randomCell(
        (idx) => this.world.isSoil(idx) && !this.plants.has(idx),
      );
      if (cell >= 0) {
        this.plants.set(cell, {
          cell,
          growth: this.rng.int(10, 95),
          wilted: false,
          recoverTicks: 0,
          stressTicks: 0,
        });
      }
    }

    for (let i = 0; i < this.config.initialHerbivores; i += 1) {
      const cell = this.world.randomCell(
        (idx) => this.world.isWalkable(idx) && !this.isOccupied(idx),
      );
      if (cell >= 0) {
        this.herbivores.push(
          this.createInsect('herbivore', cell, this.rng.int(6, 12)),
        );
      }
    }

    for (let i = 0; i < this.config.initialCarnivores; i += 1) {
      const cell = this.world.randomCell(
        (idx) => this.world.isWalkable(idx) && !this.isOccupied(idx),
      );
      if (cell >= 0) {
        const carnivore = this.createInsect(
          'carnivore',
          cell,
          this.rng.int(10, 18),
        );
        carnivore.ap = this.rng.int(1, 6);
        this.carnivores.push(carnivore);
      }
    }
  }

  createInsect(kind, cell, energy) {
    return {
      id: this.nextId(kind[0]),
      kind,
      cell,
      age: 0,
      stage: 'egg',
      stageTicks: 0,
      energy,
      starvationTicks: 0,
      cooldown: 0,
      stepCharge: 0,
      alive: true,
      ap: 0,
    };
  }

  isOccupied(cell) {
    for (let i = 0; i < this.herbivores.length; i += 1) {
      if (this.herbivores[i].alive && this.herbivores[i].cell === cell) {
        return true;
      }
    }
    for (let i = 0; i < this.carnivores.length; i += 1) {
      if (this.carnivores[i].alive && this.carnivores[i].cell === cell) {
        return true;
      }
    }
    return false;
  }

  run() {
    while (!this.outcome && this.tick < this.config.ticks) {
      this.step();
    }

    if (!this.outcome && this.tick >= this.config.ticks) {
      this.outcome = {
        type: 'win',
        reason: `survived ${this.config.ticks} ticks`,
      };
    }

    return {
      config: this.config,
      outcome: this.outcome,
      finalTick: this.tick,
      finalState: this.snapshot(),
      history: this.history,
    };
  }

  step() {
    this.tick += 1;
    this.day = !this.day;

    const light = this.day ? (this.config.lidOpen ? 100 : 50) : 0;

    this.processWeatherAndCellResources();
    this.updateGlobalGases();
    this.processPlants(light);
    this.processInsects();
    this.cleanupDead();
    this.evaluateOutcome();

    this.history.push(this.snapshot());
  }

  snapshot() {
    const plantCount = this.plants.size;
    const herbivoreCount = this.herbivores.filter((h) => h.alive).length;
    const carnivoreCount = this.carnivores.filter((c) => c.alive).length;

    let totalWater = 0;
    let drinkableCells = 0;
    for (let i = 0; i < this.world.length; i += 1) {
      const w = this.world.water[i];
      totalWater += w;
      if (w > 1) {
        drinkableCells += 1;
      }
    }

    return {
      tick: this.tick,
      day: this.day,
      light: this.day ? (this.config.lidOpen ? 100 : 50) : 0,
      o2: Number(this.o2.toFixed(2)),
      co2: Number(this.co2.toFixed(2)),
      plants: plantCount,
      herbivores: herbivoreCount,
      carnivores: carnivoreCount,
      insects: herbivoreCount + carnivoreCount,
      avgWater: Number((totalWater / this.world.length).toFixed(2)),
      drinkableCells,
    };
  }

  processWeatherAndCellResources() {
    for (let i = 0; i < this.world.length; i += 1) {
      if (this.rng.chance(0.1)) {
        this.world.water[i] += 10;
      }
      if (this.rng.chance(0.05)) {
        this.world.water[i] -= 5;
      }

      if (this.config.lidOpen) {
        this.world.water[i] -= 0.1;
      }

      if (this.world.terrain[i] === TERRAIN.SOIL) {
        this.world.nutrients[i] += 0.1;
      }

      this.world.water[i] = clamp(this.world.water[i], 0, 100);
      this.world.nutrients[i] = clamp(this.world.nutrients[i], 0, 300);
    }
  }

  updateGlobalGases() {
    const plantCount = this.plants.size;
    const insects =
      this.herbivores.filter((h) => h.alive).length +
      this.carnivores.filter((c) => c.alive).length;

    this.o2 += 2 * (plantCount / 10) - 1 * (insects / 10);
    this.co2 += -1 * (plantCount / 10) + 1 * (insects / 10);

    this.o2 = clamp(this.o2, 0, 100);
    this.co2 = clamp(this.co2, 0, 100);
  }

  processPlants(light) {
    const toRemove = [];
    const toAdd = [];
    const co2Penalty = this.co2 > 90 ? 0.5 : 1;

    for (const [cell, plant] of this.plants.entries()) {
      const drain = nutrientDrainByGrowth(plant.growth);
      this.world.nutrients[cell] = clamp(
        this.world.nutrients[cell] - drain,
        0,
        300,
      );

      const conditionsGood =
        light >= 50 &&
        this.world.water[cell] > 30 &&
        this.world.nutrients[cell] > 20;

      if (conditionsGood) {
        plant.growth = clamp(plant.growth + 1 * co2Penalty, 0, 100);
        if (plant.wilted) {
          plant.recoverTicks += 1;
          if (plant.recoverTicks >= 3) {
            plant.wilted = false;
            plant.recoverTicks = 0;
          }
        }
      } else {
        if (plant.growth < 10) {
          toRemove.push(cell);
          continue;
        }

        plant.growth = clamp(plant.growth - 0.5, 0, 100);
        plant.wilted = true;
        plant.recoverTicks = 0;
      }

      if (
        stageFromGrowth(plant.growth) === 'mature' &&
        this.world.nutrients[cell] > 50 &&
        this.rng.chance(this.config.plantReproductionChance)
      ) {
        const options = this.world
          .neighbors4(cell)
          .filter((n) => this.world.isSoil(n) && !this.plants.has(n));

        if (options.length > 0) {
          const target = this.rng.pick(options);
          this.world.nutrients[cell] = clamp(
            this.world.nutrients[cell] - 10,
            0,
            300,
          );
          toAdd.push({
            cell: target,
            growth: 0,
            wilted: false,
            recoverTicks: 0,
            stressTicks: 0,
          });
        }
      }
    }

    for (let i = 0; i < toRemove.length; i += 1) {
      const cell = toRemove[i];
      this.plants.delete(cell);
      this.world.nutrients[cell] = clamp(
        this.world.nutrients[cell] + 50,
        0,
        300,
      );
    }

    for (let i = 0; i < toAdd.length; i += 1) {
      if (!this.plants.has(toAdd[i].cell)) {
        this.plants.set(toAdd[i].cell, toAdd[i]);
      }
    }
  }

  processInsects() {
    const occupied = new Set();
    for (let i = 0; i < this.herbivores.length; i += 1) {
      if (this.herbivores[i].alive) occupied.add(this.herbivores[i].cell);
    }
    for (let i = 0; i < this.carnivores.length; i += 1) {
      if (this.carnivores[i].alive) occupied.add(this.carnivores[i].cell);
    }

    for (let i = 0; i < this.herbivores.length; i += 1) {
      const herbivore = this.herbivores[i];
      if (!herbivore.alive) continue;
      this.updateInsectLifecycle(herbivore, occupied, false);
      if (!herbivore.alive || herbivore.stage !== 'adult') continue;
      this.runHerbivoreTurn(herbivore, occupied);
    }

    for (let i = 0; i < this.carnivores.length; i += 1) {
      const carnivore = this.carnivores[i];
      if (!carnivore.alive) continue;
      this.updateInsectLifecycle(carnivore, occupied, true);
      if (!carnivore.alive || carnivore.stage !== 'adult') continue;
      this.runCarnivoreTurn(carnivore, occupied);
    }
  }

  updateInsectLifecycle(entity, occupied, isCarnivore) {
    entity.age += 1;
    entity.stageTicks += 1;
    entity.energy -= 0.1;

    if (this.o2 < 10) {
      entity.energy -= 1;
    }

    if (entity.cooldown > 0) {
      entity.cooldown -= 1;
    }

    entity.stepCharge = clamp(entity.stepCharge + 1, 0, 2);

    if (isCarnivore) {
      entity.ap = clamp(entity.ap + 2, 0, 10);
    }

    if (entity.stage === 'egg' && entity.stageTicks >= 1) {
      entity.stage = 'larva';
      entity.stageTicks = 0;
    } else if (entity.stage === 'larva' && entity.stageTicks >= 1) {
      entity.stage = 'adult';
      entity.stageTicks = 0;
    }

    const hasNearbyWater = this.world
      .neighbors4(entity.cell)
      .some((n) => this.world.water[n] >= 0.5);

    if (hasNearbyWater) {
      const waterSources = this.world
        .neighbors4(entity.cell)
        .filter((n) => this.world.water[n] >= 0.5);
      const drinkCell = this.rng.pick(waterSources);
      this.world.water[drinkCell] = clamp(
        this.world.water[drinkCell] - 0.5,
        0,
        100,
      );
    } else {
      entity.energy -= 0.5;
    }

    if (entity.energy <= 0) {
      entity.starvationTicks += 1;
    } else {
      entity.starvationTicks = 0;
    }

    const maxAge = isCarnivore
      ? this.config.carnivoreMaxAge
      : this.config.herbivoreMaxAge;
    if (entity.starvationTicks >= 3 || entity.age >= maxAge) {
      entity.alive = false;
      occupied.delete(entity.cell);
      this.world.nutrients[entity.cell] = clamp(
        this.world.nutrients[entity.cell] + 20,
        0,
        300,
      );
      if (isCarnivore) {
        entity.ap = 0;
      }
    }
  }

  runHerbivoreTurn(herbivore, occupied) {
    const targetPlant = this.findNearestPlant(herbivore.cell, 2);
    if (targetPlant >= 0) {
      this.moveToward(herbivore, targetPlant, occupied, false);
    } else {
      this.moveRandom(herbivore, occupied, false);
    }

    const adjacentPlants = this.world
      .neighbors4(herbivore.cell)
      .filter((n) => this.plants.has(n));
    if (adjacentPlants.length > 0 && this.rng.chance(0.8)) {
      const plantCell = this.rng.pick(adjacentPlants);
      this.plants.delete(plantCell);
      this.world.nutrients[plantCell] = clamp(
        this.world.nutrients[plantCell] + 50,
        0,
        300,
      );
      herbivore.energy += 5;
    }

    if (herbivore.energy >= 10 && herbivore.cooldown <= 0) {
      const spawnCell = this.findSpawnCell(herbivore.cell, occupied);
      if (spawnCell >= 0) {
        herbivore.energy -= 3;
        herbivore.cooldown = 5;
        const child = this.createInsect('herbivore', spawnCell, 5);
        this.herbivores.push(child);
        occupied.add(spawnCell);
      }
    }
  }

  runCarnivoreTurn(carnivore, occupied) {
    let attackUsed = false;
    let chaseUsed = false;

    const adjacentHerbivores = this.herbivores.filter(
      (h) => h.alive && this.world.neighbors4(carnivore.cell).includes(h.cell),
    );

    if (adjacentHerbivores.length > 0 && carnivore.ap >= 3 && !attackUsed) {
      attackUsed = true;
      carnivore.ap -= 3;
      const prey = this.rng.pick(adjacentHerbivores);

      if (this.rng.chance(0.2)) {
        prey.energy -= 1;
        this.fleeFrom(prey, carnivore.cell, occupied);
        if (!chaseUsed) {
          chaseUsed = true;
          this.moveToward(carnivore, prey.cell, occupied, true);
        }
      } else {
        prey.energy -= 2;
        if (prey.energy <= 0) {
          prey.alive = false;
          occupied.delete(prey.cell);
          this.world.nutrients[prey.cell] = clamp(
            this.world.nutrients[prey.cell] + 20,
            0,
            300,
          );
          carnivore.energy += 5;
          carnivore.ap = clamp(carnivore.ap + 5, 0, 10);
        }
      }
    }

    if (!attackUsed) {
      const targetHerbivore = this.findNearestEntity(
        carnivore.cell,
        this.herbivores,
        2,
      );
      if (targetHerbivore) {
        this.moveToward(carnivore, targetHerbivore.cell, occupied, true);
      } else {
        this.moveRandom(carnivore, occupied, true);
      }
    }

    const adjacentCarnivores = this.carnivores.filter(
      (c) =>
        c.alive &&
        c.id !== carnivore.id &&
        this.world.neighbors4(carnivore.cell).includes(c.cell),
    );

    if (!attackUsed && adjacentCarnivores.length > 0 && carnivore.ap >= 3) {
      attackUsed = true;
      const rival = this.rng.pick(adjacentCarnivores);
      carnivore.ap -= 3;
      if (rival.ap >= 3) {
        rival.ap -= 3;
      }
      carnivore.energy -= 2;
      rival.energy -= 2;
      if (rival.energy <= 0) {
        rival.alive = false;
        rival.ap = 0;
        occupied.delete(rival.cell);
        this.world.nutrients[rival.cell] = clamp(
          this.world.nutrients[rival.cell] + 20,
          0,
          300,
        );
        carnivore.energy += 5;
        carnivore.ap = clamp(carnivore.ap + 5, 0, 10);
      }
    }

    if (carnivore.energy >= 15 && carnivore.cooldown <= 0) {
      const spawnCell = this.findSpawnCell(carnivore.cell, occupied);
      if (spawnCell >= 0) {
        carnivore.energy -= 5;
        carnivore.cooldown = 5;
        carnivore.ap = 0;
        const child = this.createInsect('carnivore', spawnCell, 7);
        this.carnivores.push(child);
        occupied.add(spawnCell);
      }
    }
  }

  findNearestPlant(originCell, radius) {
    const origin = this.world.coords(originCell);
    let nearest = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const cell of this.plants.keys()) {
      const pos = this.world.coords(cell);
      const distance = Math.abs(pos.x - origin.x) + Math.abs(pos.y - origin.y);
      if (distance <= radius && distance < bestDistance) {
        bestDistance = distance;
        nearest = cell;
      }
    }

    return nearest;
  }

  findNearestEntity(originCell, list, radius) {
    const origin = this.world.coords(originCell);
    let nearest = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < list.length; i += 1) {
      const entity = list[i];
      if (!entity.alive) continue;
      const pos = this.world.coords(entity.cell);
      const distance = Math.abs(pos.x - origin.x) + Math.abs(pos.y - origin.y);
      if (distance <= radius && distance < bestDistance) {
        bestDistance = distance;
        nearest = entity;
      }
    }

    return nearest;
  }

  moveToward(entity, targetCell, occupied, isCarnivore) {
    const current = this.world.coords(entity.cell);
    const target = this.world.coords(targetCell);

    const options = this.world
      .neighbors4(entity.cell)
      .filter((n) => this.world.isWalkable(n) && !occupied.has(n));

    if (!options.length) {
      return false;
    }

    options.sort((a, b) => {
      const pa = this.world.coords(a);
      const pb = this.world.coords(b);
      const da = Math.abs(pa.x - target.x) + Math.abs(pa.y - target.y);
      const db = Math.abs(pb.x - target.x) + Math.abs(pb.y - target.y);
      return da - db;
    });

    const chosen = options[0];
    if (chosen === entity.cell) {
      return false;
    }

    return this.tryMove(entity, chosen, occupied, isCarnivore);
  }

  moveRandom(entity, occupied, isCarnivore) {
    const options = this.world
      .neighbors4(entity.cell)
      .filter((n) => this.world.isWalkable(n) && !occupied.has(n));

    if (!options.length) {
      return false;
    }

    return this.tryMove(entity, this.rng.pick(options), occupied, isCarnivore);
  }

  tryMove(entity, targetCell, occupied, isCarnivore) {
    const terrain = this.world.terrain[targetCell];
    const stepCost = terrain === TERRAIN.SAND ? 2 : 1;

    if (entity.stepCharge < stepCost) {
      return false;
    }

    occupied.delete(entity.cell);
    entity.cell = targetCell;
    occupied.add(entity.cell);

    entity.stepCharge -= stepCost;
    entity.energy -= 1;

    if (isCarnivore && terrain === TERRAIN.SAND) {
      entity.ap = clamp(entity.ap - 1, 0, 10);
    }

    return true;
  }

  fleeFrom(prey, predatorCell, occupied) {
    const predator = this.world.coords(predatorCell);
    const options = this.world
      .neighbors4(prey.cell)
      .filter((n) => this.world.isWalkable(n) && !occupied.has(n));

    if (!options.length) {
      return;
    }

    options.sort((a, b) => {
      const pa = this.world.coords(a);
      const pb = this.world.coords(b);
      const da = Math.abs(pa.x - predator.x) + Math.abs(pa.y - predator.y);
      const db = Math.abs(pb.x - predator.x) + Math.abs(pb.y - predator.y);
      return db - da;
    });

    occupied.delete(prey.cell);
    prey.cell = options[0];
    occupied.add(prey.cell);
  }

  findSpawnCell(parentCell, occupied) {
    const options = this.world
      .neighbors4(parentCell)
      .filter((n) => this.world.isWalkable(n) && !occupied.has(n));
    return options.length ? this.rng.pick(options) : -1;
  }

  cleanupDead() {
    this.herbivores = this.herbivores.filter((h) => h.alive);
    this.carnivores = this.carnivores.filter((c) => c.alive);
  }

  evaluateOutcome() {
    const livePlants = this.plants.size;
    const liveHerbivores = this.herbivores.filter((h) => h.alive).length;
    const liveCarnivores = this.carnivores.filter((c) => c.alive).length;
    const insects = liveHerbivores + liveCarnivores;

    let hasDrinkable = false;
    for (let i = 0; i < this.world.length; i += 1) {
      if (this.world.water[i] > 1) {
        hasDrinkable = true;
        break;
      }
    }

    this.lowO2Ticks = this.o2 < 10 ? this.lowO2Ticks + 1 : 0;
    this.highCO2Ticks = this.co2 > 90 ? this.highCO2Ticks + 1 : 0;
    this.lowWaterTicks = hasDrinkable ? 0 : this.lowWaterTicks + 1;

    if (this.lowO2Ticks >= 3) {
      this.outcome = { type: 'lose', reason: 'o2 below 10 for 3 ticks' };
      return;
    }

    if (this.highCO2Ticks >= 3) {
      this.outcome = { type: 'lose', reason: 'co2 above 90 for 3 ticks' };
      return;
    }

    if (this.lowWaterTicks >= 3) {
      this.outcome = { type: 'lose', reason: 'no drinkable water for 3 ticks' };
      return;
    }

    if (livePlants === 0) {
      this.outcome = { type: 'lose', reason: 'all plants died' };
      return;
    }

    if (insects === 0) {
      this.outcome = { type: 'lose', reason: 'all insects died' };
    }
  }
}

function runSimulation(config) {
  const simulator = new Simulator(config);
  return simulator.run();
}

module.exports = {
  runSimulation,
};
