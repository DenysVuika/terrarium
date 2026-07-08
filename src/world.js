'use strict';

const TERRAIN = {
  SOIL: 0,
  WATER: 1,
  SAND: 2,
  EMPTY: 3,
};

class World {
  constructor(size, rng) {
    this.size = size;
    this.length = size * size;
    this.rng = rng;
    this.terrain = new Uint8Array(this.length);
    this.water = new Float32Array(this.length);
    this.nutrients = new Float32Array(this.length);

    this.generateTerrain();
    this.initializeResources();
  }

  index(x, y) {
    return y * this.size + x;
  }

  coords(index) {
    const y = Math.floor(index / this.size);
    return { x: index - y * this.size, y };
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  neighbors4(index) {
    const { x, y } = this.coords(index);
    const out = [];
    if (x > 0) out.push(this.index(x - 1, y));
    if (x + 1 < this.size) out.push(this.index(x + 1, y));
    if (y > 0) out.push(this.index(x, y - 1));
    if (y + 1 < this.size) out.push(this.index(x, y + 1));
    return out;
  }

  generateTerrain() {
    this.terrain.fill(TERRAIN.EMPTY);

    this.paintPatches(TERRAIN.SOIL, 24, 600, 2500);
    this.paintPatches(TERRAIN.WATER, 7, 220, 900);
    this.paintPatches(TERRAIN.SAND, 12, 300, 1200);

    for (let i = 0; i < this.length; i += 1) {
      if (this.terrain[i] === TERRAIN.EMPTY && this.rng.chance(0.2)) {
        this.terrain[i] = TERRAIN.SOIL;
      }
    }
  }

  paintPatches(type, count, minSize, maxSize) {
    for (let p = 0; p < count; p += 1) {
      const target = this.rng.int(minSize, maxSize);
      const start = this.rng.int(0, this.length - 1);
      const frontier = [start];
      let painted = 0;

      while (frontier.length && painted < target) {
        const idx = frontier.pop();
        if (this.terrain[idx] === type) {
          continue;
        }

        this.terrain[idx] = type;
        painted += 1;

        const neighbors = this.neighbors4(idx);
        for (let n = 0; n < neighbors.length; n += 1) {
          const neighbor = neighbors[n];
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

  initializeResources() {
    for (let i = 0; i < this.length; i += 1) {
      const terrain = this.terrain[i];
      if (terrain === TERRAIN.SOIL) {
        this.nutrients[i] = 200;
        this.water[i] = 50;
      } else if (terrain === TERRAIN.WATER) {
        this.nutrients[i] = 0;
        this.water[i] = 100;
      } else if (terrain === TERRAIN.SAND) {
        this.nutrients[i] = 0;
        this.water[i] = 10;
      } else {
        this.nutrients[i] = 0;
        this.water[i] = 15;
      }
    }
  }

  randomCell(predicate) {
    for (let i = 0; i < 2000; i += 1) {
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

  isSoil(index) {
    return this.terrain[index] === TERRAIN.SOIL;
  }

  isWalkable(index) {
    const t = this.terrain[index];
    return t === TERRAIN.SOIL || t === TERRAIN.SAND;
  }
}

module.exports = {
  TERRAIN,
  World,
};
