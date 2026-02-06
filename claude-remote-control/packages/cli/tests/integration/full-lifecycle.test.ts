/**
 * Full lifecycle integration test: init → start → stop
 *
 * This test verifies the complete user journey works end-to-end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockPaths,
  createMockFsState,
  createMockChild,
  createProcessKillMock,
  captureConsole,
  setupDefaultDirectories,
  setupAgentEntryPoint,
  type MockFsState,
  type CapturedOutput,
} from '../helpers/mock-system.js';

// ============= MOCK SETUP =============

let fsState: MockFsState;
let runningPids: Set<number>;
let promptResponses: unknown[];
let output: CapturedOutput;
let processExitSpy: ReturnType<typeof vi.spyOn>;
const originalKill = process.kill;

// Mock paths module
vi.mock('../../src/lib/paths.js', () => ({
  getAgentPaths: () => mockPaths,
  ensureDirectories: vi.fn(() => {
    fsState.directories.add(mockPaths.configDir);
    fsState.directories.add(mockPaths.dataDir);
    fsState.directories.add(mockPaths.logDir);
  }),
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => fsState?.files.has(path) || fsState?.directories.has(path)),
  readFileSync: vi.fn((path: string) => {
    const content = fsState?.files.get(path);
    if (content === undefined) throw new Error('ENOENT');
    return content;
  }),
  writeFileSync: vi.fn((path: string, content: string) => {
    fsState?.files.set(path, content);
  }),
  mkdirSync: vi.fn((path: string) => {
    fsState?.directories.add(path);
  }),
  unlinkSync: vi.fn((path: string) => {
    fsState?.files.delete(path);
  }),
  readdirSync: vi.fn(() => []),
  lstatSync: vi.fn(() => ({ isSymbolicLink: () => false })),
  rmSync: vi.fn(),
  copyFileSync: vi.fn(),
  symlinkSync: vi.fn(),
  openSync: vi.fn(() => 3),
}));

// Mock crypto
vi.mock('crypto', () => ({
  randomUUID: () => 'lifecycle-test-uuid',
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => 'tmux 3.4'),
}));

// Mock os
vi.mock('os', () => ({
  hostname: () => 'test-hostname',
  platform: () => 'darwin',
  homedir: () => '/mock',
}));

// Mock enquirer
vi.mock('enquirer', () => ({
  default: {
    prompt: vi.fn(() => Promise.resolve(promptResponses.shift())),
  },
}));

// Mock ora - capture messages to output
vi.mock('ora', () => ({
  default: vi.fn(() => {
    const spinner = {
      text: '',
      start: vi.fn(function (this: any, text?: string) {
        if (text) this.text = text;
        return this;
      }),
      stop: vi.fn().mockReturnThis(),
      succeed: vi.fn(function (this: any, text?: string) {
        console.log(text || this.text);
        return this;
      }),
      fail: vi.fn(function (this: any, text?: string) {
        console.log(text || this.text);
        return this;
      }),
      warn: vi.fn(function (this: any, text?: string) {
        console.log(text || this.text);
        return this;
      }),
      info: vi.fn().mockReturnThis(),
    };
    return spinner;
  }),
}));

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    blue: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// Mock net module for port checking
vi.mock('net', () => {
  return {
    createServer: vi.fn(() => {
      const listeners: Record<string, Array<() => void>> = {};
      return {
        listen: vi.fn(function (this: any, _port: number, _host: string) {
          setImmediate(() => {
            listeners['listening']?.forEach((cb) => cb());
          });
          return this;
        }),
        close: vi.fn(),
        once: vi.fn(function (this: any, event: string, callback: () => void) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(callback);
          return this;
        }),
      };
    }),
  };
});

// ============= TESTS =============

describe('full 247 lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset state
    fsState = createMockFsState();
    runningPids = new Set();
    promptResponses = [];
    setupDefaultDirectories(fsState);
    setupAgentEntryPoint(fsState);

    output = captureConsole();

    // Mock process.kill
    process.kill = createProcessKillMock(runningPids) as any;

    // Mock process.exit
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.kill = originalKill;
  });

  it('init → start → stop workflow completes successfully', async () => {
    // ============= STEP 1: INIT =============

    promptResponses = [{ projectsPath: '~/Dev' }];

    const { initCommand } = await import('../../src/commands/init.js');
    await initCommand.parseAsync(['node', '247', 'init']);

    // Verify: config was created
    expect(fsState.files.has(mockPaths.configPath)).toBe(true);
    const savedConfig = JSON.parse(fsState.files.get(mockPaths.configPath)!);
    expect(savedConfig.agent.port).toBe(4678);

    // Reset modules for fresh imports with new state
    vi.resetModules();

    // ============= STEP 2: START =============

    const { spawn } = await import('child_process');
    const mockChild = createMockChild({ pid: 55555 });
    vi.mocked(spawn).mockReturnValue(mockChild as any);

    // Mark process as running after spawn
    runningPids.add(55555);

    const { startCommand } = await import('../../src/commands/start.js');
    await startCommand.parseAsync(['node', '247', 'start']);

    // Verify: agent was spawned and PID file was created
    expect(spawn).toHaveBeenCalled();
    expect(fsState.files.get(mockPaths.pidFile)).toBe('55555');
    expect(runningPids.has(55555)).toBe(true);
    expect(mockChild.unref).toHaveBeenCalled();

    // Reset modules for fresh imports
    vi.resetModules();

    // ============= STEP 3: STOP =============

    const { stopCommand } = await import('../../src/commands/stop.js');
    await stopCommand.parseAsync(['node', '247', 'stop']);

    // Verify: process was stopped and PID file was removed
    expect(process.kill).toHaveBeenCalledWith(55555, 'SIGTERM');
    expect(runningPids.has(55555)).toBe(false);
    expect(fsState.files.has(mockPaths.pidFile)).toBe(false);
  });

  it('start fails gracefully before init', async () => {
    // Try to start without running init first

    const { startCommand } = await import('../../src/commands/start.js');

    await expect(startCommand.parseAsync(['node', '247', 'start'])).rejects.toThrow(
      'process.exit(1)'
    );

    // Should suggest running init
    expect(output.logs.some((l) => l.includes('247 init'))).toBe(true);
  });

  it('stop succeeds even when not running', async () => {
    // Stop when nothing is running

    const { stopCommand } = await import('../../src/commands/stop.js');
    await stopCommand.parseAsync(['node', '247', 'stop']);

    // Should complete without error
    expect(output.logs.some((l) => l.includes('not running'))).toBe(true);
  });

  it('start after stop works correctly', async () => {
    // Setup: init first
    promptResponses = [{ projectsPath: '~/Dev' }];

    const { initCommand } = await import('../../src/commands/init.js');
    await initCommand.parseAsync(['node', '247', 'init']);

    vi.resetModules();

    // First start
    const { spawn } = await import('child_process');
    let mockChild = createMockChild({ pid: 11111 });
    vi.mocked(spawn).mockReturnValue(mockChild as any);
    runningPids.add(11111);

    let { startCommand } = await import('../../src/commands/start.js');
    await startCommand.parseAsync(['node', '247', 'start']);

    expect(fsState.files.get(mockPaths.pidFile)).toBe('11111');

    vi.resetModules();

    // Stop
    const { stopCommand } = await import('../../src/commands/stop.js');
    await stopCommand.parseAsync(['node', '247', 'stop']);

    expect(fsState.files.has(mockPaths.pidFile)).toBe(false);

    vi.resetModules();

    // Second start with new PID
    const { spawn: spawn2 } = await import('child_process');
    mockChild = createMockChild({ pid: 22222 });
    vi.mocked(spawn2).mockReturnValue(mockChild as any);
    runningPids.add(22222);

    ({ startCommand } = await import('../../src/commands/start.js'));
    await startCommand.parseAsync(['node', '247', 'start']);

    expect(fsState.files.get(mockPaths.pidFile)).toBe('22222');
    expect(runningPids.has(22222)).toBe(true);
  });
});
