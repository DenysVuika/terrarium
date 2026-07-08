#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { runSimulation } = require('./simulator');
const { DEFAULT_CONFIG } = require('./config');

function parseArgs(argv) {
  const args = {
    ...DEFAULT_CONFIG,
    sweep: false,
    replayPath: null,
    recordJsonPath: null,
    recordCsvPath: null,
    autoplay: false,
    replayFps: 4,
    previewWidth: 64,
    previewHeight: 24,
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
    } else if (token === '--record-json') {
      args.recordJsonPath = String(argv[++i]);
    } else if (token === '--record-csv') {
      args.recordCsvPath = String(argv[++i]);
    } else if (token === '--replay') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.replayPath = String(next);
        i += 1;
      } else {
        args.replayPath = 'latest';
      }
    } else if (token === '--autoplay') {
      args.autoplay = true;
    } else if (token === '--fps') {
      args.replayFps = Number(argv[++i]);
    } else if (token === '--preview-width') {
      args.previewWidth = Number(argv[++i]);
    } else if (token === '--preview-height') {
      args.previewHeight = Number(argv[++i]);
    }
  }

  return args;
}

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function writeCsv(result, filePath) {
  ensureParentDir(filePath);
  const header = [
    'tick',
    'day',
    'light',
    'o2',
    'co2',
    'plants',
    'herbivores',
    'carnivores',
    'insects',
    'avgWater',
    'drinkableCells',
  ].join(',');

  const rows = [header];
  rows.push(
    [
      result.initialState.tick,
      result.initialState.day,
      result.initialState.light,
      result.initialState.o2,
      result.initialState.co2,
      result.initialState.plants,
      result.initialState.herbivores,
      result.initialState.carnivores,
      result.initialState.insects,
      result.initialState.avgWater,
      result.initialState.drinkableCells,
    ].join(','),
  );

  for (let i = 0; i < result.history.length; i += 1) {
    const s = result.history[i];
    rows.push(
      [
        s.tick,
        s.day,
        s.light,
        s.o2,
        s.co2,
        s.plants,
        s.herbivores,
        s.carnivores,
        s.insects,
        s.avgWater,
        s.drinkableCells,
      ].join(','),
    );
  }

  fs.writeFileSync(filePath, `${rows.join('\n')}\n`, 'utf8');
}

function writeJsonRecording(result, filePath) {
  ensureParentDir(filePath);
  const payload = {
    recordingType: 'terrarium-tick-replay',
    replay: result.replay,
    outcome: result.outcome,
    config: result.config,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
}

function loadReplay(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !parsed.replay || !Array.isArray(parsed.replay.frames)) {
    throw new Error('Invalid replay file: expected replay.frames array');
  }
  return parsed;
}

function findLatestReplayFile(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const fullPath = path.join(dirPath, name);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files.length ? files[0].fullPath : null;
}

function resolveReplayPath(replayPath) {
  if (replayPath && replayPath !== 'latest') {
    return replayPath;
  }

  const latest = findLatestReplayFile(path.join(process.cwd(), 'runs'));
  if (latest) {
    return latest;
  }

  throw new Error(
    'No replay JSON found. Run: npm run simulate (or use --record-json <path>) before replay.',
  );
}

function terrainChar(value) {
  if (value === 0) return '.';
  if (value === 1) return '~';
  if (value === 2) return ':';
  return ' ';
}

