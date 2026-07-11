#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parse as parseYaml } from 'yaml';

import {
  getDefaultConfig,
  type DeepPartial,
  type SimulationConfig,
} from './config';
import {
  runSimulation,
  Simulator,
  type Outcome,
  type ReplayFrame,
  type ReplayPayload,
  type SimulationResult,
} from './simulator';

type SimulationCliConfig = SimulationConfig & {
  sweep: boolean;
  sweepSeeds: string[];
  sweepCsvPath: string | null;
  sweepMatrixConfigPaths: string[];
  stream: boolean;
  replayPath: string | null;
  recordJsonPath: string | null;
  recordJsonCompressed: boolean;
  recordCsvPath: string | null;
  autoplay: boolean;
  emojiMode: boolean;
  autoFit: boolean;
  nativeSize: boolean;
  replayFps: number;
  previewWidth: number;
  previewHeight: number;
  previewWidthSet: boolean;
  previewHeightSet: boolean;
};

type ReplayRecording = {
  recordingType: 'terrarium-tick-replay';
  replay: ReplayPayload;
  outcome: Outcome;
  config: SimulationConfig;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function applyConfigOverrides<T extends Record<string, unknown>>(
  target: T,
  overrides: DeepPartial<T>,
): T {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;

    const targetValue = target[key as keyof T];
    if (isRecord(targetValue) && isRecord(value)) {
      applyConfigOverrides(
        targetValue as Record<string, unknown>,
        value as DeepPartial<Record<string, unknown>>,
      );
      continue;
    }

    target[key as keyof T] = value as T[keyof T];
  }

  return target;
}

function parseConfigFile(
  raw: string,
  filePath: string,
): DeepPartial<SimulationConfig> {
  const ext = path.extname(filePath).toLowerCase();
  const parsed: unknown =
    ext === '.yaml' || ext === '.yml'
      ? parseYaml(raw)
      : ext === '.json'
        ? JSON.parse(raw)
        : (() => {
            try {
              return JSON.parse(raw);
            } catch {
              return parseYaml(raw);
            }
          })();

  if (!isRecord(parsed)) {
    throw new Error(`Invalid config file: expected an object in ${filePath}`);
  }

  return parsed as DeepPartial<SimulationConfig>;
}

function loadConfigOverrides(filePath: string): DeepPartial<SimulationConfig> {
  const resolvedPath = path.resolve(filePath);
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  return parseConfigFile(raw, resolvedPath);
}

