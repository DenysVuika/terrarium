import type { Rng } from './rng.ts';

export const TERRAIN = {
  SOIL: 0,
  WATER: 1,
  SAND: 2,
  EMPTY: 3,
} as const;

type TerrainValue = (typeof TERRAIN)[keyof typeof TERRAIN];

export class World {
  size: number;
  length: number;
  rng: Rng;
  terrain: Uint8Array;
  water: Float32Array;
  nutrients: Float32Array;

  constructor(size: number, rng: Rng) {
    this.size = size;
    this.length = size * size;
    this.rng = rng;
    this.terrain = new Uint8Array(this.length);
    this.water = new Float32Array(this.length);
    this.nutrients = new Float32Array(this.length);

    this.generateTerrain();
    this.initializeResources();
  }

  index(x: number, y: number): number {
    return y * this.size + x;
  }

  coords(index: number): { x: number; y: number } {
    const y = Math.floor(index / this.size);
    return { x: index - y * this.size, y };
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  neighbors4(index: number): number[] {
    const { x, y } = this.coords(index);
    const out: number[] = [];
    if (x > 0) out.push(this.index(x - 1, y));
    if (x + 1 < this.size) out.push(this.index(x + 1, y));
    if (y > 0) out.push(this.index(x, y - 1));
    if (y + 1 < this.size) out.push(this.index(x, y + 1));
    return out;
  }

  neighbors8(index: number): number[] {
    const { x, y } = this.coords(index);
    const out: number[] = [];

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }

        const nx = x + dx;
        const ny = y + dy;
        if (this.inBounds(nx, ny)) {
          out.push(this.index(nx, ny));
        }
      }
    }

    return out;
  }

  generateTerrain(): void {
    this.terrain.fill(TERRAIN.EMPTY);

    this.paintPatches(TERRAIN.SOIL, 24, 600, 2500);
    this.paintPatches(TERRAIN.WATER, 7, 220, 900);
    this.paintPatches(TERRAIN.SAND, 12, 300, 1200);

    for (let index = 0; index < this.length; index += 1) {
      if (this.terrain[index] === TERRAIN.EMPTY && this.rng.chance(0.2)) {
        this.terrain[index] = TERRAIN.SOIL;
      }
    }
  }

  paintPatches(
    type: TerrainValue,
    count: number,
    minSize: number,
    maxSize: number,
  ): void {
    for (let patch = 0; patch < count; patch += 1) {
      const target = this.rng.int(minSize, maxSize);
      const start = this.rng.int(0, this.length - 1);
      const frontier: number[] = [start];
      let painted = 0;

      while (frontier.length && painted < target) {
        const idx = frontier.pop();
        if (idx === undefined || this.terrain[idx] === type) {
          continue;
        }

        this.terrain[idx] = type;
        painted += 1;

        const neighbors = this.neighbors4(idx);
        for (let neighborIndex = 0; neighborIndex < neighbors.length; neighborIndex += 1) {
          const neighbor = neighbors[neighborIndex];
          if (this.rng.chance(0.75)) {
            frontier.push(neighbor);
          }
        }

        if (frontier.length === 0 && painted < target) {
          frontier.push(this.rng.int(0, this.length - 1));
        }
      }
    }
  }

  initializeResources(): void {
    for (let index = 0; index < this.length; index += 1) {
      const terrain = this.terrain[index];
      if (terrain === TERRAIN.SOIL) {
        this.nutrients[index] = 200;
        this.water[index] = 50;
      } else if (terrain === TERRAIN.WATER) {
        this.nutrients[index] = 0;
        this.water[index] = 100;
      } else if (terrain === TERRAIN.SAND) {
        this.nutrients[index] = 0;
        this.water[index] = 10;
      } else {
        this.nutrients[index] = 0;
        this.water[index] = 15;
      }
    }
  }

  randomCell(predicate: (index: number) => boolean): number {
    for (let attempt = 0; attempt < 2000; attempt += 1) {
      const idx = this.rng.int(0, this.length - 1);
      if (predicate(idx)) {
        return idx;
      }
    }

    for (let idx = 0; idx < this.length; idx += 1) {
      if (predicate(idx)) {
        return idx;
      }
    }

    return -1;
  }

  isSoil(index: number): boolean {
    return this.terrain[index] === TERRAIN.SOIL;
  }

  isWalkable(index: number): boolean {
    const terrain = this.terrain[index];
    return terrain === TERRAIN.SOIL || terrain === TERRAIN.SAND;
  }
}