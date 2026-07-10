import type { CarnivoreBehaviorId, HerbivoreBehaviorId, InsectBehaviorStrategy } from './behavior';
import type { Carnivore, Herbivore } from '@/entities/insects';
import { getHerbivoreBehavior } from './herbivore-behaviors';
import { getCarnivoreBehavior } from './carnivore-behaviors';

export function resolveHerbivoreBehavior(id: HerbivoreBehaviorId): InsectBehaviorStrategy<Herbivore> {
  return getHerbivoreBehavior(id);
}

export function resolveCarnivoreBehavior(id: CarnivoreBehaviorId): InsectBehaviorStrategy<Carnivore> {
  return getCarnivoreBehavior(id);
}
