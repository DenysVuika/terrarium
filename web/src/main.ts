import { Application, Container, Graphics } from 'pixi.js';
import { getDefaultConfig } from '../../src/config';
import { Simulator } from '../../src/simulator';
import { TERRAIN } from '../../src/world';

type SimulationStatus = {
  tick: number;
  phase: string;
  light: number;
  plants: number;
  herbivores: number;
  carnivores: number;
  eggs: number;
  o2: number;
  co2: number;
  water: number;
  outcome: string;
  events: string;
};

class TerrariumScene {
  app: Application;
  simulator: Simulator;
  worldContainer: Container;
  terrainLayer: Graphics;
  plantLayer: Graphics;
  herbivoreLayer: Graphics;
  carnivoreLayer: Graphics;
  eggLayer: Graphics;
  size: number;
  cellSize: number;
  ticksPerSecond: number;
  running: boolean;
  elapsed: number;
  onStatus: (status: SimulationStatus) => void;

  constructor(app: Application, onStatus: (status: SimulationStatus) => void) {
    this.app = app;
    this.onStatus = onStatus;
    this.simulator = this.createSimulator();
    this.size = this.simulator.world.size;
    this.cellSize = this.computeCellSize();
    this.ticksPerSecond = 8;
    this.running = true;
    this.elapsed = 0;

    this.worldContainer = new Container();
    this.terrainLayer = new Graphics();
    this.plantLayer = new Graphics();
    this.herbivoreLayer = new Graphics();
    this.carnivoreLayer = new Graphics();
    this.eggLayer = new Graphics();

    this.worldContainer.addChild(this.terrainLayer);
    this.worldContainer.addChild(this.plantLayer);
    this.worldContainer.addChild(this.herbivoreLayer);
    this.worldContainer.addChild(this.carnivoreLayer);
    this.worldContainer.addChild(this.eggLayer);
    this.app.stage.addChild(this.worldContainer);

    this.resize();
    this.drawTerrain();
    this.drawDynamicLayers();
    this.pushStatus();

    this.app.renderer.on('resize', () => this.resize());
    this.app.ticker.add((ticker) => this.update(ticker.deltaMS / 1000));
  }

  createSimulator(): Simulator {
    const config = getDefaultConfig();
    config.world.ticks = 500;
    return new Simulator(config);
  }

  computeCellSize(): number {
    const viewportPadding = 32;
    const maxWidth = Math.max(280, window.innerWidth - viewportPadding * 2);
    const maxHeight = Math.max(280, window.innerHeight - 220);
    const maxGridPixels = Math.min(maxWidth, maxHeight);
    return Math.max(1, Math.floor(maxGridPixels / this.size));
  }

  resize(): void {
    this.cellSize = this.computeCellSize();
    const gridPixels = this.size * this.cellSize;

    this.worldContainer.position.set(
      Math.round((this.app.screen.width - gridPixels) / 2),
      Math.round((this.app.screen.height - gridPixels) / 2),
    );

    this.drawTerrain();
    this.drawDynamicLayers();
  }

  drawTerrain(): void {
    const terrain = this.simulator.world.terrain;
    const length = terrain.length;
    const soilColor = 0x536b2f;
    const waterColor = 0x2e6b9e;
    const sandColor = 0xb59f68;
    const emptyColor = 0x2d3242;

    this.terrainLayer.clear();

    for (let index = 0; index < length; index += 1) {
      const x = (index % this.size) * this.cellSize;
      const y = Math.floor(index / this.size) * this.cellSize;
      const terrainType = terrain[index];
      const color =
        terrainType === TERRAIN.SOIL
          ? soilColor
          : terrainType === TERRAIN.WATER
            ? waterColor
            : terrainType === TERRAIN.SAND
              ? sandColor
              : emptyColor;

      this.terrainLayer.rect(x, y, this.cellSize, this.cellSize);
      this.terrainLayer.fill({ color });
    }
  }

