import { BaseCarnivoreBehavior } from './base-carnivore-behavior.ts';

export class AggressiveCarnivoreBehavior extends BaseCarnivoreBehavior {
  constructor() {
    super({
      huntRadiusDelta: 2,
      restChanceScale: 0.45,
      rivalFightChanceScale: 1.5,
    });
  }
}
