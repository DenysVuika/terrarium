import type { SimContext } from '../context.ts';

export interface InsectBehaviorStrategy<TInsect> {
  tick(entity: TInsect, ctx: SimContext): void;
}
