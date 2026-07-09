import type { Insect } from './insect.ts';
import type { Plant } from './plant.ts';
import type { Herbivore } from './herbivore.ts';
import type { Carnivore } from './carnivore.ts';

/**
 * Central storage and utility operations for all entity collections.
 *
 * Insects are stored in a single map keyed by kind so new species slot in
 * automatically without changing this class. The `herbivores` and `carnivores`
 * getters return the same array references that behavior code mutates (e.g.
 * push offspring), so existing code continues to work unchanged.
 */
export class EntityRepository {
  plants: Map<number, Plant>;
  private readonly _insects: Map<string, Insect[]>;

  constructor() {
    this.plants = new Map<number, Plant>();
    this._insects = new Map<string, Insect[]>();
  }

  // ── Typed getters for built-in species ──────────────────────────────────────

  get herbivores(): Herbivore[] {
    return (this._insects.get('herbivore') ?? []) as Herbivore[];
  }

  get carnivores(): Carnivore[] {
    return (this._insects.get('carnivore') ?? []) as Carnivore[];
  }

  // ── Generic insect access ───────────────────────────────────────────────────

  /** All insects across every registered species. */
  allInsects(): Insect[] {
    const out: Insect[] = [];
    for (const arr of this._insects.values()) {
      for (const insect of arr) out.push(insect);
    }
    return out;
  }

  /** Insects of a specific kind. Returns an empty array for unknown kinds. */
  getByKind(kind: string): Insect[] {
    return this._insects.get(kind) ?? [];
  }

  /**
   * Add an insect to its kind's collection.
   * Creates the collection for that kind on first use.
   */
  addInsect(insect: Insect): void {
    let arr = this._insects.get(insect.kind);
    if (!arr) {
      arr = [];
      this._insects.set(insect.kind, arr);
    }
    arr.push(insect);
  }

  isOccupied(cell: number): boolean {
    for (const arr of this._insects.values()) {
      for (const insect of arr) {
        if (insect.alive && insect.cell === cell) return true;
      }
    }
    return false;
  }

  // ── Population counts ───────────────────────────────────────────────────────

  countLiveHerbivores(): number {
    return this.herbivores.filter((h) => h.alive).length;
  }

  countLiveCarnivores(): number {
    return this.carnivores.filter((c) => c.alive).length;
  }

  countLiveInsects(): number {
    let count = 0;
    for (const arr of this._insects.values()) {
      for (const insect of arr) {
        if (insect.alive) count += 1;
      }
    }
    return count;
  }

  buildOccupiedSet(): Set<number> {
    const occupied = new Set<number>();
    for (const arr of this._insects.values()) {
      for (const insect of arr) {
        if (insect.alive) occupied.add(insect.cell);
      }
    }
    return occupied;
  }

  cleanupDead(): void {
    for (const [kind, arr] of this._insects.entries()) {
      this._insects.set(kind, arr.filter((i) => i.alive));
    }
  }
}
