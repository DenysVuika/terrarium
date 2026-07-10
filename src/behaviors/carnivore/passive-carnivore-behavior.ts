import { BaseCarnivoreBehavior } from './base-carnivore-behavior';

export class PassiveCarnivoreBehavior extends BaseCarnivoreBehavior {
  constructor() {
    super({
      huntRadiusDelta: -1,
      restChanceScale: 1.15,
      rivalFightChanceScale: 0.5,
    });
  }
}
