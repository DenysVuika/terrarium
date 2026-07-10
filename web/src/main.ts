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
  baseCellSize: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  cameraX: number;
  cameraY: number;
  dragging: boolean;
  dragLastX: number;
  dragLastY: number;
  ticksPerSecond: number;
  running: boolean;
  elapsed: number;
  onStatus: (status: SimulationStatus) => void;

  constructor(app: Application, onStatus: (status: SimulationStatus) => void) {
    this.app = app;
    this.onStatus = onStatus;
    this.simulator = this.createSimulator();
    this.size = this.simulator.world.size;
    this.baseCellSize = this.computeCellSize();
    this.zoom = 2.2;
    this.minZoom = 0.5;
    this.maxZoom = 8;
    this.cameraX = 0;
    this.cameraY = 0;
    this.dragging = false;
    this.dragLastX = 0;
    this.dragLastY = 0;
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

    this.setupCameraInteractions();
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
    const maxWidth = Math.max(220, this.app.screen.width - 28);
    const maxHeight = Math.max(220, this.app.screen.height - 28);
    const maxGridPixels = Math.min(maxWidth, maxHeight);
    return Math.max(1, Math.floor(maxGridPixels / this.size));
  }

  setupCameraInteractions(): void {
    this.app.stage.eventMode = 'static';

    this.app.stage.on('pointerdown', (event) => {
      this.dragging = true;
      this.dragLastX = event.global.x;
      this.dragLastY = event.global.y;
    });

    this.app.stage.on('pointermove', (event) => {
      if (!this.dragging) {
        return;
      }

      const currentX = event.global.x;
      const currentY = event.global.y;
      const deltaX = currentX - this.dragLastX;
      const deltaY = currentY - this.dragLastY;

      this.dragLastX = currentX;
      this.dragLastY = currentY;

      this.cameraX += deltaX;
      this.cameraY += deltaY;
      this.clampCamera();
      this.applyWorldTransform();
    });

    const stopDrag = (): void => {
      this.dragging = false;
    };

    this.app.stage.on('pointerup', stopDrag);
    this.app.stage.on('pointerupoutside', stopDrag);
    this.app.stage.on('pointercancel', stopDrag);

    this.app.canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();

        const rect = this.app.canvas.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.zoomAt(localX, localY, factor);
      },
      { passive: false },
    );
  }

  applyWorldTransform(): void {
    this.worldContainer.position.set(this.cameraX, this.cameraY);
    this.worldContainer.scale.set(this.zoom);
  }

  worldSizePx(): number {
    return this.size * this.baseCellSize * this.zoom;
  }

  clampCamera(): void {
    const worldSize = this.worldSizePx();
    const viewWidth = this.app.screen.width;
    const viewHeight = this.app.screen.height;

    if (worldSize <= viewWidth) {
      this.cameraX = Math.round((viewWidth - worldSize) / 2);
    } else {
      this.cameraX = Math.min(0, Math.max(viewWidth - worldSize, this.cameraX));
    }

    if (worldSize <= viewHeight) {
      this.cameraY = Math.round((viewHeight - worldSize) / 2);
    } else {
      this.cameraY = Math.min(
        0,
        Math.max(viewHeight - worldSize, this.cameraY),
      );
    }
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const previousZoom = this.zoom;
    const nextZoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, previousZoom * factor),
    );

    if (Math.abs(nextZoom - previousZoom) < 0.001) {
      return;
    }

    const worldX = (screenX - this.cameraX) / previousZoom;
    const worldY = (screenY - this.cameraY) / previousZoom;

    this.zoom = nextZoom;
    this.cameraX = screenX - worldX * this.zoom;
    this.cameraY = screenY - worldY * this.zoom;

    this.clampCamera();
    this.applyWorldTransform();
  }

  resetView(): void {
    this.zoom = 2.2;
    this.centerCamera();
    this.applyWorldTransform();
  }

  centerCamera(): void {
    const worldSize = this.worldSizePx();
    this.cameraX = Math.round((this.app.screen.width - worldSize) / 2);
    this.cameraY = Math.round((this.app.screen.height - worldSize) / 2);
    this.clampCamera();
  }

  resize(): void {
    const previousScreenCenterX = this.app.screen.width / 2;
    const previousScreenCenterY = this.app.screen.height / 2;
    const worldCenterX = (previousScreenCenterX - this.cameraX) / this.zoom;
    const worldCenterY = (previousScreenCenterY - this.cameraY) / this.zoom;

    this.baseCellSize = this.computeCellSize();
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));

    this.cameraX = this.app.screen.width / 2 - worldCenterX * this.zoom;
    this.cameraY = this.app.screen.height / 2 - worldCenterY * this.zoom;

    if (!Number.isFinite(this.cameraX) || !Number.isFinite(this.cameraY)) {
      this.centerCamera();
    } else {
      this.clampCamera();
    }

    this.applyWorldTransform();

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
      const x = (index % this.size) * this.baseCellSize;
      const y = Math.floor(index / this.size) * this.baseCellSize;
      const terrainType = terrain[index];
      const color =
        terrainType === TERRAIN.SOIL
          ? soilColor
          : terrainType === TERRAIN.WATER
            ? waterColor
            : terrainType === TERRAIN.SAND
              ? sandColor
              : emptyColor;

      this.terrainLayer.rect(x, y, this.baseCellSize, this.baseCellSize);
      this.terrainLayer.fill({ color });
    }
  }

  drawPlants(cells: number[]): void {
    this.plantLayer.clear();
    const inset = Math.max(0, Math.floor(this.baseCellSize * 0.15));
    const size = Math.max(1, this.baseCellSize - inset * 2);

    for (const cell of cells) {
      const x = (cell % this.size) * this.baseCellSize + inset;
      const y = Math.floor(cell / this.size) * this.baseCellSize + inset;
      this.plantLayer.rect(x, y, size, size);
      this.plantLayer.fill({ color: 0x69d25b });
    }
  }

  drawInsects(cells: number[], color: number, layer: Graphics): void {
    layer.clear();
    const radius = Math.max(1, this.baseCellSize * 0.36);
    const centerOffset = this.baseCellSize * 0.5;

    for (const cell of cells) {
      const x = (cell % this.size) * this.baseCellSize + centerOffset;
      const y = Math.floor(cell / this.size) * this.baseCellSize + centerOffset;
      layer.circle(x, y, radius);
      layer.fill({ color });
    }
  }

  drawEggs(cells: number[]): void {
    this.eggLayer.clear();
    const radius = Math.max(1, this.baseCellSize * 0.18);
    const centerOffset = this.baseCellSize * 0.5;

    for (const cell of cells) {
      const x = (cell % this.size) * this.baseCellSize + centerOffset;
      const y = Math.floor(cell / this.size) * this.baseCellSize + centerOffset;
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
    this.resetView();
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
      <button id="reset-view" type="button">Reset View</button>
      <label for="speed">
        Speed
        <input id="speed" type="range" min="1" max="40" step="1" value="8" />
      </label>
      <output id="speed-value">8 tps</output>
    </div>
    <p class="hud-tip">Tip: drag to pan, mouse wheel or trackpad scroll to zoom.</p>
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
  const resetViewButton = document.getElementById(
    'reset-view',
  ) as HTMLButtonElement;
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

  resetViewButton.addEventListener('click', () => {
    scene.resetView();
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
    resizeTo: container,
  });

  container.appendChild(app.canvas);

  const scene = new TerrariumScene(app, () => undefined);
  createHud(scene);
})();
