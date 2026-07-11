import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
} from 'pixi.js';
import { getDefaultConfig } from '../../src/config';
import { Simulator } from '../../src/simulator';
import { TERRAIN } from '../../src/world';

type SimulationStatus = {
  tick: number;
  phase: string;
  clock: string;
  phaseRemaining: string;
  phaseProgress: number;
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

type HoverStatus = {
  visible: boolean;
  clientX: number;
  clientY: number;
  title: string;
  rows: string[];
};

type TimeScalePreset = '60' | '30' | '15';

type SpriteKind =
  | 'plant-sprout'
  | 'plant-mid'
  | 'plant-mature'
  | 'plant-wilted'
  | 'herbivore-default'
  | 'herbivore-forager'
  | 'herbivore-larva'
  | 'carnivore-default'
  | 'carnivore-aggressive'
  | 'carnivore-passive'
  | 'carnivore-larva'
  | 'egg-herbivore'
  | 'egg-carnivore';

type SpriteTextures = Record<SpriteKind, Texture>;

type MovingInsect = {
  cell: number;
  lastCell: number;
};

const SPRITE_FILES: Record<SpriteKind, string> = {
  'plant-sprout': '/assets/sprites/plant-sprout.svg',
  'plant-mid': '/assets/sprites/plant-mid.svg',
  'plant-mature': '/assets/sprites/plant-mature.svg',
  'plant-wilted': '/assets/sprites/plant-wilted.svg',
  'herbivore-default': '/assets/sprites/herbivore-default.svg',
  'herbivore-forager': '/assets/sprites/herbivore-forager.svg',
  'herbivore-larva': '/assets/sprites/herbivore-larva.svg',
  'carnivore-default': '/assets/sprites/carnivore-default.svg',
  'carnivore-aggressive': '/assets/sprites/carnivore-aggressive.svg',
  'carnivore-passive': '/assets/sprites/carnivore-passive.svg',
  'carnivore-larva': '/assets/sprites/carnivore-larva.svg',
  'egg-herbivore': '/assets/sprites/egg-herbivore.svg',
  'egg-carnivore': '/assets/sprites/egg-carnivore.svg',
};

const SPRITE_KINDS = Object.keys(SPRITE_FILES) as SpriteKind[];

function createKindRecord<T>(
  factory: (kind: SpriteKind) => T,
): Record<SpriteKind, T> {
  const record = {} as Record<SpriteKind, T>;
  for (const kind of SPRITE_KINDS) {
    record[kind] = factory(kind);
  }
  return record;
}

async function loadSpriteTextures(): Promise<SpriteTextures> {
  const textures = {} as SpriteTextures;

  for (const kind of SPRITE_KINDS) {
    textures[kind] = (await Assets.load(SPRITE_FILES[kind])) as Texture;
  }

  return textures;
}

class TerrariumScene {
  app: Application;
  simulator: Simulator;
  textures: SpriteTextures;
  worldContainer: Container;
  terrainLayer: Graphics;
  waterOverlayLayer: Graphics;
  atmosphereLayer: Graphics;
  plantSpriteLayer: Container;
  herbivoreSpriteLayer: Container;
  carnivoreSpriteLayer: Container;
  eggSpriteLayer: Container;
  spritePools: Record<SpriteKind, Sprite[]>;
  spriteUsage: Record<SpriteKind, number>;
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
  timeScalePreset: TimeScalePreset;
  running: boolean;
  elapsed: number;
  visualTime: number;
  onStatus: (status: SimulationStatus) => void;
  onHover: (status: HoverStatus) => void;
  hoverCell: number | null;
  hoverClientX: number;
  hoverClientY: number;
  inspectorPinned: boolean;
  pointerTravel: number;

  constructor(
    app: Application,
    onStatus: (status: SimulationStatus) => void,
    textures: SpriteTextures,
  ) {
    this.app = app;
    this.onStatus = onStatus;
    this.textures = textures;
    this.timeScalePreset = '60';
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
    this.ticksPerSecond = 1;
    this.running = true;
    this.elapsed = 0;
    this.visualTime = 0;
    this.onHover = () => undefined;
    this.hoverCell = null;
    this.hoverClientX = 0;
    this.hoverClientY = 0;
    this.inspectorPinned = false;
    this.pointerTravel = 0;

    this.spritePools = createKindRecord(() => []);
    this.spriteUsage = createKindRecord(() => 0);

    this.worldContainer = new Container();
    this.terrainLayer = new Graphics();
    this.waterOverlayLayer = new Graphics();
    this.atmosphereLayer = new Graphics();
    this.plantSpriteLayer = new Container();
    this.herbivoreSpriteLayer = new Container();
    this.carnivoreSpriteLayer = new Container();
    this.eggSpriteLayer = new Container();

    this.worldContainer.addChild(this.terrainLayer);
    this.worldContainer.addChild(this.waterOverlayLayer);
    this.worldContainer.addChild(this.plantSpriteLayer);
    this.worldContainer.addChild(this.herbivoreSpriteLayer);
    this.worldContainer.addChild(this.carnivoreSpriteLayer);
    this.worldContainer.addChild(this.eggSpriteLayer);
    this.worldContainer.addChild(this.atmosphereLayer);
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
    this.applyTimeScaleToConfig(config, this.timeScalePreset);
    return new Simulator(config);
  }

  applyTimeScaleToConfig(
    config: ReturnType<typeof getDefaultConfig>,
    preset: TimeScalePreset,
  ): void {
    const minutesPerTick = Number(preset);
    const halfDayMinutes = 12 * 60;
    const ticksPerHalfDay = Math.max(
      1,
      Math.round(halfDayMinutes / minutesPerTick),
    );
    config.climate.dayTicks = ticksPerHalfDay;
    config.climate.nightTicks = ticksPerHalfDay;
  }

  getTimeScaleLabel(): string {
    if (this.timeScalePreset === '60') return '1h/tick';
    if (this.timeScalePreset === '30') return '30m/tick';
    return '15m/tick';
  }

  getMinutesPerTick(): number {
    return Number(this.timeScalePreset);
  }

  getClockLabelForTick(tick: number): string {
    const minutesPerTick = this.getMinutesPerTick();
    const totalMinutes = Math.max(0, tick) * minutesPerTick;
    const day = Math.floor(totalMinutes / (24 * 60)) + 1;
    const minuteOfDay = totalMinutes % (24 * 60);
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `Day ${day}, ${hh}:${mm}`;
  }

  setTimeScalePreset(preset: TimeScalePreset): void {
    this.timeScalePreset = preset;
    this.applyTimeScaleToConfig(this.simulator.config, preset);
    // Restart current phase progress so visual phase transitions remain predictable.
    this.simulator.phaseTicksElapsed = 0;
    this.pushStatus();
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
      this.pointerTravel = 0;
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
      this.pointerTravel += Math.hypot(deltaX, deltaY);

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

    this.app.canvas.addEventListener('mousemove', (event) => {
      this.handleHoverAtClient(event.clientX, event.clientY);
    });

    this.app.canvas.addEventListener('mouseleave', () => {
      if (!this.inspectorPinned) {
        this.hoverCell = null;
        this.onHover({
          visible: false,
          clientX: this.hoverClientX,
          clientY: this.hoverClientY,
          title: '',
          rows: [],
        });
      }
    });
  }

  setInspectorPinned(pinned: boolean): void {
    this.inspectorPinned = pinned;

    if (!pinned && this.hoverCell === null) {
      this.onHover({
        visible: false,
        clientX: this.hoverClientX,
        clientY: this.hoverClientY,
        title: '',
        rows: [],
      });
      return;
    }

    if (this.hoverCell !== null) {
      this.emitHoverDetails(this.hoverCell, this.hoverClientX, this.hoverClientY);
    }
  }

  consumePointerTravel(): number {
    const travel = this.pointerTravel;
    this.pointerTravel = 0;
    return travel;
  }

  terrainLabel(terrainType: number): string {
    if (terrainType === TERRAIN.SOIL) return 'Soil';
    if (terrainType === TERRAIN.WATER) return 'Water';
    if (terrainType === TERRAIN.SAND) return 'Sand';
    return 'Empty';
  }

  handleHoverAtClient(clientX: number, clientY: number): void {
    if (this.inspectorPinned) {
      return;
    }

    const rect = this.app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    this.hoverClientX = clientX;
    this.hoverClientY = clientY;

    const normalizedX = (clientX - rect.left) / rect.width;
    const normalizedY = (clientY - rect.top) / rect.height;
    const screenX = normalizedX * this.app.screen.width;
    const screenY = normalizedY * this.app.screen.height;

    const worldX = (screenX - this.cameraX) / this.zoom;
    const worldY = (screenY - this.cameraY) / this.zoom;

    const cellX = Math.floor(worldX / this.baseCellSize);
    const cellY = Math.floor(worldY / this.baseCellSize);

    if (cellX < 0 || cellY < 0 || cellX >= this.size || cellY >= this.size) {
      this.hoverCell = null;
      this.onHover({
        visible: false,
        clientX,
        clientY,
        title: '',
        rows: [],
      });
      return;
    }

    const cell = cellY * this.size + cellX;
    this.hoverCell = cell;
    this.emitHoverDetails(cell, clientX, clientY);
  }

  getClientPointForCell(cell: number): { clientX: number; clientY: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const x = cell % this.size;
    const y = Math.floor(cell / this.size);

    const worldCenterX = (x + 0.5) * this.baseCellSize;
    const worldCenterY = (y + 0.5) * this.baseCellSize;

    const screenX = this.cameraX + worldCenterX * this.zoom;
    const screenY = this.cameraY + worldCenterY * this.zoom;

    const clientX = rect.left + (screenX / this.app.screen.width) * rect.width;
    const clientY = rect.top + (screenY / this.app.screen.height) * rect.height;

    return { clientX, clientY };
  }

  emitHoverDetails(cell: number, clientX: number, clientY: number): void {
    const world = this.simulator.world;
    const terrainType = world.terrain[cell];
    const water = world.water[cell];
    const nutrients = world.nutrients[cell];
    const plant = this.simulator.entities.plants.get(cell);
    const herbivores = this.simulator.entities.herbivores.filter(
      (entity) => entity.alive && entity.cell === cell,
    );
    const carnivores = this.simulator.entities.carnivores.filter(
      (entity) => entity.alive && entity.cell === cell,
    );

    const coords = world.coords(cell);
    const rows: string[] = [
      `Terrain: ${this.terrainLabel(terrainType)}`,
      `Water: ${water.toFixed(1)} | Nutrients: ${nutrients.toFixed(1)}`,
    ];

    if (plant) {
      rows.push(
        `Plant: growth ${plant.growth.toFixed(1)}${plant.wilted ? ' (wilted)' : ''}`,
      );
    }

    for (const herbivore of herbivores) {
      rows.push(
        `Herbivore (${herbivore.behaviorId}) | stage ${herbivore.stage} | age ${herbivore.age} | energy ${herbivore.energy.toFixed(1)}`,
      );
    }

    for (const carnivore of carnivores) {
      rows.push(
        `Carnivore (${carnivore.behaviorId}) | stage ${carnivore.stage} | age ${carnivore.age} | energy ${carnivore.energy.toFixed(1)} | AP ${carnivore.ap.toFixed(1)}`,
      );
    }

    if (!plant && herbivores.length === 0 && carnivores.length === 0) {
      rows.push('No entities in this cell.');
    }

    let resolvedClientX = clientX;
    let resolvedClientY = clientY;

    if (this.inspectorPinned) {
      const anchored = this.getClientPointForCell(cell);
      resolvedClientX = anchored.clientX;
      resolvedClientY = anchored.clientY;
    }

    this.onHover({
      visible: true,
      clientX: resolvedClientX,
      clientY: resolvedClientY,
      title: `Cell (${coords.x}, ${coords.y}) #${cell}`,
      rows,
    });
  }

  applyWorldTransform(): void {
    this.worldContainer.position.set(this.cameraX, this.cameraY);
    this.worldContainer.scale.set(this.zoom);

    if (this.inspectorPinned && this.hoverCell !== null) {
      this.emitHoverDetails(this.hoverCell, this.hoverClientX, this.hoverClientY);
    }
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

  layerForKind(kind: SpriteKind): Container {
    if (kind.startsWith('plant-')) return this.plantSpriteLayer;
    if (kind.startsWith('herbivore-')) return this.herbivoreSpriteLayer;
    if (kind.startsWith('carnivore-')) return this.carnivoreSpriteLayer;
    return this.eggSpriteLayer;
  }

  beginSpriteFrame(): void {
    for (const kind of SPRITE_KINDS) {
      this.spriteUsage[kind] = 0;
    }
  }

  placeSprite(
    kind: SpriteKind,
    x: number,
    y: number,
    size: number,
    alpha = 1,
    rotation = 0,
  ): void {
    const usage = this.spriteUsage[kind];
    const pool = this.spritePools[kind];
    let sprite = pool[usage];

    if (!sprite) {
      sprite = new Sprite(this.textures[kind]);
      sprite.anchor.set(0.5);
      this.layerForKind(kind).addChild(sprite);
      pool.push(sprite);
    }

    sprite.visible = true;
    sprite.position.set(x, y);
    sprite.alpha = alpha;
    sprite.rotation = rotation;

    const textureSize = Math.max(
      1,
      Math.max(sprite.texture.width, sprite.texture.height),
    );
    const scale = size / textureSize;
    sprite.scale.set(scale);

    this.spriteUsage[kind] = usage + 1;
  }

  insectHeadingRotation(insect: MovingInsect): number {
    if (insect.lastCell < 0 || insect.lastCell === insect.cell) {
      return 0;
    }

    const current = this.simulator.world.coords(insect.cell);
    const previous = this.simulator.world.coords(insect.lastCell);
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;

    // Sprite art is authored facing up. Convert movement vector to that basis.
    return Math.atan2(dy, dx) + Math.PI / 2;
  }

  endSpriteFrame(): void {
    for (const kind of SPRITE_KINDS) {
      const used = this.spriteUsage[kind];
      const pool = this.spritePools[kind];
      for (let index = used; index < pool.length; index += 1) {
        pool[index].visible = false;
      }
    }
  }

  drawTerrain(): void {
    const terrain = this.simulator.world.terrain;
    const soilColor = 0x536b2f;
    const waterColor = 0x2e6b9e;
    const sandColor = 0xb59f68;
    const emptyColor = 0x2d3242;

    this.terrainLayer.clear();

    for (let index = 0; index < terrain.length; index += 1) {
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

  drawPlants(): void {
    const centerOffset = this.baseCellSize * 0.5;

    for (const plant of this.simulator.entities.plants.values()) {
      const x = (plant.cell % this.size) * this.baseCellSize + centerOffset;
      const y =
        Math.floor(plant.cell / this.size) * this.baseCellSize + centerOffset;

      if (plant.wilted) {
        this.placeSprite('plant-wilted', x, y, this.baseCellSize * 0.9, 0.95);
      } else if (plant.growth < 30) {
        this.placeSprite('plant-sprout', x, y, this.baseCellSize * 0.62);
      } else if (plant.growth < 70) {
        this.placeSprite('plant-mid', x, y, this.baseCellSize * 0.82);
      } else {
        this.placeSprite('plant-mature', x, y, this.baseCellSize * 1.02);
      }
    }
  }

  drawHerbivores(): void {
    const centerOffset = this.baseCellSize * 0.5;

    for (const herbivore of this.simulator.entities.herbivores) {
      if (!herbivore.alive || herbivore.stage === 'egg') {
        continue;
      }

      const x = (herbivore.cell % this.size) * this.baseCellSize + centerOffset;
      const y =
        Math.floor(herbivore.cell / this.size) * this.baseCellSize +
        centerOffset;

      if (herbivore.stage === 'larva') {
        this.placeSprite('herbivore-larva', x, y, this.baseCellSize * 0.5);
      } else if (herbivore.behaviorId === 'forager') {
        const rotation = this.insectHeadingRotation(herbivore);
        this.placeSprite(
          'herbivore-forager',
          x,
          y,
          this.baseCellSize * 0.78,
          1,
          rotation,
        );
      } else {
        const rotation = this.insectHeadingRotation(herbivore);
        this.placeSprite(
          'herbivore-default',
          x,
          y,
          this.baseCellSize * 0.78,
          1,
          rotation,
        );
      }
    }
  }

  drawCarnivores(): void {
    const centerOffset = this.baseCellSize * 0.5;

    for (const carnivore of this.simulator.entities.carnivores) {
      if (!carnivore.alive || carnivore.stage === 'egg') {
        continue;
      }

      const x = (carnivore.cell % this.size) * this.baseCellSize + centerOffset;
      const y =
        Math.floor(carnivore.cell / this.size) * this.baseCellSize +
        centerOffset;

      if (carnivore.stage === 'larva') {
        this.placeSprite('carnivore-larva', x, y, this.baseCellSize * 0.54);
      } else if (carnivore.behaviorId === 'aggressive') {
        const rotation = this.insectHeadingRotation(carnivore);
        this.placeSprite(
          'carnivore-aggressive',
          x,
          y,
          this.baseCellSize * 0.86,
          1,
          rotation,
        );
      } else if (carnivore.behaviorId === 'passive') {
        const rotation = this.insectHeadingRotation(carnivore);
        this.placeSprite(
          'carnivore-passive',
          x,
          y,
          this.baseCellSize * 0.86,
          1,
          rotation,
        );
      } else {
        const rotation = this.insectHeadingRotation(carnivore);
        this.placeSprite(
          'carnivore-default',
          x,
          y,
          this.baseCellSize * 0.86,
          1,
          rotation,
        );
      }
    }
  }

  drawEggs(): void {
    const radiusSize = this.baseCellSize * 0.52;
    const centerOffset = this.baseCellSize * 0.5;

    for (const herbivore of this.simulator.entities.herbivores) {
      if (!herbivore.alive || herbivore.stage !== 'egg') {
        continue;
      }

      const x = (herbivore.cell % this.size) * this.baseCellSize + centerOffset;
      const y =
        Math.floor(herbivore.cell / this.size) * this.baseCellSize +
        centerOffset;
      this.placeSprite('egg-herbivore', x, y, radiusSize);
    }

    for (const carnivore of this.simulator.entities.carnivores) {
      if (!carnivore.alive || carnivore.stage !== 'egg') {
        continue;
      }

      const x = (carnivore.cell % this.size) * this.baseCellSize + centerOffset;
      const y =
        Math.floor(carnivore.cell / this.size) * this.baseCellSize +
        centerOffset;
      this.placeSprite('egg-carnivore', x, y, radiusSize);
    }
  }

  drawWaterAndAtmosphere(): void {
    this.waterOverlayLayer.clear();
    this.atmosphereLayer.clear();

    const world = this.simulator.world;
    const wave = Math.sin(this.visualTime * 1.8) * 0.05;

    for (let index = 0; index < world.length; index += 1) {
      if (world.terrain[index] !== TERRAIN.WATER) {
        continue;
      }

      const x = (index % this.size) * this.baseCellSize;
      const y = Math.floor(index / this.size) * this.baseCellSize;
      const depth = Math.max(0, Math.min(1, world.water[index] / 100));
      const alpha = Math.max(0.06, Math.min(0.35, 0.08 + depth * 0.18 + wave));

      this.waterOverlayLayer.rect(x, y, this.baseCellSize, this.baseCellSize);
      this.waterOverlayLayer.fill({ color: 0x7bc1ff, alpha });
    }

    const globalWarmth = Math.max(0, Math.min(1, this.simulator.co2 / 100));
    const oxygenBoost = Math.max(0, Math.min(1, this.simulator.o2 / 100));
    const dayAlpha = this.simulator.day ? 0.07 : 0.16;
    const sizePx = this.size * this.baseCellSize;

    this.atmosphereLayer.rect(0, 0, sizePx, sizePx);
    this.atmosphereLayer.fill({
      color: this.simulator.day ? 0x98d8ff : 0x0e1a3b,
      alpha: dayAlpha,
    });

    this.atmosphereLayer.rect(0, 0, sizePx, sizePx);
    this.atmosphereLayer.fill({
      color: 0xff8f65,
      alpha: globalWarmth * 0.07,
    });

    this.atmosphereLayer.rect(0, 0, sizePx, sizePx);
    this.atmosphereLayer.fill({
      color: 0x7fd8a1,
      alpha: oxygenBoost * 0.04,
    });
  }

  drawDynamicLayers(): void {
    this.beginSpriteFrame();
    this.drawPlants();
    this.drawHerbivores();
    this.drawCarnivores();
    this.drawEggs();
    this.endSpriteFrame();
    this.drawWaterAndAtmosphere();
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
    if (this.hoverCell !== null) {
      this.emitHoverDetails(this.hoverCell, this.hoverClientX, this.hoverClientY);
    }
    this.pushStatus();
  }

  update(deltaSeconds: number): void {
    this.visualTime += deltaSeconds;
    this.drawWaterAndAtmosphere();

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
    this.visualTime = 0;
    this.hoverCell = null;
    this.setInspectorPinned(false);
    this.resetView();
    this.resize();
    this.drawDynamicLayers();
    this.pushStatus();
  }

  pushStatus(): void {
    const snapshot = this.simulator.snapshot();
    const phase = snapshot.day ? 'Day' : 'Night';
    const phaseLength = snapshot.day
      ? this.simulator.config.climate.dayTicks
      : this.simulator.config.climate.nightTicks;
    const safePhaseLength = Math.max(1, Number(phaseLength) || 1);
    const rawProgress = this.simulator.phaseTicksElapsed / safePhaseLength;
    const phaseProgress = Math.max(0, Math.min(1, rawProgress));
    const remainingTicks = Math.max(
      0,
      Math.ceil(safePhaseLength - this.simulator.phaseTicksElapsed),
    );
    const remainingMinutes = remainingTicks * this.getMinutesPerTick();
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMinutesPart = remainingMinutes % 60;
    const phaseRemaining = `${remainingHours}h ${String(remainingMinutesPart).padStart(2, '0')}m`;
    const outcome = this.simulator.outcome
      ? `${this.simulator.outcome.type.toUpperCase()}: ${this.simulator.outcome.reason}`
      : 'Running';

    this.onStatus({
      tick: snapshot.tick,
      phase,
      clock: this.getClockLabelForTick(snapshot.tick),
      phaseRemaining,
      phaseProgress,
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
  const pixiContainer = document.getElementById('pixi-container');

  const existingHover = document.getElementById('hover-inspector');
  if (existingHover) {
    existingHover.remove();
  }

  const hoverInspector = document.createElement('aside');
  hoverInspector.id = 'hover-inspector';
  hoverInspector.setAttribute('aria-live', 'polite');
  hoverInspector.className = 'hover-inspector hidden';
  document.body.appendChild(hoverInspector);

  scene.app.canvas.addEventListener('click', (event) => {
    if (scene.consumePointerTravel() > 5) {
      return;
    }

    if (scene.inspectorPinned) {
      scene.setInspectorPinned(false);
      scene.handleHoverAtClient(event.clientX, event.clientY);
      return;
    }

    if (scene.hoverCell !== null) {
      scene.setInspectorPinned(true);
    }
  });

  hud.innerHTML = `
    <h1>Terrarium Simulator</h1>
    <div class="hud-controls" role="group" aria-label="Playback controls">
      <button id="play-pause" type="button">Pause</button>
      <button id="step" type="button">Step</button>
      <button id="reset" type="button">Reset</button>
      <button id="reset-view" type="button">Reset View</button>
      <label for="time-scale">
        Sim Time
        <select id="time-scale">
          <option value="60" selected>1h / tick</option>
          <option value="30">30m / tick</option>
          <option value="15">15m / tick</option>
        </select>
      </label>
      <output id="time-scale-value">1h/tick</output>
      <label for="speed">
        Speed
        <input id="speed" type="range" min="0.2" max="8" step="0.1" value="1" />
      </label>
      <output id="speed-value">1.0 tps</output>
    </div>
    <p class="hud-tip">Tip: drag to pan, mouse wheel or trackpad scroll to zoom, click a cell to pin inspector, click again to unpin.</p>
    <dl id="stats" class="hud-stats" aria-live="polite"></dl>
    <p id="events" class="hud-events"></p>
    <ul class="hud-legend" aria-label="Entity legend">
      <li><span class="dot plant"></span>Plants (sprite stages)</li>
      <li><span class="dot herbivore"></span>Herbivores: default, forager, larva</li>
      <li><span class="dot carnivore"></span>Carnivores: default, aggressive, passive, larva</li>
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
  const timeScaleSelect = document.getElementById(
    'time-scale',
  ) as HTMLSelectElement;
  const timeScaleValue = document.getElementById(
    'time-scale-value',
  ) as HTMLOutputElement;
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

  timeScaleSelect.addEventListener('change', () => {
    scene.setTimeScalePreset(timeScaleSelect.value as TimeScalePreset);
    timeScaleValue.value = scene.getTimeScaleLabel();
  });

  speedInput.addEventListener('input', () => {
    const speed = Number(speedInput.value);
    scene.setTicksPerSecond(speed);
    speedValue.value = `${speed.toFixed(1)} tps`;
  });

  scene.onStatus = (status) => {
    const stats = document.getElementById('stats');
    const events = document.getElementById('events');

    if (stats) {
      const phasePercent = Math.max(
        0,
        Math.min(100, Math.round(status.phaseProgress * 100)),
      );

      stats.innerHTML = `
        <div><dt>Tick</dt><dd>${status.tick}</dd></div>
        <div><dt>Clock</dt><dd>${status.clock}</dd></div>
        <div><dt>Phase</dt><dd>${status.phase}</dd></div>
        <div><dt>Phase Ends In</dt><dd>${status.phaseRemaining}</dd></div>
        <div><dt>Phase Progress</dt><dd>${phasePercent}%</dd></div>
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

  scene.onHover = (status) => {
    if (!status.visible) {
      hoverInspector.classList.add('hidden');
      hoverInspector.classList.remove('pinned');
      return;
    }

    hoverInspector.innerHTML = `
      <h3>${status.title}</h3>
      <ul>
        ${status.rows.map((row) => `<li>${row}</li>`).join('')}
      </ul>
    `;

    hoverInspector.classList.remove('hidden');
    hoverInspector.classList.toggle('pinned', scene.inspectorPinned);

    const offset = 14;
    let left = status.clientX + offset;
    let top = status.clientY + offset;

    if (pixiContainer) {
      const viewport = pixiContainer.getBoundingClientRect();
      const wouldOverflowRight =
        left + hoverInspector.offsetWidth + 8 > viewport.right;
      const wouldOverflowBottom =
        top + hoverInspector.offsetHeight + 8 > viewport.bottom;

      if (wouldOverflowRight) {
        left = status.clientX - hoverInspector.offsetWidth - offset;
      }

      if (wouldOverflowBottom) {
        top = status.clientY - hoverInspector.offsetHeight - offset;
      }
    } else {
      const wouldOverflowRight =
        left + hoverInspector.offsetWidth + 8 > window.innerWidth;
      const wouldOverflowBottom =
        top + hoverInspector.offsetHeight + 8 > window.innerHeight;

      if (wouldOverflowRight) {
        left = status.clientX - hoverInspector.offsetWidth - offset;
      }

      if (wouldOverflowBottom) {
        top = status.clientY - hoverInspector.offsetHeight - offset;
      }
    }

    if (pixiContainer) {
      const viewport = pixiContainer.getBoundingClientRect();
      const minLeft = viewport.left + 8;
      const minTop = viewport.top + 8;
      const maxLeft = viewport.right - hoverInspector.offsetWidth - 8;
      const maxTop = viewport.bottom - hoverInspector.offsetHeight - 8;

      left = Math.max(minLeft, Math.min(maxLeft, left));
      top = Math.max(minTop, Math.min(maxTop, top));
    } else {
      const maxLeft = window.innerWidth - hoverInspector.offsetWidth - 8;
      const maxTop = window.innerHeight - hoverInspector.offsetHeight - 8;
      left = Math.max(8, Math.min(maxLeft, left));
      top = Math.max(8, Math.min(maxTop, top));
    }

    hoverInspector.style.left = `${left}px`;
    hoverInspector.style.top = `${top}px`;
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

  const textures = await loadSpriteTextures();
  const scene = new TerrariumScene(app, () => undefined, textures);
  createHud(scene);
})();
