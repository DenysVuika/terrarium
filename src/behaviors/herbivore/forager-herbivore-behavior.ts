import { BaseHerbivoreBehavior } from './base-herbivore-behavior';

export class ForagerHerbivoreBehavior extends BaseHerbivoreBehavior {
  constructor() {
    super({
      plantSearchRadius: 3,
      consumePlantChance: 0.9,
    });
  }
}
