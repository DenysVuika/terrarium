import type {
  HerbivoreBehaviorId,
  InsectBehaviorStrategy,
} from './behavior.ts';
import type { Herbivore } from './herbivore.ts';
import { DefaultHerbivoreBehavior } from '../behaviors/herbivore/default-herbivore-behavior.ts';
import { ForagerHerbivoreBehavior } from '../behaviors/herbivore/forager-herbivore-behavior.ts';

const HERBIVORE_BEHAVIORS: Record<
  HerbivoreBehaviorId,
  InsectBehaviorStrategy<Herbivore>
> = {
  default: new DefaultHerbivoreBehavior(),
  forager: new ForagerHerbivoreBehavior(),
};

export function getHerbivoreBehavior(
  id: HerbivoreBehaviorId,
): InsectBehaviorStrategy<Herbivore> {
  return HERBIVORE_BEHAVIORS[id] ?? HERBIVORE_BEHAVIORS.default;
}
