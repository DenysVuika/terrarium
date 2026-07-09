import type { SimulationConfig } from './config.ts';
import { createRng, type Rng } from './rng.ts';
import { TERRAIN, World } from './world.ts';

type InsectKind = 'herbivore' | 'carnivore';
type InsectStage = 'egg' | 'larva' | 'adult';

interface Plant {
  cell: number;
  growth: number;
  wilted: boolean;
  recoverTicks: number;
  stressTicks: number;
}

interface Insect {
  id: string;
  kind: InsectKind;
  cell: number;
  lastCell: number;
  age: number;
  stage: InsectStage;
  stageTicks: number;
  energy: number;
  starvationTicks: number;
  cooldown: number;
  stepCharge: number;
  alive: boolean;
  ap: number;
}

interface TickStats {
  herbivoreBirths: number;
  carnivoreBirths: number;
  herbivoreDeaths: number;
  carnivoreDeaths: number;
  herbivoreKillsByCarnivores: number;
  carnivoreKillsByCarnivores: number;
}

export interface Snapshot {
  tick: number;
  day: boolean;
  light: number;
  o2: number;
  co2: number;
  plants: number;
  herbivores: number;
  carnivores: number;
  eggs: number;
  insects: number;
  avgWater: number;
  drinkableCells: number;
}

export interface ReplayFrame extends Omit<Snapshot, 'plants' | 'herbivores' | 'carnivores'> {
  plants: number[];
  herbivores: number[];
  carnivores: number[];
  insectEggs: number[];
  events: string[];
}

export interface ReplayPayload {
  version: number;
  generatedAt: string;
  size: number;
  terrain: number[];
  frames: ReplayFrame[];
}

export interface Outcome {
  type: 'win' | 'lose';
  reason: string;
}

interface RunOptions {
  captureFrames?: boolean;
}

export interface SimulationResult {
  config: SimulationConfig;
  outcome: Outcome;
  finalTick: number;
  initialState: Snapshot;
  finalState: Snapshot;
  history: Snapshot[];
  diagnostics: TickStats;
  replay: ReplayPayload | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stageFromGrowth(growth: number): 'seed' | 'sprout' | 'mature' {
  if (growth < 20) return 'seed';
  if (growth < 80) return 'sprout';
  return 'mature';
}

function nutrientDrainByGrowth(growth: number): number {
  if (growth < 20) return 0.2;
  if (growth < 80) return 0.5;
  return 1;
}

class Simulator {
  config: SimulationConfig;
  rng: Rng;
  world: World;
  tick: number;
  day: boolean;
  phaseTicksElapsed: number;
  o2: number;
  co2: number;
  lowO2Ticks: number;
  highCO2Ticks: number;
  lowWaterTicks: number;
  plants: Map<number, Plant>;
  herbivores: Insect[];
  carnivores: Insect[];
  entityId: number;
  history: Snapshot[];
  outcome: Outcome | null;
  currentTickEvents: string[];
  tickStats: TickStats;
  totalStats: TickStats;

  constructor(config: SimulationConfig) {
    this.config = config;
    this.rng = createRng(config.seed);
    this.world = new World(config.size, this.rng);

    this.tick = 0;
    this.day = true;
    this.phaseTicksElapsed = 0;

    this.o2 = 100;
    this.co2 = 50;

    this.lowO2Ticks = 0;
    this.highCO2Ticks = 0;
    this.lowWaterTicks = 0;

    this.plants = new Map<number, Plant>();
    this.herbivores = [];
    this.carnivores = [];
    this.entityId = 0;

    this.history = [];
    this.outcome = null;
    this.currentTickEvents = [];
    this.tickStats = this.createTickStats();
    this.totalStats = this.createTickStats();

    this.seedInitialPopulation();
  }

  nextId(prefix: string): string {
    this.entityId += 1;
    return `${prefix}-${this.entityId}`;
  }

