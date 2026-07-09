import type { SimContext } from '../context.ts';

export type HerbivoreBehaviorId = 'default' | 'forager';
export type CarnivoreBehaviorId = 'default' | 'aggressive' | 'passive';

export interface InsectBehaviorStrategy<TInsect> {
  tick(entity: TInsect, ctx: SimContext): void;
}
