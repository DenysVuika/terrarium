import type {
  CarnivoreBehaviorId,
  InsectBehaviorStrategy,
} from './behavior.ts';
import type { Carnivore } from './carnivore.ts';
import { AggressiveCarnivoreBehavior } from '../behaviors/carnivore/aggressive-carnivore-behavior.ts';
import { DefaultCarnivoreBehavior } from '../behaviors/carnivore/default-carnivore-behavior.ts';
import { PassiveCarnivoreBehavior } from '../behaviors/carnivore/passive-carnivore-behavior.ts';

const CARNIVORE_BEHAVIORS: Record<
  CarnivoreBehaviorId,
  InsectBehaviorStrategy<Carnivore>
> = {
  default: new DefaultCarnivoreBehavior(),
  aggressive: new AggressiveCarnivoreBehavior(),
  passive: new PassiveCarnivoreBehavior(),
};

export function getCarnivoreBehavior(
  id: CarnivoreBehaviorId,
): InsectBehaviorStrategy<Carnivore> {
  return CARNIVORE_BEHAVIORS[id] ?? CARNIVORE_BEHAVIORS.default;
}
