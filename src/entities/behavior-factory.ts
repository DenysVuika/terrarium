import type {
  CarnivoreBehaviorId,
  HerbivoreBehaviorId,
  InsectBehaviorStrategy,
} from './behavior.ts';
import type { Herbivore } from './herbivore.ts';
import type { Carnivore } from './carnivore.ts';
import { getHerbivoreBehavior } from './herbivore-behaviors.ts';
import { getCarnivoreBehavior } from './carnivore-behaviors.ts';

export function resolveHerbivoreBehavior(
  id: HerbivoreBehaviorId,
): InsectBehaviorStrategy<Herbivore> {
  return getHerbivoreBehavior(id);
}

export function resolveCarnivoreBehavior(
  id: CarnivoreBehaviorId,
): InsectBehaviorStrategy<Carnivore> {
  return getCarnivoreBehavior(id);
}