function parseArgs(argv: string[]): SimulationCliConfig {
  const args: SimulationCliConfig = {
    ...getDefaultConfig(),
    sweep: false,
    sweepSeeds: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
    sweepCsvPath: null,
    sweepMatrixConfigPaths: [],
    stream: false,
    replayPath: null,
    recordJsonPath: null,
    recordJsonCompressed: true,
    recordCsvPath: null,
    autoplay: false,
    emojiMode: true,
    autoFit: true,
    nativeSize: false,
    replayFps: 4,
    previewWidth: 64,
    previewHeight: 24,
    previewWidthSet: false,
    previewHeightSet: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--config') {
      const configPath = argv[++index];
      if (!configPath) {
        throw new Error('Missing value for --config');
      }
      applyConfigOverrides(args, loadConfigOverrides(configPath));
    }
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--config') {
      index += 1;
    } else if (token === '--ticks') {
      args.world.ticks = Number(argv[++index]);
    } else if (token === '--size') {
      args.world.size = Number(argv[++index]);
    } else if (token === '--seed') {
      args.world.seed = String(argv[++index]);
    } else if (token === '--plants') {
      args.plants.initialCount = Number(argv[++index]);
    } else if (token === '--herbivores') {
      args.insects.herbivores.initialCount = Number(argv[++index]);
    } else if (token === '--carnivores') {
      args.insects.carnivores.initialCount = Number(argv[++index]);
    } else if (token === '--lid') {
      const mode = String(argv[++index]).toLowerCase();
      args.world.lidOpen = mode === 'open';
    } else if (token === '--day-ticks') {
      args.climate.dayTicks = Number(argv[++index]);
    } else if (token === '--night-ticks') {
      args.climate.nightTicks = Number(argv[++index]);
    } else if (token === '--sweep') {
      args.sweep = true;
    } else if (token === '--sweep-seeds') {
      const raw = String(argv[++index] ?? '');
      args.sweepSeeds = raw
        .split(',')
        .map((seed) => seed.trim())
        .filter((seed) => seed.length > 0);
    } else if (token === '--sweep-csv') {
      args.sweepCsvPath = String(argv[++index]);
    } else if (token === '--sweep-matrix-configs') {
      const raw = String(argv[++index] ?? '');
      args.sweepMatrixConfigPaths = raw
        .split(',')
        .map((configPath) => configPath.trim())
        .filter((configPath) => configPath.length > 0);
    } else if (token === '--stream') {
      args.stream = true;
    } else if (token === '--record-json') {
      args.recordJsonPath = String(argv[++index]);
    } else if (token === '--record-json-gzip') {
      args.recordJsonCompressed = true;
    } else if (token === '--record-json-plain') {
      args.recordJsonCompressed = false;
    } else if (token === '--record-csv') {
      args.recordCsvPath = String(argv[++index]);
    } else if (token === '--replay') {
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) {
        args.replayPath = String(next);
        index += 1;
      } else {
        args.replayPath = 'latest';
      }
    } else if (token === '--autoplay') {
      args.autoplay = true;
    } else if (token === '--emoji') {
      args.emojiMode = true;
    } else if (token === '--ascii') {
      args.emojiMode = false;
    } else if (token === '--auto-fit') {
      args.autoFit = true;
    } else if (token === '--no-auto-fit') {
      args.autoFit = false;
    } else if (token === '--native-size') {
      args.nativeSize = true;
    } else if (token === '--fps') {
      args.replayFps = Number(argv[++index]);
    } else if (token === '--preview-width') {
      args.previewWidth = Number(argv[++index]);
      args.previewWidthSet = true;
    } else if (token === '--preview-height') {
      args.previewHeight = Number(argv[++index]);
      args.previewHeightSet = true;
    }
  }

  return args;
}

