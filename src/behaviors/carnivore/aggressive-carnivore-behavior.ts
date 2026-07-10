import { BaseCarnivoreBehavior } from './base-carnivore-behavior';

export class AggressiveCarnivoreBehavior extends BaseCarnivoreBehavior {
  constructor() {
    super({
      huntRadiusDelta: 2,
      restChanceScale: 0.45,
      rivalFightChanceScale: 1.5,
    });
  }
}