function renderFrame(replayPayload, frameIndex, width, height, playback = {}) {
  const replay = replayPayload.replay;
  const frame = replay.frames[frameIndex];
  const size = replay.size;
  const map = new Array(width * height).fill(' ');

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const worldX = Math.floor((px / width) * size);
      const worldY = Math.floor((py / height) * size);
      const worldIndex = worldY * size + worldX;
      map[py * width + px] = terrainChar(replay.terrain[worldIndex]);
    }
  }

  const overlay = (cells, marker) => {
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const worldX = cell % size;
      const worldY = Math.floor(cell / size);
      const px = Math.min(width - 1, Math.floor((worldX / size) * width));
      const py = Math.min(height - 1, Math.floor((worldY / size) * height));
      map[py * width + px] = marker;
    }
  };

  overlay(frame.plants, '*');
  overlay(frame.herbivores, 'h');
  overlay(frame.carnivores, 'C');

  const lines = [];
  lines.push(
    `Tick ${String(frame.tick).padStart(3)} / ${replay.frames.length - 1}   ` +
      `O2=${frame.o2.toFixed(2)} CO2=${frame.co2.toFixed(2)}   ` +
      `P=${frame.plants.length} H=${frame.herbivores.length} C=${frame.carnivores.length}`,
  );
  lines.push(
    'Legend: . soil  ~ water  : sand  * plant  h herbivore  C carnivore',
  );
  lines.push(
    `Playback: ${playback.isPlaying ? 'auto' : 'manual'} @ ${playback.fps ?? 4} fps`,
  );
  lines.push(
    'Controls: Left/Right step, Space autoplay, Up/Down speed, Home/End jump, q quits.',
  );
  lines.push('');

  for (let py = 0; py < height; py += 1) {
    const start = py * width;
    lines.push(map.slice(start, start + width).join(''));
  }

  lines.push('');
  lines.push('Timeline (current tick):');
  const tickEvents = Array.isArray(frame.events) ? frame.events : [];
  if (tickEvents.length === 0) {
    lines.push('  - none');
  } else {
    const maxEvents = 8;
    for (let i = 0; i < Math.min(maxEvents, tickEvents.length); i += 1) {
      lines.push(`  - ${tickEvents[i]}`);
    }
    if (tickEvents.length > maxEvents) {
      lines.push(`  - ... ${tickEvents.length - maxEvents} more`);
    }
  }

  lines.push('');
  lines.push('Recent Event History (previous ticks):');
  const historyWindow = 5;
  const startTickIndex = Math.max(0, frameIndex - historyWindow);
  let historyPrinted = false;

  for (let i = startTickIndex; i < frameIndex; i += 1) {
    const historyFrame = replay.frames[i];
    const historyEvents = Array.isArray(historyFrame.events)
      ? historyFrame.events
      : [];
    if (historyEvents.length === 0) {
      continue;
    }

    historyPrinted = true;
    const preview = historyEvents.slice(0, 3).join(' | ');
    const suffix = historyEvents.length > 3 ? ' | ...' : '';
    lines.push(
      `  t=${String(historyFrame.tick).padStart(3)}: ${preview}${suffix}`,
    );
  }

  if (!historyPrinted) {
    lines.push('  - none');
  }

  process.stdout.write('\x1Bc');
  process.stdout.write(`${lines.join('\n')}\n`);
}

function startReplayInteractive(replayPayload, width, height, options = {}) {
  let index = 0;
  let isPlaying = Boolean(options.autoplay);
  let fps = Math.max(1, Number(options.fps) || 4);
  let timer = null;

  const draw = () => {
    renderFrame(replayPayload, index, width, height, { isPlaying, fps });
  };

  const stopAuto = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isPlaying = false;
  };

  const startAuto = () => {
    if (timer) {
      clearInterval(timer);
    }
    isPlaying = true;
    timer = setInterval(
      () => {
        if (index >= replayPayload.replay.frames.length - 1) {
          stopAuto();
          draw();
          return;
        }
        index += 1;
        draw();
      },
      Math.round(1000 / fps),
    );
  };

  draw();
  if (isPlaying) {
    startAuto();
  }

  if (!process.stdin.isTTY) {
    stopAuto();
    return;
  }

  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  const cleanup = () => {
    stopAuto();
    stdin.removeListener('data', onKey);
    stdin.setRawMode(false);
    stdin.pause();
  };

  const onKey = (key) => {
    if (key === '\u0003' || key === 'q') {
      cleanup();
      return;
    }
    if (key === ' ') {
      if (isPlaying) {
        stopAuto();
      } else {
        startAuto();
      }
      draw();
      return;
    }
    if (key === '\u001b[C') {
      stopAuto();
      index = Math.min(replayPayload.replay.frames.length - 1, index + 1);
      draw();
      return;
    }
    if (key === '\u001b[D') {
      stopAuto();
      index = Math.max(0, index - 1);
      draw();
      return;
    }
    if (key === '\u001b[A') {
      fps = Math.min(20, fps + 1);
      if (isPlaying) {
        startAuto();
      }
      draw();
      return;
    }
    if (key === '\u001b[H' || key === '\u001bOH') {
      stopAuto();
      index = 0;
      draw();
      return;
    }
    if (key === '\u001b[F' || key === '\u001bOF') {
      stopAuto();
      index = replayPayload.replay.frames.length - 1;
      draw();
      return;
    }
    if (key === '\u001b[B') {
      fps = Math.max(1, fps - 1);
      if (isPlaying) {
        startAuto();
      }
      draw();
    }
  };

  stdin.on('data', onKey);
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

  if (config.replayPath) {
    const replayFilePath = resolveReplayPath(config.replayPath);
    const replayPayload = loadReplay(replayFilePath);
    console.log(`Replay file: ${replayFilePath}`);
    startReplayInteractive(
      replayPayload,
      Math.max(24, config.previewWidth),
      Math.max(10, config.previewHeight),
      {
        autoplay: config.autoplay,
        fps: config.replayFps,
      },
    );
    return;
  }

  if (config.sweep) {
    runSweep(config);
    return;
  }

  const shouldCaptureReplay = Boolean(config.recordJsonPath);
  const result = runSimulation(config, { captureFrames: shouldCaptureReplay });
  printRun(result);

  if (config.recordCsvPath) {
    writeCsv(result, config.recordCsvPath);
    console.log(`CSV written: ${config.recordCsvPath}`);
  }

  if (config.recordJsonPath) {
    writeJsonRecording(result, config.recordJsonPath);
    console.log(`Replay JSON written: ${config.recordJsonPath}`);
  }
}

main();
