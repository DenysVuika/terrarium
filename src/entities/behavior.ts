import type { SimContext } from '../context.ts';

export type HerbivoreBehaviorId = 'default' | 'forager';
export type CarnivoreBehaviorId = 'default' | 'aggressive' | 'passive';

/** All valid herbivore behavior profile IDs, used for random selection at spawn. */
export const HERBIVORE_BEHAVIOR_IDS: HerbivoreBehaviorId[] = [
  'default',
  'forager',
];

/** All valid carnivore behavior profile IDs, used for random selection at spawn. */
export const CARNIVORE_BEHAVIOR_IDS: CarnivoreBehaviorId[] = [
  'default',
  'aggressive',
  'passive',
];

export interface InsectBehaviorStrategy<TInsect> {
  tick(entity: TInsect, ctx: SimContext): void;
}
