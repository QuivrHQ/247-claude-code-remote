/**
 * Integration tests for `247 start` and `247 stop` command workflows
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockPaths,
  validConfig,
  createMockFsState,
  createMockChild,
  createProcessKillMock,
  captureConsole,
  setupDefaultDirectories,
  setupAgentEntryPoint,
  setupExistingConfig,
  type MockFsState,
  type CapturedOutput,
} from '../helpers/mock-system.js';

// ============= MOCK SETUP =============

let fsState: MockFsState;
let runningPids: Set<number>;
let output: CapturedOutput;
let processExitSpy: ReturnType<typeof vi.spyOn>;
const originalKill = process.kill;

// Mock paths module
vi.mock('../../src/lib/paths.js', () => ({
  getAgentPaths: () => mockPaths,
  ensureDirectories: vi.fn(),
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
  openSync: vi.fn(() => 3),
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => 'tmux 3.4'),
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

describe('247 start workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset state
    fsState = createMockFsState();
    runningPids = new Set();
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

  describe('without configuration', () => {
    it('exits with error and suggests running init', async () => {
      // No config file exists

      const { startCommand } = await import('../../src/commands/start.js');

      await expect(startCommand.parseAsync(['node', '247', 'start'])).rejects.toThrow(
        'process.exit(1)'
      );

      expect(output.logs.some((l) => l.includes('247 init'))).toBe(true);
    });

  });

  describe('with configuration', () => {
    beforeEach(() => {
      setupExistingConfig(fsState);
    });

    it('warns if agent is already running', async () => {
      // Agent is already running
      fsState.files.set(mockPaths.pidFile, '12345');
      runningPids.add(12345);

      const { startCommand } = await import('../../src/commands/start.js');
      await startCommand.parseAsync(['node', '247', 'start']);

      expect(output.logs.some((l) => l.includes('already running'))).toBe(true);
      expect(output.logs.some((l) => l.includes('12345'))).toBe(true);
    });

    it('spawns agent as daemon and writes PID file', async () => {
      const { spawn } = await import('child_process');

      // Create mock child process
      const mockChild = createMockChild({ pid: 99999 });
      vi.mocked(spawn).mockReturnValue(mockChild as any);

      // After spawn, mark PID as running
      runningPids.add(99999);

      const { startCommand } = await import('../../src/commands/start.js');
      await startCommand.parseAsync(['node', '247', 'start']);

      // Verify spawn was called
      expect(spawn).toHaveBeenCalled();

      // Verify PID file was written
      expect(fsState.files.get(mockPaths.pidFile)).toBe('99999');

      // Verify unref was called (detached process)
      expect(mockChild.unref).toHaveBeenCalled();
    });

    it('exits with error if agent entry point is missing', async () => {
      // Remove agent entry point
      fsState.files.delete('/mock/agent/dist/index.js');

      const { startCommand } = await import('../../src/commands/start.js');

      await expect(startCommand.parseAsync(['node', '247', 'start'])).rejects.toThrow(
        'process.exit(1)'
      );

      expect(output.logs.some((l) => l.includes('entry point') || l.includes('not found'))).toBe(
        true
      );
    });

  });
});

describe('247 stop workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset state
    fsState = createMockFsState();
    runningPids = new Set();
    setupDefaultDirectories(fsState);
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

  describe('when agent is not running', () => {
    it('shows info message and returns successfully', async () => {
      // No PID file exists

      const { stopCommand } = await import('../../src/commands/stop.js');
      await stopCommand.parseAsync(['node', '247', 'stop']);

      expect(output.logs.some((l) => l.includes('not running'))).toBe(true);
      // Should not throw
    });
  });

  describe('when agent is running', () => {
    beforeEach(() => {
      fsState.files.set(mockPaths.pidFile, '12345');
      runningPids.add(12345);
    });

    it('sends SIGTERM and removes PID file', async () => {
      const { stopCommand } = await import('../../src/commands/stop.js');
      await stopCommand.parseAsync(['node', '247', 'stop']);

      // Process should have been killed
      expect(process.kill).toHaveBeenCalledWith(12345, 'SIGTERM');

      // PID file should be removed
      expect(fsState.files.has(mockPaths.pidFile)).toBe(false);
    });

    it('cleans up stale PID file if process does not exist', async () => {
      // Process doesn't actually exist (stale PID)
      runningPids.delete(12345);

      const { stopCommand } = await import('../../src/commands/stop.js');
      await stopCommand.parseAsync(['node', '247', 'stop']);

      // PID file should be cleaned up
      expect(fsState.files.has(mockPaths.pidFile)).toBe(false);
    });
  });
});
