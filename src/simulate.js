#!/usr/bin/env node
'use strict';

const { runSimulation } = require('./simulator');
const { DEFAULT_CONFIG } = require('./config');

function parseArgs(argv) {
  const args = {
    ...DEFAULT_CONFIG,
    sweep: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--ticks') {
      args.ticks = Number(argv[++i]);
    } else if (token === '--size') {
      args.size = Number(argv[++i]);
    } else if (token === '--seed') {
      args.seed = String(argv[++i]);
    } else if (token === '--plants') {
      args.initialPlants = Number(argv[++i]);
    } else if (token === '--herbivores') {
      args.initialHerbivores = Number(argv[++i]);
    } else if (token === '--carnivores') {
      args.initialCarnivores = Number(argv[++i]);
    } else if (token === '--lid') {
      const mode = String(argv[++i]).toLowerCase();
      args.lidOpen = mode === 'open';
    } else if (token === '--sweep') {
      args.sweep = true;
    }
  }

  return args;
}

function printRun(result) {
  const start = result.history[0] || result.finalState;
  const end = result.finalState;

  console.log('Simulation summary');
  console.log('------------------');
  console.log(
    `Outcome: ${result.outcome.type.toUpperCase()} (${result.outcome.reason})`,
  );
  console.log(`Final tick: ${result.finalTick}`);
  console.log(`O2: ${start.o2} -> ${end.o2}`);
  console.log(`CO2: ${start.co2} -> ${end.co2}`);
  console.log(`Plants: ${start.plants} -> ${end.plants}`);
  console.log(`Herbivores: ${start.herbivores} -> ${end.herbivores}`);
  console.log(`Carnivores: ${start.carnivores} -> ${end.carnivores}`);
  console.log(`Avg water: ${start.avgWater} -> ${end.avgWater}`);
}

function runSweep(baseConfig) {
  const seeds = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
  const rows = [];

  for (let i = 0; i < seeds.length; i += 1) {
    const cfg = { ...baseConfig, seed: seeds[i] };
    const result = runSimulation(cfg);
    rows.push({
      seed: seeds[i],
      outcome: result.outcome.type,
      reason: result.outcome.reason,
      tick: result.finalTick,
      plants: result.finalState.plants,
      insects: result.finalState.insects,
      o2: result.finalState.o2,
      co2: result.finalState.co2,
    });
  }

  console.log('Sweep results');
  console.log('-------------');
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    console.log(
      `${row.seed.padEnd(8)} outcome=${row.outcome.padEnd(4)} tick=${String(row.tick).padEnd(3)} ` +
        `plants=${String(row.plants).padEnd(5)} insects=${String(row.insects).padEnd(5)} ` +
        `o2=${String(row.o2).padEnd(6)} co2=${String(row.co2).padEnd(6)} reason=${row.reason}`,
    );
  }
}

function main() {
  const config = parseArgs(process.argv.slice(2));

  if (config.sweep) {
    runSweep(config);
    return;
  }

  const result = runSimulation(config);
  printRun(result);
}

main();