  drawPlants(cells: number[]): void {
    this.plantLayer.clear();
    const inset = Math.max(0, Math.floor(this.cellSize * 0.15));
    const size = Math.max(1, this.cellSize - inset * 2);

    for (const cell of cells) {
      const x = (cell % this.size) * this.cellSize + inset;
      const y = Math.floor(cell / this.size) * this.cellSize + inset;
      this.plantLayer.rect(x, y, size, size);
      this.plantLayer.fill({ color: 0x69d25b });
    }
  }

  drawInsects(cells: number[], color: number, layer: Graphics): void {
    layer.clear();
    const radius = Math.max(1, this.cellSize * 0.36);
    const centerOffset = this.cellSize * 0.5;

    for (const cell of cells) {
      const x = (cell % this.size) * this.cellSize + centerOffset;
      const y = Math.floor(cell / this.size) * this.cellSize + centerOffset;
      layer.circle(x, y, radius);
      layer.fill({ color });
    }
  }

  drawEggs(cells: number[]): void {
    this.eggLayer.clear();
    const radius = Math.max(1, this.cellSize * 0.18);
    const centerOffset = this.cellSize * 0.5;

    for (const cell of cells) {
      const x = (cell % this.size) * this.cellSize + centerOffset;
      const y = Math.floor(cell / this.size) * this.cellSize + centerOffset;
      this.eggLayer.circle(x, y, radius);
      this.eggLayer.fill({ color: 0xf9f3d6 });
    }
  }

  drawDynamicLayers(): void {
    const frame = this.simulator.buildReplayFrame(this.simulator.snapshot());
    this.drawPlants(frame.plants);
    this.drawInsects(frame.herbivores, 0x87ffd7, this.herbivoreLayer);
    this.drawInsects(frame.carnivores, 0xff7b6b, this.carnivoreLayer);
    this.drawEggs(frame.insectEggs);
  }

  step(): void {
    if (this.simulator.outcome) {
      this.running = false;
      return;
    }

    if (this.simulator.tick >= this.simulator.config.world.ticks) {
      this.simulator.finalizeOutcomeIfNeeded();
      this.running = false;
      this.pushStatus();
      return;
    }

    this.simulator.step();

    if (this.simulator.tick >= this.simulator.config.world.ticks) {
      this.simulator.finalizeOutcomeIfNeeded();
      this.running = false;
    }

    this.drawDynamicLayers();
    this.pushStatus();
  }

  update(deltaSeconds: number): void {
    if (!this.running) {
      return;
    }

    this.elapsed += deltaSeconds;
    const tickInterval = 1 / this.ticksPerSecond;

    while (this.elapsed >= tickInterval) {
      this.step();
      this.elapsed -= tickInterval;
      if (!this.running) {
        break;
      }
    }
  }

  setRunning(running: boolean): void {
    this.running = running;
  }

  setTicksPerSecond(value: number): void {
    this.ticksPerSecond = value;
  }

  reset(): void {
    this.simulator = this.createSimulator();
    this.size = this.simulator.world.size;
    this.elapsed = 0;
    this.running = true;
    this.resize();
    this.drawDynamicLayers();
    this.pushStatus();
  }

  pushStatus(): void {
    const snapshot = this.simulator.snapshot();
    const phase = snapshot.day ? 'Day' : 'Night';
    const outcome = this.simulator.outcome
      ? `${this.simulator.outcome.type.toUpperCase()}: ${this.simulator.outcome.reason}`
      : 'Running';

    this.onStatus({
      tick: snapshot.tick,
      phase,
      light: snapshot.light,
      plants: snapshot.plants,
      herbivores: snapshot.herbivores,
      carnivores: snapshot.carnivores,
      eggs: snapshot.eggs,
      o2: snapshot.o2,
      co2: snapshot.co2,
      water: snapshot.avgWater,
      outcome,
      events:
        this.simulator.currentTickEvents.length > 0
          ? this.simulator.currentTickEvents.join(' | ')
          : 'No notable events this tick.',
    });
  }
}