function ensureParentDir(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function writeCsv(result: SimulationResult, filePath: string): void {
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

  for (let index = 0; index < result.history.length; index += 1) {
    const snapshot = result.history[index];
    rows.push(
      [
        snapshot.tick,
        snapshot.day,
        snapshot.light,
        snapshot.o2,
        snapshot.co2,
        snapshot.plants,
        snapshot.herbivores,
        snapshot.carnivores,
        snapshot.insects,
        snapshot.avgWater,
        snapshot.drinkableCells,
      ].join(','),
    );
  }

  fs.writeFileSync(filePath, `${rows.join('\n')}\n`, 'utf8');
}

function resolveJsonOutputPath(filePath: string, compressed: boolean): string {
  if (!compressed) {
    return filePath;
  }
  return filePath.endsWith('.gz') ? filePath : `${filePath}.gz`;
}

function writeJsonRecording(
  result: SimulationResult,
  filePath: string,
  compressed = true,
): string {
  const resolvedPath = resolveJsonOutputPath(filePath, compressed);
  ensureParentDir(resolvedPath);
  const payload: ReplayRecording = {
    recordingType: 'terrarium-tick-replay',
    replay: result.replay!,
    outcome: result.outcome,
    config: result.config,
  };
  const json = JSON.stringify(payload);

  if (compressed) {
    fs.writeFileSync(resolvedPath, zlib.gzipSync(json));
  } else {
    fs.writeFileSync(resolvedPath, json, 'utf8');
  }

  return resolvedPath;
}

function loadReplay(filePath: string): ReplayRecording {
  const buffer = fs.readFileSync(filePath);
  const raw = filePath.endsWith('.gz')
    ? zlib.gunzipSync(buffer).toString('utf8')
    : buffer.toString('utf8');
  const parsed = JSON.parse(raw) as ReplayRecording;
  if (!parsed || !parsed.replay || !Array.isArray(parsed.replay.frames)) {
    throw new Error('Invalid replay file: expected replay.frames array');
  }
  return parsed;
}

function findLatestReplayFile(dirPath: string): string | null {
  if (!fs.existsSync(dirPath)) {
    return null;
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith('.json') || name.endsWith('.json.gz'))
    .map((name) => {
      const fullPath = path.join(dirPath, name);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return files.length ? files[0].fullPath : null;
}

function resolveReplayPath(replayPath: string | null): string {
  if (replayPath && replayPath !== 'latest') {
    if (fs.existsSync(replayPath)) {
      return replayPath;
    }

    if (!replayPath.endsWith('.gz') && fs.existsSync(`${replayPath}.gz`)) {
      return `${replayPath}.gz`;
    }

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

function terrainChar(value: number): string {
  if (value === 0) return '.';
  if (value === 1) return '~';
  if (value === 2) return ':';
  return ' ';
}

function terrainEmoji(value: number): string {
  if (value === 0) return '🟫';
  if (value === 1) return '🟦';
  if (value === 2) return '🟨';
  return '⬛';
}

function resolveReplayViewport(
  config: SimulationCliConfig,
  emojiMode: boolean,
  worldSize: number,
): { width: number; height: number } {
  if (config.nativeSize) {
    return { width: worldSize, height: worldSize };
  }

  const baseWidth = Math.max(24, config.previewWidth);
  const baseHeight = Math.max(10, config.previewHeight);

  if (
    config.autoFit &&
    emojiMode &&
    !config.previewWidthSet &&
    !config.previewHeightSet
  ) {
    return { width: 40, height: 12 };
  }

  return { width: baseWidth, height: baseHeight };
}

function renderFrame(
  replayPayload: ReplayRecording,
  frameIndex: number,
  width: number,
  height: number,
  playback: {
    isPlaying?: boolean;
    fps?: number;
    emojiMode?: boolean;
  } = {},
): void {
  const replay = replayPayload.replay;
  const frame = replay.frames[frameIndex];
  const size = replay.size;
  const map = new Array<string>(width * height).fill(' ');
  const useEmoji = Boolean(playback.emojiMode);
  const terrainSymbol = useEmoji ? terrainEmoji : terrainChar;

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const worldX = Math.floor((px / width) * size);
      const worldY = Math.floor((py / height) * size);
      const worldIndex = worldY * size + worldX;
      map[py * width + px] = terrainSymbol(replay.terrain[worldIndex]);
    }
  }

  const overlay = (cells: number[], marker: string): void => {
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      const worldX = cell % size;
      const worldY = Math.floor(cell / size);
      const px = Math.min(width - 1, Math.floor((worldX / size) * width));
      const py = Math.min(height - 1, Math.floor((worldY / size) * height));
      map[py * width + px] = marker;
    }
  };

  overlay(frame.plants, useEmoji ? '🌿' : '*');
  overlay(frame.herbivores, useEmoji ? '🐛' : 'h');
  overlay(frame.carnivores, useEmoji ? '🦂' : 'C');
  overlay(frame.insectEggs || [], useEmoji ? '🥚' : 'o');

  const lines: string[] = [];
  lines.push(
    `Tick ${String(frame.tick).padStart(3)} / ${replay.frames.length - 1}   ` +
      `O2=${frame.o2.toFixed(2)} CO2=${frame.co2.toFixed(2)}   ` +
      `P=${frame.plants.length} H=${frame.herbivores.length} C=${frame.carnivores.length}`,
  );
  lines.push(
    useEmoji
      ? 'Legend: 🟫 soil  🟦 water  🟨 sand  ⬛ empty  🌿 plant  🐛 herbivore  🦂 carnivore  🥚 egg'
      : 'Legend: . soil  ~ water  : sand  [space] empty  * plant  h herbivore  C carnivore  o egg',
  );
  lines.push(
    `Playback: ${playback.isPlaying ? 'auto' : 'manual'} @ ${playback.fps ?? 4} fps`,
  );
  lines.push(`Render mode: ${useEmoji ? 'emoji' : 'ascii'}`);
  lines.push(
    `Board view: ${width}x${height} ${width === size && height === size ? '(native)' : `(sampled from ${size}x${size})`}`,
  );
  lines.push(
    'Controls: Left/Right step, Space autoplay, Up/Down speed, Home/End jump, e mode, n viewport, q quits.',
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
    for (
      let index = 0;
      index < Math.min(maxEvents, tickEvents.length);
      index += 1
    ) {
      lines.push(`  - ${tickEvents[index]}`);
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

  for (let index = startTickIndex; index < frameIndex; index += 1) {
    const historyFrame = replay.frames[index];
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

function renderLiveFrame(
  frame: {
    tick: number;
    o2: number;
    co2: number;
    plants: number[];
    herbivores: number[];
    carnivores: number[];
    insectEggs?: number[];
    events?: string[];
  },
  meta: {
    tick: number;
    totalTicks: number;
    size: number;
    terrain: Uint8Array;
  },
  width: number,
  height: number,
  playback: {
    fps: number;
    emojiMode: boolean;
  },
  previousFrames: Array<{
    tick: number;
    events?: string[];
  }>,
): void {
  const map = new Array<string>(width * height).fill(' ');
  const useEmoji = playback.emojiMode;
  const terrainSymbol = useEmoji ? terrainEmoji : terrainChar;

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const worldX = Math.floor((px / width) * meta.size);
      const worldY = Math.floor((py / height) * meta.size);
      const worldIndex = worldY * meta.size + worldX;
      map[py * width + px] = terrainSymbol(meta.terrain[worldIndex]);
    }
  }

  const overlay = (cells: number[], marker: string): void => {
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      const worldX = cell % meta.size;
      const worldY = Math.floor(cell / meta.size);
      const px = Math.min(width - 1, Math.floor((worldX / meta.size) * width));
      const py = Math.min(
        height - 1,
        Math.floor((worldY / meta.size) * height),
      );
      map[py * width + px] = marker;
    }
  };

  overlay(frame.plants, useEmoji ? '🌿' : '*');
  overlay(frame.herbivores, useEmoji ? '🐛' : 'h');
  overlay(frame.carnivores, useEmoji ? '🦂' : 'C');
  overlay(frame.insectEggs || [], useEmoji ? '🥚' : 'o');

  const lines: string[] = [];
  lines.push(
    `Tick ${String(meta.tick).padStart(3)} / ${meta.totalTicks}   ` +
      `O2=${frame.o2.toFixed(2)} CO2=${frame.co2.toFixed(2)}   ` +
      `P=${frame.plants.length} H=${frame.herbivores.length} C=${frame.carnivores.length}`,
  );
  lines.push(
    useEmoji
      ? 'Legend: 🟫 soil  🟦 water  🟨 sand  ⬛ empty  🌿 plant  🐛 herbivore  🦂 carnivore  🥚 egg'
      : 'Legend: . soil  ~ water  : sand  [space] empty  * plant  h herbivore  C carnivore  o egg',
  );
  lines.push(`Playback: stream @ ${playback.fps} fps`);
  lines.push(`Render mode: ${useEmoji ? 'emoji' : 'ascii'}`);
  lines.push(
    `Board view: ${width}x${height} ${width === meta.size && height === meta.size ? '(native)' : `(sampled from ${meta.size}x${meta.size})`}`,
  );
  lines.push(
    'Controls: Right/Enter step, Space autoplay, Up/Down speed, e mode, n viewport, q quits.',
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
    for (
      let index = 0;
      index < Math.min(maxEvents, tickEvents.length);
      index += 1
    ) {
      lines.push(`  - ${tickEvents[index]}`);
    }
    if (tickEvents.length > maxEvents) {
      lines.push(`  - ... ${tickEvents.length - maxEvents} more`);
    }
  }

  lines.push('');
  lines.push('Recent Event History (previous ticks):');
  let historyPrinted = false;
  for (let index = 0; index < previousFrames.length; index += 1) {
    const historyFrame = previousFrames[index];
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

function runStream(config: SimulationCliConfig): Promise<void> {
  return new Promise((resolve) => {
    const viewport = resolveReplayViewport(
      config,
      config.emojiMode,
      config.world.size,
    );
    const simulator = new Simulator(config);
    const initialState = simulator.snapshot();
    const shouldCaptureReplay = Boolean(config.recordJsonPath);
    const replayFrames: ReplayFrame[] = shouldCaptureReplay
      ? [simulator.buildReplayFrame(initialState)]
      : [];

    let fps = Math.max(1, Number(config.replayFps) || 4);
    let isPlaying = true;
    let emojiMode = config.emojiMode;
    let nativeSize = config.nativeSize;
    let timer: NodeJS.Timeout | null = null;
    let isDone = false;

    const sampledAsciiViewport = {
      width: viewport.width,
      height: viewport.height,
    };
    const sampledEmojiViewport = config.autoFit
      ? {
          width: Math.min(sampledAsciiViewport.width, 40),
          height: Math.min(sampledAsciiViewport.height, 12),
        }
      : sampledAsciiViewport;

    let renderWidth = viewport.width;
    let renderHeight = viewport.height;

    const updateViewport = (): void => {
      if (nativeSize) {
        renderWidth = simulator.world.size;
        renderHeight = simulator.world.size;
        return;
      }

      renderWidth = emojiMode
        ? sampledEmojiViewport.width
        : sampledAsciiViewport.width;
      renderHeight = emojiMode
        ? sampledEmojiViewport.height
        : sampledAsciiViewport.height;
    };

    const previousFrames: Array<{
      tick: number;
      events?: string[];
    }> = [];

    const buildMeta = (): {
      tick: number;
      totalTicks: number;
      size: number;
      terrain: Uint8Array;
    } => ({
      tick: simulator.tick,
      totalTicks: simulator.config.world.ticks,
      size: simulator.world.size,
      terrain: simulator.world.terrain,
    });

    const currentFrame = (): ReplayFrame => {
      if (simulator.tick === 0) {
        return simulator.buildReplayFrame(initialState);
      }
      return simulator.buildReplayFrame(
        simulator.history[simulator.history.length - 1],
      );
    };

    const draw = (): void => {
      renderLiveFrame(
        currentFrame(),
        buildMeta(),
        renderWidth,
        renderHeight,
        {
          fps,
          emojiMode,
        },
        previousFrames,
      );
    };

    const stopAuto = (): void => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      isPlaying = false;
    };

    const finish = (abortedByUser = false): void => {
      if (isDone) {
        return;
      }
      isDone = true;
      stopAuto();
      cleanupInput();

      if (abortedByUser) {
        console.log(`Stream stopped at tick ${simulator.tick}.`);
        resolve();
        return;
      }

      simulator.finalizeOutcomeIfNeeded();

      const result: SimulationResult = {
        config,
        outcome: simulator.outcome!,
        finalTick: simulator.tick,
        initialState,
        finalState: simulator.snapshot(),
        history: simulator.history,
        diagnostics: {
          herbivoreBirths: simulator.totalStats.herbivoreBirths,
          carnivoreBirths: simulator.totalStats.carnivoreBirths,
          herbivoreDeaths: simulator.totalStats.herbivoreDeaths,
          carnivoreDeaths: simulator.totalStats.carnivoreDeaths,
          herbivoreKillsByCarnivores:
            simulator.totalStats.herbivoreKillsByCarnivores,
          carnivoreKillsByCarnivores:
            simulator.totalStats.carnivoreKillsByCarnivores,
        },
        replay: shouldCaptureReplay
          ? {
              version: 1,
              generatedAt: new Date().toISOString(),
              size: simulator.world.size,
              terrain: Array.from(simulator.world.terrain),
              frames: replayFrames,
            }
          : null,
      };

      printRun(result);

      if (config.recordCsvPath) {
        writeCsv(result, config.recordCsvPath);
        console.log(`CSV written: ${config.recordCsvPath}`);
      }

      if (config.recordJsonPath) {
        const writtenPath = writeJsonRecording(
          result,
          config.recordJsonPath,
          config.recordJsonCompressed,
        );
        console.log(`Replay JSON written: ${writtenPath}`);
      }

      resolve();
    };

    const tickOnce = (): void => {
      if (isDone) {
        return;
      }

      if (simulator.outcome || simulator.tick >= simulator.config.world.ticks) {
        finish();
        return;
      }

      simulator.step();
      simulator.finalizeOutcomeIfNeeded();

      const frame = simulator.buildReplayFrame(
        simulator.history[simulator.history.length - 1],
      );
      if (shouldCaptureReplay) {
        replayFrames.push(frame);
      }

      draw();

      previousFrames.push({ tick: frame.tick, events: frame.events });
      if (previousFrames.length > 5) {
        previousFrames.shift();
      }

      if (simulator.outcome || simulator.tick >= simulator.config.world.ticks) {
        finish();
      }
    };

    const startAuto = (): void => {
      stopAuto();
      isPlaying = true;
      timer = setInterval(tickOnce, Math.round(1000 / fps));
    };

    const stdin = process.stdin;
    let inputReady = false;

    const cleanupInput = (): void => {
      if (!inputReady) {
        return;
      }
      stdin.removeListener('data', onKey);
      stdin.setRawMode(false);
      stdin.pause();
      inputReady = false;
    };

    const onKey = (key: string): void => {
      if (key === '\u0003' || key === 'q') {
        finish(true);
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

      if (key === '\r' || key === '\n' || key === '\u001b[C') {
        stopAuto();
        tickOnce();
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

      if (key === '\u001b[B') {
        fps = Math.max(1, fps - 1);
        if (isPlaying) {
          startAuto();
        }
        draw();
        return;
      }

      if (key === 'e' || key === 'E') {
        emojiMode = !emojiMode;
        updateViewport();
        draw();
        return;
      }

      if (key === 'n' || key === 'N') {
        nativeSize = !nativeSize;
        updateViewport();
        draw();
      }
    };

    updateViewport();
    draw();

    if (process.stdin.isTTY) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      stdin.on('data', onKey);
      inputReady = true;
    }

    startAuto();
  });
}

function startReplayInteractive(
  replayPayload: ReplayRecording,
  width: number,
  height: number,
  options: {
    autoplay?: boolean;
    emojiMode?: boolean;
    nativeSize?: boolean;
    autoFit?: boolean;
    fps?: number;
  } = {},
): void {
  let index = 0;
  let isPlaying = Boolean(options.autoplay);
  let emojiMode = Boolean(options.emojiMode);
  let nativeSize = Boolean(options.nativeSize);
  let fps = Math.max(1, Number(options.fps) || 4);
  let timer: NodeJS.Timeout | null = null;
  const worldSize = replayPayload.replay.size;
  const sampledAsciiViewport = {
    width,
    height,
  };
  const sampledEmojiViewport = options.autoFit
    ? {
        width: Math.min(width, 40),
        height: Math.min(height, 12),
      }
    : sampledAsciiViewport;

  let renderWidth = width;
  let renderHeight = height;

  const updateViewport = (): void => {
    if (nativeSize) {
      renderWidth = worldSize;
      renderHeight = worldSize;
      return;
    }

    renderWidth = emojiMode
      ? sampledEmojiViewport.width
      : sampledAsciiViewport.width;
    renderHeight = emojiMode
      ? sampledEmojiViewport.height
      : sampledAsciiViewport.height;
  };

  updateViewport();

  const draw = (): void => {
    renderFrame(replayPayload, index, renderWidth, renderHeight, {
      isPlaying,
      fps,
      emojiMode,
    });
  };

  const stopAuto = (): void => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isPlaying = false;
  };

  const startAuto = (): void => {
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

  const cleanup = (): void => {
    stopAuto();
    stdin.removeListener('data', onKey);
    stdin.setRawMode(false);
    stdin.pause();
  };

  const onKey = (key: string): void => {
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
    if (key === 'e' || key === 'E') {
      emojiMode = !emojiMode;
      updateViewport();
      draw();
      return;
    }
    if (key === 'n' || key === 'N') {
      nativeSize = !nativeSize;
      updateViewport();
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

function collectRunDiagnostics(result: SimulationResult): {
  eggFramesAfter10: number;
  maxEggs: number;
} {
  const history = Array.isArray(result.history) ? result.history : [];
  const eggFramesAfter10 = history.filter(
    (snapshot) => snapshot.tick >= 10 && Number(snapshot.eggs || 0) > 0,
  ).length;
  const maxEggs = history.reduce(
    (max, snapshot) => Math.max(max, Number(snapshot.eggs || 0)),
    0,
  );

  return {
    eggFramesAfter10,
    maxEggs,
  };
}

function printRun(result: SimulationResult): void {
  const start = result.history[0] || result.finalState;
  const end = result.finalState;
  const diagnostics = result.diagnostics || {
    herbivoreBirths: 0,
    carnivoreBirths: 0,
    herbivoreDeaths: 0,
    carnivoreDeaths: 0,
    herbivoreKillsByCarnivores: 0,
    carnivoreKillsByCarnivores: 0,
  };
  const derived = collectRunDiagnostics(result);

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
  console.log('Diagnostics');
  console.log('-----------');
  console.log(
    `Births H/C: ${diagnostics.herbivoreBirths ?? 0} / ${diagnostics.carnivoreBirths ?? 0}`,
  );
  console.log(
    `Deaths H/C: ${diagnostics.herbivoreDeaths ?? 0} / ${diagnostics.carnivoreDeaths ?? 0}`,
  );
  console.log(
    `Predation kills: ${diagnostics.herbivoreKillsByCarnivores ?? 0} (rival carnivore kills: ${diagnostics.carnivoreKillsByCarnivores ?? 0})`,
  );
  console.log(
    `Egg visibility: frames>=10 with eggs=${derived.eggFramesAfter10}, max eggs in a tick=${derived.maxEggs}`,
  );
}

type SweepRow = {
  seed: string;
  outcome: string;
  reason: string;
  tick: number;
  plants: number;
  herbivores: number;
  carnivores: number;
  insects: number;
  o2: number;
  co2: number;
};

function executeSweepRows(config: SimulationConfig, seeds: string[]): SweepRow[] {
  if (seeds.length === 0) {
    throw new Error('Sweep requires at least one seed. Use --sweep-seeds a,b,c');
  }

  const rows: SweepRow[] = [];

  for (let index = 0; index < seeds.length; index += 1) {
    const sweepConfig = structuredClone(config);
    sweepConfig.world.seed = seeds[index];
    const result = runSimulation(sweepConfig);
    rows.push({
      seed: seeds[index],
      outcome: result.outcome.type,
      reason: result.outcome.reason,
      tick: result.finalTick,
      plants: result.finalState.plants,
      herbivores: result.finalState.herbivores,
      carnivores: result.finalState.carnivores,
      insects: result.finalState.insects,
      o2: result.finalState.o2,
      co2: result.finalState.co2,
    });
  }

  return rows;
}

function printSweepRows(rows: SweepRow[]): void {
  console.log('Sweep results');
  console.log('-------------');
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    console.log(
      `${row.seed.padEnd(8)} outcome=${row.outcome.padEnd(4)} tick=${String(row.tick).padEnd(3)} ` +
        `plants=${String(row.plants).padEnd(5)} herbivores=${String(row.herbivores).padEnd(5)} ` +
        `carnivores=${String(row.carnivores).padEnd(5)} insects=${String(row.insects).padEnd(5)} ` +
        `o2=${String(row.o2).padEnd(6)} co2=${String(row.co2).padEnd(6)} reason=${row.reason}`,
    );
  }
}

function writeSweepCsv(rows: SweepRow[], filePath: string, scenarioLabel?: string): void {
  ensureParentDir(filePath);
  const header = scenarioLabel
    ? 'scenario,seed,outcome,reason,finalTick,plants,herbivores,carnivores,insects,o2,co2'
    : 'seed,outcome,reason,finalTick,plants,herbivores,carnivores,insects,o2,co2';
  const lines = [
    header,
    ...rows.map((row) =>
      [
        ...(scenarioLabel ? [scenarioLabel] : []),
        row.seed,
        row.outcome,
        row.reason,
        row.tick,
        row.plants,
        row.herbivores,
        row.carnivores,
        row.insects,
        row.o2,
        row.co2,
      ].join(','),
    ),
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function runSweep(config: SimulationCliConfig): void {
  const rows = executeSweepRows(config, config.sweepSeeds);

  printSweepRows(rows);

  if (config.sweepCsvPath) {
    writeSweepCsv(rows, config.sweepCsvPath);
    console.log(`Sweep CSV written: ${config.sweepCsvPath}`);
  }
}

function runSweepMatrix(config: SimulationCliConfig): void {
  const matrixPaths = config.sweepMatrixConfigPaths;
  if (matrixPaths.length === 0) {
    throw new Error('Sweep matrix requires config files. Use --sweep-matrix-configs a.yaml,b.yaml');
  }

  const allRows: Array<SweepRow & { scenario: string }> = [];

  for (let index = 0; index < matrixPaths.length; index += 1) {
    const matrixPath = matrixPaths[index];
    const matrixLabel = path.basename(matrixPath).replace(/\.(ya?ml|json)$/i, '');

    const scenarioConfig = structuredClone(config);
    applyConfigOverrides(scenarioConfig, loadConfigOverrides(matrixPath));

    const rows = executeSweepRows(scenarioConfig, config.sweepSeeds);
    console.log(`Scenario: ${matrixLabel} (${matrixPath})`);
    printSweepRows(rows);

    for (const row of rows) {
      allRows.push({ scenario: matrixLabel, ...row });
    }
  }

  if (config.sweepCsvPath) {
    ensureParentDir(config.sweepCsvPath);
    const lines = [
      'scenario,seed,outcome,reason,finalTick,plants,herbivores,carnivores,insects,o2,co2',
      ...allRows.map((row) =>
        [
          row.scenario,
          row.seed,
          row.outcome,
          row.reason,
          row.tick,
          row.plants,
          row.herbivores,
          row.carnivores,
          row.insects,
          row.o2,
          row.co2,
        ].join(','),
      ),
    ];
    fs.writeFileSync(config.sweepCsvPath, `${lines.join('\n')}\n`, 'utf8');
    console.log(`Sweep matrix CSV written: ${config.sweepCsvPath}`);
  }
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));

  if (config.stream && config.replayPath) {
    throw new Error('Cannot combine --stream with --replay');
  }

  if (config.replayPath) {
    const replayFilePath = resolveReplayPath(config.replayPath);
    const replayPayload = loadReplay(replayFilePath);
    const viewport = resolveReplayViewport(
      config,
      config.emojiMode,
      replayPayload.replay.size,
    );
    console.log(`Replay file: ${replayFilePath}`);
    startReplayInteractive(replayPayload, viewport.width, viewport.height, {
      autoplay: config.autoplay,
      emojiMode: config.emojiMode,
      nativeSize: config.nativeSize,
      autoFit: config.autoFit,
      fps: config.replayFps,
    });
    return;
  }

  if (config.sweep) {
    if (config.sweepMatrixConfigPaths.length > 0) {
      runSweepMatrix(config);
    } else {
      runSweep(config);
    }
    return;
  }

  if (config.stream) {
    await runStream(config);
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
    const writtenPath = writeJsonRecording(
      result,
      config.recordJsonPath,
      config.recordJsonCompressed,
    );
    console.log(`Replay JSON written: ${writtenPath}`);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
