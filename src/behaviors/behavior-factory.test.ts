import { describe, expect, it } from 'vitest';

import {
  AggressiveCarnivoreBehavior,
  DefaultCarnivoreBehavior,
  DefaultHerbivoreBehavior,
  ForagerHerbivoreBehavior,
  PassiveCarnivoreBehavior,
  resolveCarnivoreBehavior,
  resolveHerbivoreBehavior,
} from './index';

describe('behavior factory', () => {
  it('resolves known herbivore behavior ids', () => {
    expect(resolveHerbivoreBehavior('default')).toBeInstanceOf(
      DefaultHerbivoreBehavior,
    );
    expect(resolveHerbivoreBehavior('forager')).toBeInstanceOf(
      ForagerHerbivoreBehavior,
    );
  });

  it('falls back to default herbivore strategy for unknown ids', () => {
    expect(resolveHerbivoreBehavior('invalid' as never)).toBeInstanceOf(
      DefaultHerbivoreBehavior,
    );
  });

  it('resolves known carnivore behavior ids', () => {
    expect(resolveCarnivoreBehavior('default')).toBeInstanceOf(
      DefaultCarnivoreBehavior,
    );
    expect(resolveCarnivoreBehavior('aggressive')).toBeInstanceOf(
      AggressiveCarnivoreBehavior,
    );
    expect(resolveCarnivoreBehavior('passive')).toBeInstanceOf(
      PassiveCarnivoreBehavior,
    );
  });

  it('falls back to default carnivore strategy for unknown ids', () => {
    expect(resolveCarnivoreBehavior('invalid' as never)).toBeInstanceOf(
      DefaultCarnivoreBehavior,
    );
  });
});
