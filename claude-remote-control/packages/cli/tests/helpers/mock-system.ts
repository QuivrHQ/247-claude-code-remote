/**
 * Shared mocking utilities for CLI integration tests
 */
import { vi } from 'vitest';
import { EventEmitter } from 'events';

// ============= TYPES =============

export interface MockFsState {
  files: Map<string, string>;
  directories: Set<string>;
}

export interface MockChildProcess extends EventEmitter {
  pid: number;
  unref: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
}

export interface CapturedOutput {
  logs: string[];
  errors: string[];
  warns: string[];
}

// ============= MOCK PATHS =============

export const mockPaths = {
  cliRoot: '/mock/cli',
  agentRoot: '/mock/agent',
  configDir: '/mock/.247',
  configPath: '/mock/.247/config.json',
  dataDir: '/mock/.247/data',
  logDir: '/mock/.247/logs',
  pidFile: '/mock/.247/agent.pid',
  nodePath: '/usr/local/bin/node',
  isDev: false,
};

// ============= TEST FIXTURES =============

export const validConfig = {
  agent: { port: 4678 },
  projects: { basePath: '~/Dev', whitelist: [] },
};

// ============= FACTORY FUNCTIONS =============

export function createMockFsState(): MockFsState {
  return {
    files: new Map(),
    directories: new Set(),
  };
}

export function createMockChild(options: { pid?: number } = {}): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.pid = options.pid ?? 99999;
  child.unref = vi.fn();
  child.kill = vi.fn();
  return child;
}

// ============= MOCK IMPLEMENTATIONS =============

export function createProcessKillMock(runningPids: Set<number>) {
  return vi.fn((pid: number, signal?: string | number) => {
    // Signal 0 is used to check if process exists
    if (signal === 0) {
      if (!runningPids.has(pid)) {
        const err = new Error('ESRCH');
        (err as NodeJS.ErrnoException).code = 'ESRCH';
        throw err;
      }
      return true;
    }
    // SIGTERM or SIGKILL kills the process
    if (signal === 'SIGTERM' || signal === 'SIGKILL' || signal === 15 || signal === 9) {
      runningPids.delete(pid);
    }
    return true;
  });
}

// ============= CONSOLE CAPTURE =============

export function captureConsole(): CapturedOutput {
  const output: CapturedOutput = { logs: [], errors: [], warns: [] };

  vi.spyOn(console, 'log').mockImplementation((...args) => {
    output.logs.push(args.join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    output.errors.push(args.join(' '));
  });
  vi.spyOn(console, 'warn').mockImplementation((...args) => {
    output.warns.push(args.join(' '));
  });

  return output;
}

// ============= SETUP HELPERS =============

export function setupDefaultDirectories(state: MockFsState) {
  state.directories.add('/mock');
  state.directories.add('/mock/.247');
  state.directories.add('/mock/.247/data');
  state.directories.add('/mock/.247/logs');
  state.directories.add('/mock/agent');
}

export function setupAgentEntryPoint(state: MockFsState) {
  state.files.set('/mock/agent/dist/index.js', '// agent entry point');
}

export function setupExistingConfig(state: MockFsState, config = validConfig) {
  state.files.set('/mock/.247/config.json', JSON.stringify(config, null, 2));
}
