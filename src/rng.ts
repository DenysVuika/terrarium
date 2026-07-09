export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: T[]): T | null;
}

function hashSeed(input: unknown): number {
  const str = String(input ?? 'terrarium');
  let hash = 2166136261;
  for (let index = 0; index < str.length; index += 1) {
    hash ^= str.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed: unknown): Rng {
  let state = hashSeed(seed) || 1;

  return {
    next(): number {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    chance(probability: number): boolean {
      return this.next() < probability;
    },
    pick<T>(items: T[]): T | null {
      if (!items.length) {
        return null;
      }
      return items[Math.floor(this.next() * items.length)];
    },
  };
}