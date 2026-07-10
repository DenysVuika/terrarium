import { BaseHerbivoreBehavior } from './base-herbivore-behavior.ts';

export class ForagerHerbivoreBehavior extends BaseHerbivoreBehavior {
  constructor() {
    super({
      plantSearchRadius: 3,
      consumePlantChance: 0.9,
    });
  }
}