  seedInitialPopulation(): void {
    for (let index = 0; index < this.config.initialPlants; index += 1) {
      const cell = this.world.randomCell(
        (candidate) => this.world.isSoil(candidate) && !this.plants.has(candidate),
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

    for (let index = 0; index < this.config.initialHerbivores; index += 1) {
      const cell = this.world.randomCell(
        (candidate) => this.world.isWalkable(candidate) && !this.isOccupied(candidate),
      );
      if (cell >= 0) {
        this.herbivores.push(
          this.createInsect('herbivore', cell, this.rng.int(6, 12)),
        );
      }
    }

    for (let index = 0; index < this.config.initialCarnivores; index += 1) {
      const cell = this.world.randomCell(
        (candidate) => this.world.isWalkable(candidate) && !this.isOccupied(candidate),
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

  createInsect(kind: InsectKind, cell: number, energy: number): Insect {
    return {
      id: this.nextId(kind[0]),
      kind,
      cell,
      lastCell: -1,
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

  isOccupied(cell: number): boolean {
    for (let index = 0; index < this.herbivores.length; index += 1) {
      if (this.herbivores[index].alive && this.herbivores[index].cell === cell) {
        return true;
      }
    }
    for (let index = 0; index < this.carnivores.length; index += 1) {
      if (this.carnivores[index].alive && this.carnivores[index].cell === cell) {
        return true;
      }
    }
    return false;
  }

  run(options: RunOptions = {}): SimulationResult {
    const captureFrames = Boolean(options.captureFrames);
    const initialState = this.snapshot();
    const frames = captureFrames ? [this.buildReplayFrame(initialState)] : null;

    while (!this.outcome && this.tick < this.config.ticks) {
      this.step();
      if (captureFrames && frames) {
        frames.push(this.buildReplayFrame(this.history[this.history.length - 1]));
      }
    }

    if (!this.outcome && this.tick >= this.config.ticks) {
      this.outcome = {
        type: 'win',
        reason: `survived ${this.config.ticks} ticks`,
      };
    }

    return {
      config: this.config,
      outcome: this.outcome!,
      finalTick: this.tick,
      initialState,
      finalState: this.snapshot(),
      history: this.history,
      diagnostics: {
        herbivoreBirths: this.totalStats.herbivoreBirths,
        carnivoreBirths: this.totalStats.carnivoreBirths,
        herbivoreDeaths: this.totalStats.herbivoreDeaths,
        carnivoreDeaths: this.totalStats.carnivoreDeaths,
        herbivoreKillsByCarnivores: this.totalStats.herbivoreKillsByCarnivores,
        carnivoreKillsByCarnivores: this.totalStats.carnivoreKillsByCarnivores,
      },
      replay: captureFrames && frames
        ? {
            version: 1,
            generatedAt: new Date().toISOString(),
            size: this.world.size,
            terrain: Array.from(this.world.terrain),
            frames,
          }
        : null,
    };
  }

  buildReplayFrame(snapshot: Snapshot): ReplayFrame {
    const herbivores: number[] = [];
    const carnivores: number[] = [];
    const insectEggs: number[] = [];

    for (let index = 0; index < this.herbivores.length; index += 1) {
      if (this.herbivores[index].alive) {
        const herbivore = this.herbivores[index];
        herbivores.push(herbivore.cell);
        if (herbivore.stage === 'egg') {
          insectEggs.push(herbivore.cell);
        }
      }
    }

    for (let index = 0; index < this.carnivores.length; index += 1) {
      if (this.carnivores[index].alive) {
        const carnivore = this.carnivores[index];
        carnivores.push(carnivore.cell);
        if (carnivore.stage === 'egg') {
          insectEggs.push(carnivore.cell);
        }
      }
    }

    return {
      ...snapshot,
      plants: Array.from(this.plants.keys()),
      herbivores,
      carnivores,
      insectEggs,
      events: this.currentTickEvents.slice(0, 12),
    };
  }

  addEvent(message: string): void {
    if (this.currentTickEvents.length < 20) {
      this.currentTickEvents.push(message);
    }
  }

  createTickStats(): TickStats {
    return {
      herbivoreBirths: 0,
      carnivoreBirths: 0,
      herbivoreDeaths: 0,
      carnivoreDeaths: 0,
      herbivoreKillsByCarnivores: 0,
      carnivoreKillsByCarnivores: 0,
    };
  }

  getCurrentLight(): number {
    return this.day ? (this.config.lidOpen ? 100 : 50) : 0;
  }

  advanceDayNightPhase(): void {
    const phaseLength = this.day
      ? this.config.dayTicks
      : this.config.nightTicks;
    const safePhaseLength = Math.max(1, Number(phaseLength) || 1);
    this.phaseTicksElapsed += 1;

    if (this.phaseTicksElapsed >= safePhaseLength) {
      this.day = !this.day;
      this.phaseTicksElapsed = 0;
    }
  }

  step(): void {
    this.tick += 1;
    this.currentTickEvents = [];
    this.tickStats = this.createTickStats();

    const light = this.getCurrentLight();
    this.addEvent(`cycle: ${this.day ? 'day' : 'night'} light=${light}`);

    this.processWeatherAndCellResources();
    this.updateGlobalGases(light);
    this.processPlants(light);
    this.processInsects();
    this.cleanupDead();
    this.evaluateOutcome();

    this.history.push(this.snapshot());
    this.advanceDayNightPhase();
  }

  snapshot(): Snapshot {
    const plantCount = this.plants.size;
    const herbivoreCount = this.herbivores.filter((herbivore) => herbivore.alive).length;
    const carnivoreCount = this.carnivores.filter((carnivore) => carnivore.alive).length;
    const eggCount =
      this.herbivores.filter((herbivore) => herbivore.alive && herbivore.stage === 'egg').length +
      this.carnivores.filter((carnivore) => carnivore.alive && carnivore.stage === 'egg').length;

    let totalWater = 0;
    let drinkableCells = 0;
    for (let index = 0; index < this.world.length; index += 1) {
      const water = this.world.water[index];
      totalWater += water;
      if (water > 1) {
        drinkableCells += 1;
      }
    }

    return {
      tick: this.tick,
      day: this.day,
      light: this.getCurrentLight(),
      o2: Number(this.o2.toFixed(2)),
      co2: Number(this.co2.toFixed(2)),
      plants: plantCount,
      herbivores: herbivoreCount,
      carnivores: carnivoreCount,
      eggs: eggCount,
      insects: herbivoreCount + carnivoreCount,
      avgWater: Number((totalWater / this.world.length).toFixed(2)),
      drinkableCells,
    };
  }

  processWeatherAndCellResources(): void {
    let rainEvents = 0;
    let droughtEvents = 0;

    for (let index = 0; index < this.world.length; index += 1) {
      if (this.rng.chance(this.config.rainChance)) {
        this.world.water[index] += this.config.rainAmount;
        rainEvents += 1;
      }
      if (this.rng.chance(this.config.droughtChance)) {
        this.world.water[index] -= this.config.droughtAmount;
        droughtEvents += 1;
      }

      if (this.config.lidOpen) {
        this.world.water[index] -= this.config.evaporationOpen;
      }

      if (this.world.terrain[index] === TERRAIN.WATER) {
        this.world.water[index] += this.config.moistureSeepageFromWater;
      } else {
        const waterNeighbors = this.world
          .neighbors4(index)
          .filter((neighbor) => this.world.terrain[neighbor] === TERRAIN.WATER).length;
        if (waterNeighbors > 0) {
          this.world.water[index] +=
            waterNeighbors * this.config.moistureSeepageFromAdjacentWater;
        }
      }

      if (this.world.terrain[index] === TERRAIN.SOIL) {
        this.world.nutrients[index] += 0.1;
      }

      this.world.water[index] = clamp(this.world.water[index], 0, 100);
      this.world.nutrients[index] = clamp(this.world.nutrients[index], 0, 300);
    }

    if (rainEvents > 0) {
      this.addEvent(`weather: rain cells=${rainEvents}`);
    }
    if (droughtEvents > 0) {
      this.addEvent(`weather: drought cells=${droughtEvents}`);
    }
  }

  updateGlobalGases(light: number): void {
    const plantCount = this.plants.size;
    const insects =
      this.herbivores.filter((herbivore) => herbivore.alive).length +
      this.carnivores.filter((carnivore) => carnivore.alive).length;

    const photosynthesisFactor = light >= 50 ? light / 100 : 0;
    const scaledPlantFlux = 2 * (plantCount / 10) * photosynthesisFactor;
    const scaledInsectFlux = 1 * (insects / 10);

    this.o2 += (scaledPlantFlux - scaledInsectFlux) * this.config.gasFluxScale;
    this.co2 +=
      (-1 * (plantCount / 10) * photosynthesisFactor + scaledInsectFlux) *
      this.config.gasFluxScale;

    this.o2 += (50 - this.o2) * this.config.gasMidpointPull;
    this.co2 += (50 - this.co2) * this.config.gasMidpointPull;

    this.o2 = clamp(this.o2, 0, 100);
    this.co2 = clamp(this.co2, 0, 100);
  }

  processPlants(light: number): void {
    const toRemove: number[] = [];
    const toAdd: Plant[] = [];
    const co2Penalty = this.co2 > 90 ? 0.5 : 1;

    for (const [cell, plant] of this.plants.entries()) {
      const drain = nutrientDrainByGrowth(plant.growth);
      this.world.nutrients[cell] = clamp(this.world.nutrients[cell] - drain, 0, 300);

      const hasResources =
        this.world.water[cell] > 30 && this.world.nutrients[cell] > 20;
      const conditionsGood = light >= 50 && hasResources;

      if (conditionsGood) {
        plant.growth = clamp(plant.growth + 1 * co2Penalty, 0, 100);
        if (plant.wilted) {
          plant.recoverTicks += 1;
          if (plant.recoverTicks >= 3) {
            plant.wilted = false;
            plant.recoverTicks = 0;
          }
        }
      } else if (light === 0 && hasResources) {
        plant.growth = clamp(plant.growth - this.config.plantNightShrink, 0, 100);
        plant.recoverTicks = 0;
      } else {
        if (plant.growth < 10) {
          toRemove.push(cell);
          continue;
        }

        plant.growth = clamp(plant.growth - this.config.plantStressShrink, 0, 100);
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
          .filter((neighbor) => this.world.isSoil(neighbor) && !this.plants.has(neighbor));

        if (options.length > 0) {
          const target = this.rng.pick(options);
          if (target !== null) {
            this.world.nutrients[cell] = clamp(this.world.nutrients[cell] - 10, 0, 300);
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
    }

    for (let index = 0; index < toRemove.length; index += 1) {
      const cell = toRemove[index];
      this.plants.delete(cell);
      this.world.nutrients[cell] = clamp(this.world.nutrients[cell] + 50, 0, 300);
    }

    if (toAdd.length > 0) {
      this.addEvent(`plants: born=${toAdd.length}`);
    }
    if (toRemove.length > 0) {
      this.addEvent(`plants: died=${toRemove.length}`);
    }

    for (let index = 0; index < toAdd.length; index += 1) {
      if (!this.plants.has(toAdd[index].cell)) {
        this.plants.set(toAdd[index].cell, toAdd[index]);
      }
    }
  }

  processInsects(): void {
    const occupied = new Set<number>();
    for (let index = 0; index < this.herbivores.length; index += 1) {
      if (this.herbivores[index].alive) occupied.add(this.herbivores[index].cell);
    }
    for (let index = 0; index < this.carnivores.length; index += 1) {
      if (this.carnivores[index].alive) occupied.add(this.carnivores[index].cell);
    }

    for (let index = 0; index < this.herbivores.length; index += 1) {
      const herbivore = this.herbivores[index];
      if (!herbivore.alive) continue;
      this.updateInsectLifecycle(herbivore, occupied, false);
      if (!herbivore.alive || herbivore.stage !== 'adult') continue;
      this.runHerbivoreTurn(herbivore, occupied);
    }

    for (let index = 0; index < this.carnivores.length; index += 1) {
      const carnivore = this.carnivores[index];
      if (!carnivore.alive) continue;
      this.updateInsectLifecycle(carnivore, occupied, true);
      if (!carnivore.alive || carnivore.stage !== 'adult') continue;
      this.runCarnivoreTurn(carnivore, occupied);
    }

    if (this.tickStats.herbivoreBirths > 0) {
      this.addEvent(`herbivores: born=${this.tickStats.herbivoreBirths}`);
    }
    if (this.tickStats.carnivoreBirths > 0) {
      this.addEvent(`carnivores: born=${this.tickStats.carnivoreBirths}`);
    }
    if (this.tickStats.herbivoreDeaths > 0) {
      this.addEvent(`herbivores: died=${this.tickStats.herbivoreDeaths}`);
    }
    if (this.tickStats.carnivoreDeaths > 0) {
      this.addEvent(`carnivores: died=${this.tickStats.carnivoreDeaths}`);
    }
    if (this.tickStats.herbivoreKillsByCarnivores > 0) {
      this.addEvent(
        `predation: herbivore-kills=${this.tickStats.herbivoreKillsByCarnivores}`,
      );
    }
    if (this.tickStats.carnivoreKillsByCarnivores > 0) {
      this.addEvent(
        `combat: carnivore-kills=${this.tickStats.carnivoreKillsByCarnivores}`,
      );
    }

    this.totalStats.herbivoreBirths += this.tickStats.herbivoreBirths;
    this.totalStats.carnivoreBirths += this.tickStats.carnivoreBirths;
    this.totalStats.herbivoreDeaths += this.tickStats.herbivoreDeaths;
    this.totalStats.carnivoreDeaths += this.tickStats.carnivoreDeaths;
    this.totalStats.herbivoreKillsByCarnivores +=
      this.tickStats.herbivoreKillsByCarnivores;
    this.totalStats.carnivoreKillsByCarnivores +=
      this.tickStats.carnivoreKillsByCarnivores;
  }

  updateInsectLifecycle(
    entity: Insect,
    occupied: Set<number>,
    isCarnivore: boolean,
  ): void {
    entity.age += 1;
    entity.stageTicks += 1;
    const baseMetabolism = isCarnivore
      ? this.config.carnivoreMetabolismPerTick
      : this.config.herbivoreMetabolismPerTick;
    const metabolismMultiplier = this.day ? 1 : this.config.nightMetabolismMultiplier;
    entity.energy -= baseMetabolism * metabolismMultiplier;

    if (this.o2 < 10) {
      entity.energy -= 1;
    }

    if (entity.cooldown > 0) {
      entity.cooldown -= 1;
    }

    entity.stepCharge = clamp(
      entity.stepCharge + this.config.insectStepChargePerTick,
      0,
      2.5,
    );

    if (isCarnivore) {
      entity.ap = clamp(entity.ap + this.config.carnivoreApRegenPerTick, 0, 10);
    }

    const eggStageTicks = isCarnivore
      ? this.config.carnivoreEggStageTicks
      : this.config.eggStageTicks;
    const larvaStageTicks = isCarnivore
      ? this.config.carnivoreLarvaStageTicks
      : this.config.larvaStageTicks;

    if (entity.stage === 'egg' && entity.stageTicks >= eggStageTicks) {
      entity.stage = 'larva';
      entity.stageTicks = 0;
    } else if (entity.stage === 'larva' && entity.stageTicks >= larvaStageTicks) {
      entity.stage = 'adult';
      entity.stageTicks = 0;
    }

    const hasNearbyWater = this.world
      .neighbors8(entity.cell)
      .some((neighbor) => this.world.water[neighbor] >= this.config.insectDrinkAmount);

    if (hasNearbyWater) {
      const waterSources = this.world
        .neighbors8(entity.cell)
        .filter((neighbor) => this.world.water[neighbor] >= this.config.insectDrinkAmount);
      const drinkCell = this.rng.pick(waterSources);
      if (drinkCell !== null) {
        this.world.water[drinkCell] = clamp(
          this.world.water[drinkCell] - this.config.insectDrinkAmount,
          0,
          100,
        );
      }
    } else {
      entity.energy -= isCarnivore
        ? this.config.carnivoreDehydrationPenalty
        : this.config.herbivoreDehydrationPenalty;
    }

    if (entity.energy <= 0) {
      entity.starvationTicks += 1;
    } else {
      entity.starvationTicks = 0;
    }

    const maxAge = isCarnivore
      ? this.config.carnivoreMaxAge
      : this.config.herbivoreMaxAge;
    const starvationLimit = isCarnivore
      ? this.config.carnivoreStarvationTicks
      : this.config.herbivoreStarvationTicks;
    if (entity.starvationTicks >= starvationLimit || entity.age >= maxAge) {
      entity.alive = false;
      occupied.delete(entity.cell);
      this.world.nutrients[entity.cell] = clamp(
        this.world.nutrients[entity.cell] + 20,
        0,
        300,
      );
      if (isCarnivore) {
        entity.ap = 0;
        this.tickStats.carnivoreDeaths += 1;
      } else {
        this.tickStats.herbivoreDeaths += 1;
      }
    }
  }

  runHerbivoreTurn(herbivore: Insect, occupied: Set<number>): void {
    const targetPlant = this.findNearestPlant(herbivore.cell, 2);
    if (targetPlant >= 0) {
      this.moveToward(herbivore, targetPlant, occupied, false);
    } else {
      this.moveRandom(herbivore, occupied, false);
    }

    const consumablePlants = [herbivore.cell]
      .concat(this.world.neighbors8(herbivore.cell))
      .filter((cell, index, cells) => cells.indexOf(cell) === index)
      .filter((cell) => this.plants.has(cell));

    if (consumablePlants.length > 0 && this.rng.chance(0.8)) {
      const plantCell = this.rng.pick(consumablePlants);
      if (plantCell !== null) {
        this.plants.delete(plantCell);
        this.world.nutrients[plantCell] = clamp(this.world.nutrients[plantCell] + 50, 0, 300);
        herbivore.energy += 5;
      }
    }

    const localHerbivores = this.world
      .neighbors8(herbivore.cell)
      .filter((cell) =>
        this.herbivores.some(
          (other) => other.alive && other.cell === cell && other.id !== herbivore.id,
        ),
      ).length;
    const liveHerbivores = this.herbivores.filter((entity) => entity.alive).length;
    const herbivoreGlobalCap = Math.max(
      1,
      Math.floor(this.plants.size * this.config.herbivorePopulationCapPerPlant),
    );

    if (
      herbivore.energy >= this.config.herbivoreBreedEnergyMin &&
      herbivore.cooldown <= 0 &&
      localHerbivores < this.config.herbivoreBreedLocalCap &&
      liveHerbivores < herbivoreGlobalCap &&
      this.rng.chance(this.config.herbivoreBreedChance)
    ) {
      const spawnCell = this.findSpawnCell(herbivore.cell, occupied);
      if (spawnCell >= 0) {
        herbivore.energy -= this.config.herbivoreBreedEnergyCost;
        herbivore.cooldown = this.config.herbivoreBreedCooldown;
        const child = this.createInsect('herbivore', spawnCell, 5);
        this.herbivores.push(child);
        occupied.add(spawnCell);
        this.tickStats.herbivoreBirths += 1;
      }
    }
  }

  runCarnivoreTurn(carnivore: Insect, occupied: Set<number>): void {
    let attackUsed = false;
    let chaseUsed = false;

    const adjacentHerbivores = this.herbivores.filter(
      (herbivore) =>
        herbivore.alive && this.world.neighbors8(carnivore.cell).includes(herbivore.cell),
    );

    if (adjacentHerbivores.length > 0 && carnivore.ap >= 3 && !attackUsed) {
      attackUsed = true;
      carnivore.ap -= 3;
      const prey = this.rng.pick(adjacentHerbivores);

      if (prey && this.rng.chance(this.config.carnivorePreyFleeChance)) {
        prey.energy -= 1;
        this.fleeFrom(prey, carnivore.cell, occupied);
        if (!chaseUsed) {
          chaseUsed = true;
          this.moveToward(carnivore, prey.cell, occupied, true);
        }
      } else if (prey) {
        prey.energy -= this.config.carnivoreAttackDamage;
        if (prey.energy <= 0) {
          prey.alive = false;
          occupied.delete(prey.cell);
          this.world.nutrients[prey.cell] = clamp(this.world.nutrients[prey.cell] + 20, 0, 300);
          carnivore.energy += this.config.carnivoreKillEnergyGain;
          carnivore.ap = clamp(carnivore.ap + 5, 0, 10);
          this.tickStats.herbivoreDeaths += 1;
          this.tickStats.herbivoreKillsByCarnivores += 1;
        }
      }
    }

    if (!attackUsed) {
      const targetHerbivore = this.findNearestEntity(
        carnivore.cell,
        this.herbivores,
        this.config.carnivoreHuntRadius,
      );
      if (targetHerbivore) {
        this.moveToward(carnivore, targetHerbivore.cell, occupied, true);
      } else if (this.rng.chance(this.config.carnivoreRestChanceNoPrey)) {
        carnivore.energy += this.config.carnivoreRestEnergyRecovery;
      } else {
        this.moveRandom(carnivore, occupied, true);
      }
    }

    const adjacentCarnivores = this.carnivores.filter(
      (other) =>
        other.alive &&
        other.id !== carnivore.id &&
        this.world.neighbors8(carnivore.cell).includes(other.cell),
    );

    if (
      !attackUsed &&
      adjacentCarnivores.length > 0 &&
      carnivore.ap >= 3 &&
      carnivore.energy >= this.config.carnivoreRivalFightEnergyMin &&
      this.rng.chance(this.config.carnivoreRivalFightChance)
    ) {
      attackUsed = true;
      const rival = this.rng.pick(adjacentCarnivores);
      if (rival) {
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
          this.world.nutrients[rival.cell] = clamp(this.world.nutrients[rival.cell] + 20, 0, 300);
          carnivore.energy += 5;
          carnivore.ap = clamp(carnivore.ap + 5, 0, 10);
          this.tickStats.carnivoreDeaths += 1;
          this.tickStats.carnivoreKillsByCarnivores += 1;
        }
      }
    }

    const localCarnivores = this.world
      .neighbors8(carnivore.cell)
      .filter((cell) =>
        this.carnivores.some(
          (other) => other.alive && other.cell === cell && other.id !== carnivore.id,
        ),
      ).length;
    const liveCarnivores = this.carnivores.filter((entity) => entity.alive).length;
    const liveHerbivores = this.herbivores.filter((entity) => entity.alive).length;
    const carnivoreGlobalCap = Math.max(
      1,
      Math.floor(liveHerbivores * this.config.carnivorePopulationCapPerHerbivore),
    );

    if (
      carnivore.energy >= this.config.carnivoreBreedEnergyMin &&
      carnivore.cooldown <= 0 &&
      localCarnivores < this.config.carnivoreBreedLocalCap &&
      liveCarnivores < carnivoreGlobalCap &&
      this.rng.chance(this.config.carnivoreBreedChance)
    ) {
      const spawnCell = this.findSpawnCell(carnivore.cell, occupied);
      if (spawnCell >= 0) {
        carnivore.energy -= this.config.carnivoreBreedEnergyCost;
        carnivore.cooldown = this.config.carnivoreBreedCooldown;
        carnivore.ap = 0;
        const child = this.createInsect('carnivore', spawnCell, 7);
        this.carnivores.push(child);
        occupied.add(spawnCell);
        this.tickStats.carnivoreBirths += 1;
      }
    }
  }

  findNearestPlant(originCell: number, radius: number): number {
    const origin = this.world.coords(originCell);
    let nearest = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const cell of this.plants.keys()) {
      const position = this.world.coords(cell);
      const distance = Math.abs(position.x - origin.x) + Math.abs(position.y - origin.y);
      if (distance <= radius && distance < bestDistance) {
        bestDistance = distance;
        nearest = cell;
      }
    }

    return nearest;
  }

  findNearestEntity(originCell: number, list: Insect[], radius: number): Insect | null {
    const origin = this.world.coords(originCell);
    let nearest: Insect | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < list.length; index += 1) {
      const entity = list[index];
      if (!entity.alive) continue;
      const position = this.world.coords(entity.cell);
      const distance = Math.abs(position.x - origin.x) + Math.abs(position.y - origin.y);
      if (distance <= radius && distance < bestDistance) {
        bestDistance = distance;
        nearest = entity;
      }
    }

    return nearest;
  }

  moveToward(
    entity: Insect,
    targetCell: number,
    occupied: Set<number>,
    isCarnivore: boolean,
  ): boolean {
    const target = this.world.coords(targetCell);

    const options = this.world
      .neighbors8(entity.cell)
      .filter((cell) => this.world.isWalkable(cell) && !occupied.has(cell));

    if (!options.length) {
      return false;
    }

    options.sort((left, right) => {
      const leftPosition = this.world.coords(left);
      const rightPosition = this.world.coords(right);
      let leftDistance = Math.abs(leftPosition.x - target.x) + Math.abs(leftPosition.y - target.y);
      let rightDistance = Math.abs(rightPosition.x - target.x) + Math.abs(rightPosition.y - target.y);

      if (entity.lastCell >= 0 && left === entity.lastCell) {
        leftDistance += 0.35;
      }
      if (entity.lastCell >= 0 && right === entity.lastCell) {
        rightDistance += 0.35;
      }

      leftDistance += this.rng.next() * 0.05;
      rightDistance += this.rng.next() * 0.05;
      return leftDistance - rightDistance;
    });

    const chosen = options[0];
    if (chosen === entity.cell) {
      return false;
    }

    return this.tryMove(entity, chosen, occupied, isCarnivore);
  }

  moveRandom(entity: Insect, occupied: Set<number>, isCarnivore: boolean): boolean {
    const options = this.world
      .neighbors8(entity.cell)
      .filter((cell) => this.world.isWalkable(cell) && !occupied.has(cell));

    if (!options.length) {
      return false;
    }

    let bestScore = Number.NEGATIVE_INFINITY;
    let bestCell = options[0];

    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      let score = this.rng.next();

      score += this.world.water[option] * 0.02;

      if (entity.lastCell >= 0 && option === entity.lastCell) {
        score -= 2;
      }

      if (!isCarnivore) {
        const nearbyPlants = this.world
          .neighbors8(option)
          .filter((cell) => this.plants.has(cell)).length;
        score += nearbyPlants * 0.7;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCell = option;
      }
    }

    return this.tryMove(entity, bestCell, occupied, isCarnivore);
  }

  tryMove(
    entity: Insect,
    targetCell: number,
    occupied: Set<number>,
    isCarnivore: boolean,
  ): boolean {
    const terrain = this.world.terrain[targetCell];
    const stepCost = terrain === TERRAIN.SAND ? this.config.sandStepCost : 1;

    if (entity.stepCharge < stepCost) {
      return false;
    }

    const previousCell = entity.cell;
    occupied.delete(entity.cell);
    entity.cell = targetCell;
    entity.lastCell = previousCell;
    occupied.add(entity.cell);

    entity.stepCharge -= stepCost;
    entity.energy -= isCarnivore
      ? this.config.carnivoreMoveEnergyCost
      : this.config.herbivoreMoveEnergyCost;

    if (isCarnivore && terrain === TERRAIN.SAND) {
      entity.ap = clamp(entity.ap - 1, 0, 10);
    }

    return true;
  }

  fleeFrom(prey: Insect, predatorCell: number, occupied: Set<number>): void {
    const predator = this.world.coords(predatorCell);
    const options = this.world
      .neighbors8(prey.cell)
      .filter((cell) => this.world.isWalkable(cell) && !occupied.has(cell));

    if (!options.length) {
      return;
    }

    options.sort((left, right) => {
      const leftPosition = this.world.coords(left);
      const rightPosition = this.world.coords(right);
      let leftDistance = Math.abs(leftPosition.x - predator.x) + Math.abs(leftPosition.y - predator.y);
      let rightDistance = Math.abs(rightPosition.x - predator.x) + Math.abs(rightPosition.y - predator.y);

      if (prey.lastCell >= 0 && left === prey.lastCell) {
        leftDistance -= 0.35;
      }
      if (prey.lastCell >= 0 && right === prey.lastCell) {
        rightDistance -= 0.35;
      }
      return rightDistance - leftDistance;
    });

    const previousCell = prey.cell;
    occupied.delete(prey.cell);
    prey.cell = options[0];
    prey.lastCell = previousCell;
    occupied.add(prey.cell);
  }

  findSpawnCell(parentCell: number, occupied: Set<number>): number {
    const options = this.world
      .neighbors8(parentCell)
      .filter((cell) => this.world.isWalkable(cell) && !occupied.has(cell));
    const pick = options.length ? this.rng.pick(options) : null;
    return pick ?? -1;
  }

  cleanupDead(): void {
    this.herbivores = this.herbivores.filter((entity) => entity.alive);
    this.carnivores = this.carnivores.filter((entity) => entity.alive);
  }

  evaluateOutcome(): void {
    const livePlants = this.plants.size;
    const liveHerbivores = this.herbivores.filter((entity) => entity.alive).length;
    const liveCarnivores = this.carnivores.filter((entity) => entity.alive).length;
    const insects = liveHerbivores + liveCarnivores;

    let hasDrinkable = false;
    for (let index = 0; index < this.world.length; index += 1) {
      if (this.world.water[index] > 1) {
        hasDrinkable = true;
        break;
      }
    }

    this.lowO2Ticks = this.o2 < 10 ? this.lowO2Ticks + 1 : 0;
    this.highCO2Ticks = this.co2 > 90 ? this.highCO2Ticks + 1 : 0;
    this.lowWaterTicks = hasDrinkable ? 0 : this.lowWaterTicks + 1;

    if (this.lowO2Ticks > 0) {
      this.addEvent(`warning: low-o2 streak=${this.lowO2Ticks}`);
    }
    if (this.highCO2Ticks > 0) {
      this.addEvent(`warning: high-co2 streak=${this.highCO2Ticks}`);
    }
    if (this.lowWaterTicks > 0) {
      this.addEvent(`warning: low-water streak=${this.lowWaterTicks}`);
    }

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

export function runSimulation(
  config: SimulationConfig,
  options: RunOptions = {},
): SimulationResult {
  const simulator = new Simulator(config);
  return simulator.run(options);
}