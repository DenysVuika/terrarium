import type { CarnivoreBehaviorId, HerbivoreBehaviorId, InsectBehaviorStrategy } from './behavior';
import type { Carnivore, Herbivore } from '@/entities/insects';
import { AggressiveCarnivoreBehavior } from './carnivore/aggressive-carnivore-behavior';
import { DefaultCarnivoreBehavior } from './carnivore/default-carnivore-behavior';
import { PassiveCarnivoreBehavior } from './carnivore/passive-carnivore-behavior';
import { DefaultHerbivoreBehavior } from './herbivore/default-herbivore-behavior';
import { ForagerHerbivoreBehavior } from './herbivore/forager-herbivore-behavior';

const HERBIVORE_BEHAVIORS: Record<HerbivoreBehaviorId, InsectBehaviorStrategy<Herbivore>> = {
  default: new DefaultHerbivoreBehavior(),
  forager: new ForagerHerbivoreBehavior(),
};

const CARNIVORE_BEHAVIORS: Record<CarnivoreBehaviorId, InsectBehaviorStrategy<Carnivore>> = {
  default: new DefaultCarnivoreBehavior(),
  aggressive: new AggressiveCarnivoreBehavior(),
  passive: new PassiveCarnivoreBehavior(),
};

export function resolveHerbivoreBehavior(id: HerbivoreBehaviorId): InsectBehaviorStrategy<Herbivore> {
  return HERBIVORE_BEHAVIORS[id] ?? HERBIVORE_BEHAVIORS.default;
}

export function resolveCarnivoreBehavior(id: CarnivoreBehaviorId): InsectBehaviorStrategy<Carnivore> {
  return CARNIVORE_BEHAVIORS[id] ?? CARNIVORE_BEHAVIORS.default;
}
