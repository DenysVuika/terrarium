import type { CarnivoreBehaviorId, InsectBehaviorStrategy } from './behavior';
import type { Carnivore } from '@/entities/insects';
import { AggressiveCarnivoreBehavior } from './carnivore/aggressive-carnivore-behavior';
import { DefaultCarnivoreBehavior } from './carnivore/default-carnivore-behavior';
import { PassiveCarnivoreBehavior } from './carnivore/passive-carnivore-behavior';

const CARNIVORE_BEHAVIORS: Record<CarnivoreBehaviorId, InsectBehaviorStrategy<Carnivore>> = {
  default: new DefaultCarnivoreBehavior(),
  aggressive: new AggressiveCarnivoreBehavior(),
  passive: new PassiveCarnivoreBehavior(),
};

export function getCarnivoreBehavior(id: CarnivoreBehaviorId): InsectBehaviorStrategy<Carnivore> {
  return CARNIVORE_BEHAVIORS[id] ?? CARNIVORE_BEHAVIORS.default;
}
