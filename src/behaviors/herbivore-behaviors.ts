import type { HerbivoreBehaviorId, InsectBehaviorStrategy } from './behavior';
import type { Herbivore } from '@/entities/insects';
import { DefaultHerbivoreBehavior } from './herbivore/default-herbivore-behavior';
import { ForagerHerbivoreBehavior } from './herbivore/forager-herbivore-behavior';

const HERBIVORE_BEHAVIORS: Record<HerbivoreBehaviorId, InsectBehaviorStrategy<Herbivore>> = {
  default: new DefaultHerbivoreBehavior(),
  forager: new ForagerHerbivoreBehavior(),
};

export function getHerbivoreBehavior(id: HerbivoreBehaviorId): InsectBehaviorStrategy<Herbivore> {
  return HERBIVORE_BEHAVIORS[id] ?? HERBIVORE_BEHAVIORS.default;
}
