import { BaseCarnivoreBehavior } from './base-carnivore-behavior.ts';

export class PassiveCarnivoreBehavior extends BaseCarnivoreBehavior {
  constructor() {
    super({
      huntRadiusDelta: -1,
      restChanceScale: 1.15,
      rivalFightChanceScale: 0.5,
    });
  }
}
