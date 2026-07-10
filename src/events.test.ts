import { describe, expect, it } from 'vitest';

import { formatSimulationEvent, type SimulationEvent } from './events';

describe('formatSimulationEvent', () => {
  const cases: Array<{ event: SimulationEvent; message: string }> = [
    {
      event: { type: 'cycle', phase: 'day', light: 100 },
      message: 'cycle: day light=100',
    },
    {
      event: { type: 'weather-rain', cells: 42 },
      message: 'weather: rain cells=42',
    },
    {
      event: { type: 'weather-drought', cells: 11 },
      message: 'weather: drought cells=11',
    },
    {
      event: { type: 'plants-born', count: 5 },
      message: 'plants: born=5',
    },
    {
      event: { type: 'plants-died', count: 6 },
      message: 'plants: died=6',
    },
    {
      event: { type: 'herbivores-born', count: 7 },
      message: 'herbivores: born=7',
    },
    {
      event: { type: 'carnivores-born', count: 8 },
      message: 'carnivores: born=8',
    },
    {
      event: { type: 'herbivores-died', count: 9 },
      message: 'herbivores: died=9',
    },
    {
      event: { type: 'carnivores-died', count: 10 },
      message: 'carnivores: died=10',
    },
    {
      event: { type: 'predation-kills', count: 12 },
      message: 'predation: herbivore-kills=12',
    },
    {
      event: { type: 'rival-kills', count: 3 },
      message: 'combat: carnivore-kills=3',
    },
    {
      event: { type: 'warning-low-o2', streak: 1 },
      message: 'warning: low-o2 streak=1',
    },
    {
      event: { type: 'warning-high-co2', streak: 2 },
      message: 'warning: high-co2 streak=2',
    },
    {
      event: { type: 'warning-low-water', streak: 3 },
      message: 'warning: low-water streak=3',
    },
  ];

  it.each(cases)('formats $event.type', ({ event, message }) => {
    expect(formatSimulationEvent(event)).toBe(message);
  });
});
