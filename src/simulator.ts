import type { SimulationConfig } from './config.ts';
import type { SimContext, TickStats } from './context.ts';
import { createRng, type Rng } from './rng.ts';
import { TERRAIN, World } from './world.ts';
import { Plant } from './entities/plant.ts';
import { Herbivore } from './entities/herbivore.ts';
import { Carnivore } from './entities/carnivore.ts';
import { EntityRepository } from './entities/repository.ts';
import { formatSimulationEvent, type SimulationEvent } from './events.ts';

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
  entities: EntityRepository;
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

    this.entities = new EntityRepository();
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
        candidate => this.world.isSoil(candidate) && !this.entities.plants.has(candidate),
      );
      if (cell >= 0) {
        this.entities.plants.set(
          cell,
          new Plant(this.nextId('p'), cell, this.rng.int(10, 95)),
        );
      }
    }

    for (let index = 0; index < this.config.initialHerbivores; index += 1) {
      const cell = this.world.randomCell(
        candidate =>
          this.world.isWalkable(candidate) &&
          !this.entities.herbivores.some((h) => h.cell === candidate) &&
          !this.entities.carnivores.some((c) => c.cell === candidate),
      );
      if (cell >= 0) {
        this.entities.herbivores.push(
          new Herbivore(this.nextId('h'), cell, this.rng.int(6, 12), this.config),
        );
      }
    }

    for (let index = 0; index < this.config.initialCarnivores; index += 1) {
      const cell = this.world.randomCell(
        candidate =>
          this.world.isWalkable(candidate) &&
            !this.entities.herbivores.some((h) => h.cell === candidate) &&
            !this.entities.carnivores.some((c) => c.cell === candidate),
      );
      if (cell >= 0) {
        const carnivore = new Carnivore(
          this.nextId('c'),
          cell,
          this.rng.int(10, 18),
          this.config,
        );
        carnivore.ap = this.rng.int(1, 6);
        this.entities.carnivores.push(carnivore);
      }
    }
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
      replay:
        captureFrames && frames
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

    for (const herbivore of this.entities.herbivores) {
      if (herbivore.alive) {
        herbivores.push(herbivore.cell);
        if (herbivore.stage === 'egg') insectEggs.push(herbivore.cell);
      }
    }
    for (const carnivore of this.entities.carnivores) {
      if (carnivore.alive) {
        carnivores.push(carnivore.cell);
        if (carnivore.stage === 'egg') insectEggs.push(carnivore.cell);
      }
    }

    return {
      ...snapshot,
      plants: Array.from(this.entities.plants.keys()),
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

  emitEvent(event: SimulationEvent): void {
    this.addEvent(formatSimulationEvent(event));
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

  countLiveHerbivores(): number {
    return this.entities.countLiveHerbivores();
  }

  countLiveCarnivores(): number {
    return this.entities.countLiveCarnivores();
  }

  countLiveInsects(): number {
    return this.entities.countLiveInsects();
  }

  getCurrentLight(): number {
    return this.day ? (this.config.lidOpen ? 100 : 50) : 0;
  }

  advanceDayNightPhase(): void {
    const phaseLength = this.day ? this.config.dayTicks : this.config.nightTicks;
    const safePhaseLength = Math.max(1, Number(phaseLength) || 1);
    this.phaseTicksElapsed += 1;

    if (this.phaseTicksElapsed >= safePhaseLength) {
      this.day = !this.day;
      this.phaseTicksElapsed = 0;
    }
  }

  // ── Main game loop step ─────────────────────────────────────────────────────

  step(): void {
    this.tick += 1;
    this.currentTickEvents = [];
    this.tickStats = this.createTickStats();

    const light = this.getCurrentLight();
    this.emitEvent({
      type: 'cycle',
      phase: this.day ? 'day' : 'night',
      light,
    });

    this.processWeatherAndCellResources();
    this.updateGlobalGases(light);

    const ctx = this.buildSimContext(light);

    this.processPlants(ctx);

    // Build occupied set just before insect ticks so movement is collision-aware
    ctx.occupied = this.entities.buildOccupiedSet();

    this.processInsects(ctx);

    this.cleanupDead();
    this.evaluateOutcome();
    this.history.push(this.snapshot());
    this.advanceDayNightPhase();
  }

  /** Create the per-tick context object shared by all entity tick() calls. */
  buildSimContext(light: number): SimContext {
    const self = this;
    return {
      world: this.world,
      config: this.config,
      rng: this.rng,
      day: this.day,
      light,
      o2: this.o2,
      co2: this.co2,
      plants: this.entities.plants,
      herbivores: this.entities.herbivores,
      carnivores: this.entities.carnivores,
      occupied: new Set<number>(),
      addEvent(msg: string) {
        self.addEvent(msg);
      },
      emitEvent(event: SimulationEvent) {
        self.emitEvent(event);
      },
      stats: this.tickStats,
      nextId(prefix: string) {
        return self.nextId(prefix);
      },
    };
  }

  processPlants(ctx: SimContext): void {
    const newPlants: Plant[] = [];
    let bornCount = 0;
    let diedCount = 0;

    for (const plant of this.entities.plants.values()) {
      const child = plant.tick(ctx);
      if (!plant.alive) diedCount += 1;
      if (child !== null) {
        newPlants.push(child);
        bornCount += 1;
      }
    }

    // Remove dead plants after iterating to avoid modifying the Map mid-loop
    for (const [cell, plant] of this.entities.plants.entries()) {
      if (!plant.alive) this.entities.plants.delete(cell);
    }

    // Add offspring (same tick, consistent with original behaviour)
    for (const child of newPlants) {
      if (!this.entities.plants.has(child.cell)) {
        this.entities.plants.set(child.cell, child);
      }
    }

    if (bornCount > 0) this.emitEvent({ type: 'plants-born', count: bornCount });
    if (diedCount > 0) this.emitEvent({ type: 'plants-died', count: diedCount });
  }

  processInsects(ctx: SimContext): void {
    // Herbivores tick first, then carnivores — index-based loops allow newly
    // spawned eggs to be appended and processed (they skip tickBehavior as eggs).
    for (let i = 0; i < this.entities.herbivores.length; i += 1) {
      if (this.entities.herbivores[i].alive) this.entities.herbivores[i].tick(ctx);
    }

    for (let i = 0; i < this.entities.carnivores.length; i += 1) {
      if (this.entities.carnivores[i].alive) this.entities.carnivores[i].tick(ctx);
    }

    // Accumulate totals and emit summary events
    this.totalStats.herbivoreBirths += ctx.stats.herbivoreBirths;
    this.totalStats.carnivoreBirths += ctx.stats.carnivoreBirths;
    this.totalStats.herbivoreDeaths += ctx.stats.herbivoreDeaths;
    this.totalStats.carnivoreDeaths += ctx.stats.carnivoreDeaths;
    this.totalStats.herbivoreKillsByCarnivores += ctx.stats.herbivoreKillsByCarnivores;
    this.totalStats.carnivoreKillsByCarnivores += ctx.stats.carnivoreKillsByCarnivores;

    if (ctx.stats.herbivoreBirths > 0)
      this.emitEvent({ type: 'herbivores-born', count: ctx.stats.herbivoreBirths });
    if (ctx.stats.carnivoreBirths > 0)
      this.emitEvent({ type: 'carnivores-born', count: ctx.stats.carnivoreBirths });
    if (ctx.stats.herbivoreDeaths > 0)
      this.emitEvent({ type: 'herbivores-died', count: ctx.stats.herbivoreDeaths });
    if (ctx.stats.carnivoreDeaths > 0)
      this.emitEvent({ type: 'carnivores-died', count: ctx.stats.carnivoreDeaths });
    if (ctx.stats.herbivoreKillsByCarnivores > 0)
      this.emitEvent({
        type: 'predation-kills',
        count: ctx.stats.herbivoreKillsByCarnivores,
      });
    if (ctx.stats.carnivoreKillsByCarnivores > 0)
      this.emitEvent({
        type: 'rival-kills',
        count: ctx.stats.carnivoreKillsByCarnivores,
      });
  }

  snapshot(): Snapshot {
    const plantCount = this.entities.plants.size;
    const herbivoreCount = this.countLiveHerbivores();
    const carnivoreCount = this.countLiveCarnivores();
    const eggCount =
      this.entities.herbivores.filter((h) => h.alive && h.stage === 'egg').length +
      this.entities.carnivores.filter((c) => c.alive && c.stage === 'egg').length;

    let totalWater = 0;
    let drinkableCells = 0;
    for (let index = 0; index < this.world.length; index += 1) {
      const water = this.world.water[index];
      totalWater += water;
      if (water > 1) drinkableCells += 1;
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
          .filter(neighbor => this.world.terrain[neighbor] === TERRAIN.WATER).length;
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

    if (rainEvents > 0) this.emitEvent({ type: 'weather-rain', cells: rainEvents });
    if (droughtEvents > 0)
      this.emitEvent({ type: 'weather-drought', cells: droughtEvents });
  }

  updateGlobalGases(light: number): void {
    const plantCount = this.entities.plants.size;
    const insects = this.countLiveInsects();

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

  cleanupDead(): void {
    this.entities.cleanupDead();
  }

  evaluateOutcome(): void {
    const livePlants = this.entities.plants.size;
    const liveHerbivores = this.countLiveHerbivores();
    const liveCarnivores = this.countLiveCarnivores();
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

    if (this.lowO2Ticks > 0)
      this.emitEvent({ type: 'warning-low-o2', streak: this.lowO2Ticks });
    if (this.highCO2Ticks > 0)
      this.emitEvent({ type: 'warning-high-co2', streak: this.highCO2Ticks });
    if (this.lowWaterTicks > 0)
      this.emitEvent({ type: 'warning-low-water', streak: this.lowWaterTicks });

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
