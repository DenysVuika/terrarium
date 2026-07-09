import type { Plant } from './plant.ts';
import type { Herbivore } from './herbivore.ts';
import type { Carnivore } from './carnivore.ts';

/**
 * Central storage and utility operations for all live/dead entity collections.
 */
export class EntityRepository {
  plants: Map<number, Plant>;
  herbivores: Herbivore[];
  carnivores: Carnivore[];

  constructor() {
    this.plants = new Map<number, Plant>();
    this.herbivores = [];
    this.carnivores = [];
  }

  countLiveHerbivores(): number {
    return this.herbivores.filter((h) => h.alive).length;
  }

  countLiveCarnivores(): number {
    return this.carnivores.filter((c) => c.alive).length;
  }

  countLiveInsects(): number {
    return this.countLiveHerbivores() + this.countLiveCarnivores();
  }

  buildOccupiedSet(): Set<number> {
    const occupied = new Set<number>();
    for (const herbivore of this.herbivores) {
      if (herbivore.alive) occupied.add(herbivore.cell);
    }
    for (const carnivore of this.carnivores) {
      if (carnivore.alive) occupied.add(carnivore.cell);
    }
    return occupied;
  }

  cleanupDead(): void {
    this.herbivores = this.herbivores.filter((h) => h.alive);
    this.carnivores = this.carnivores.filter((c) => c.alive);
  }
}
