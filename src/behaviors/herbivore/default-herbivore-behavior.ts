import { BaseHerbivoreBehavior } from './base-herbivore-behavior';

export class DefaultHerbivoreBehavior extends BaseHerbivoreBehavior {
  constructor() {
    super({
      plantSearchRadius: 2,
      consumePlantChance: 0.8,
    });
  }
}