function createHud(scene: TerrariumScene): void {
  const hud = document.getElementById('hud');
  if (!hud) {
    return;
  }

  hud.innerHTML = `
    <h1>Terrarium Simulator</h1>
    <div class="hud-controls" role="group" aria-label="Playback controls">
      <button id="play-pause" type="button">Pause</button>
      <button id="step" type="button">Step</button>
      <button id="reset" type="button">Reset</button>
      <label for="speed">
        Speed
        <input id="speed" type="range" min="1" max="40" step="1" value="8" />
      </label>
      <output id="speed-value">8 tps</output>
    </div>
    <dl id="stats" class="hud-stats" aria-live="polite"></dl>
    <p id="events" class="hud-events"></p>
    <ul class="hud-legend" aria-label="Entity legend">
      <li><span class="dot plant"></span>Plants</li>
      <li><span class="dot herbivore"></span>Herbivores</li>
      <li><span class="dot carnivore"></span>Carnivores</li>
      <li><span class="dot egg"></span>Eggs</li>
    </ul>
  `;

  const playPauseButton = document.getElementById(
    'play-pause',
  ) as HTMLButtonElement;
  const stepButton = document.getElementById('step') as HTMLButtonElement;
  const resetButton = document.getElementById('reset') as HTMLButtonElement;
  const speedInput = document.getElementById('speed') as HTMLInputElement;
  const speedValue = document.getElementById(
    'speed-value',
  ) as HTMLOutputElement;

  playPauseButton.addEventListener('click', () => {
    scene.setRunning(!scene.running);
    playPauseButton.textContent = scene.running ? 'Pause' : 'Play';
  });

  stepButton.addEventListener('click', () => {
    if (scene.running) {
      scene.setRunning(false);
      playPauseButton.textContent = 'Play';
    }
    scene.step();
  });

  resetButton.addEventListener('click', () => {
    scene.reset();
    playPauseButton.textContent = 'Pause';
  });

  speedInput.addEventListener('input', () => {
    const speed = Number(speedInput.value);
    scene.setTicksPerSecond(speed);
    speedValue.value = `${speed} tps`;
  });

  scene.onStatus = (status) => {
    const stats = document.getElementById('stats');
    const events = document.getElementById('events');

    if (stats) {
      stats.innerHTML = `
        <div><dt>Tick</dt><dd>${status.tick}</dd></div>
        <div><dt>Phase</dt><dd>${status.phase}</dd></div>
        <div><dt>Light</dt><dd>${status.light}</dd></div>
        <div><dt>Plants</dt><dd>${status.plants}</dd></div>
        <div><dt>Herbivores</dt><dd>${status.herbivores}</dd></div>
        <div><dt>Carnivores</dt><dd>${status.carnivores}</dd></div>
        <div><dt>Eggs</dt><dd>${status.eggs}</dd></div>
        <div><dt>O2</dt><dd>${status.o2.toFixed(1)}</dd></div>
        <div><dt>CO2</dt><dd>${status.co2.toFixed(1)}</dd></div>
        <div><dt>Avg Water</dt><dd>${status.water.toFixed(1)}</dd></div>
        <div><dt>Status</dt><dd>${status.outcome}</dd></div>
      `;
    }

    if (events) {
      events.textContent = status.events;
    }
  };

  scene.pushStatus();
}

void (async () => {
  const container = document.getElementById('pixi-container');
  if (!container) {
    throw new Error('Expected #pixi-container to exist.');
  }

  const app = new Application();
  await app.init({
    background: '#11161f',
    antialias: false,
    resizeTo: window,
  });

  container.appendChild(app.canvas);

  const scene = new TerrariumScene(app, () => undefined);
  createHud(scene);
})();
