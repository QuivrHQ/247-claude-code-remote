/**
 * Integration tests for `247 init` command workflow
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockPaths,
  validConfig,
  createMockFsState,
  captureConsole,
  setupDefaultDirectories,
  setupHooksSource,
  type MockFsState,
  type CapturedOutput,
} from '../helpers/mock-system.js';

// ============= MOCK SETUP =============

let fsState: MockFsState;
let promptResponses: unknown[];
let output: CapturedOutput;
let processExitSpy: ReturnType<typeof vi.spyOn>;

// Mock paths module
vi.mock('../../src/lib/paths.js', () => ({
  getAgentPaths: () => mockPaths,
  ensureDirectories: vi.fn(() => {
    fsState.directories.add(mockPaths.configDir);
    fsState.directories.add(mockPaths.profilesDir);
    fsState.directories.add(mockPaths.dataDir);
    fsState.directories.add(mockPaths.logDir);
  }),
}));

// Mock fs module
vi.mock('fs', () => {
  return {
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
    chmodSync: vi.fn(),
    lstatSync: vi.fn(() => ({ isSymbolicLink: () => false })),
    rmSync: vi.fn(),
    copyFileSync: vi.fn(),
    symlinkSync: vi.fn(),
  };
});

// Mock crypto for UUID generation
vi.mock('crypto', () => ({
  randomUUID: () => 'generated-uuid-1234',
  randomBytes: (size: number) => Buffer.alloc(size, 1),
}));

// Mock child_process for prerequisite checks
vi.mock('child_process', () => ({
  execSync: vi.fn(() => 'tmux 3.4'),
  spawn: vi.fn(),
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

// Mock chalk to pass through text (makes assertions easier)
vi.mock('chalk', () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    blue: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

// Mock net module for port checking
vi.mock('net', () => {
  return {
    createServer: vi.fn(() => {
      const listeners: Record<string, Array<() => void>> = {};
      return {
        listen: vi.fn(function (this: any, _port: number, _host: string) {
          // Trigger listening callback synchronously via setImmediate
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

describe('247 init workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Reset state
    fsState = createMockFsState();
    setupDefaultDirectories(fsState);
    setupHooksSource(fsState);
    promptResponses = [];
    output = captureConsole();

    // Mock process.exit to throw instead of exiting
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fresh installation', () => {
    it('creates config with prompted values', async () => {
      promptResponses = [{ machineName: 'my-awesome-mac' }, { projectsPath: '~/Projects' }];

      const { initCommand } = await import('../../src/commands/init.js');
      await initCommand.parseAsync(['node', '247', 'init']);

      // Verify config was written
      expect(fsState.files.has(mockPaths.configPath)).toBe(true);

      const savedConfig = JSON.parse(fsState.files.get(mockPaths.configPath)!);
      expect(savedConfig.machine.name).toBe('my-awesome-mac');
      expect(savedConfig.machine.id).toBe('generated-uuid-1234');
      expect(savedConfig.projects.basePath).toBe('~/Projects');
      expect(savedConfig.agent.port).toBe(4678);
    });

    it('uses CLI flags instead of prompts when provided', async () => {
      // No prompts needed since all values are provided via CLI
      promptResponses = [];

      const { initCommand } = await import('../../src/commands/init.js');
      await initCommand.parseAsync([
        'node',
        '247',
        'init',
        '--name',
        'cli-provided-name',
        '--port',
        '5000',
        '--projects',
        '/custom/path',
      ]);

      const savedConfig = JSON.parse(fsState.files.get(mockPaths.configPath)!);
      expect(savedConfig.machine.name).toBe('cli-provided-name');
      expect(savedConfig.agent.port).toBe(5000);
      expect(savedConfig.projects.basePath).toBe('/custom/path');
    });

    it('prompts for machine name only if not provided', async () => {
      promptResponses = [{ machineName: 'prompted-name' }, { projectsPath: '~/Dev' }];

      const enquirer = await import('enquirer');

      const { initCommand } = await import('../../src/commands/init.js');
      await initCommand.parseAsync(['node', '247', 'init']);

      // Enquirer should have been called for prompts
      expect(enquirer.default.prompt).toHaveBeenCalled();
    });
  });

  describe('existing configuration', () => {
    it('warns if config already exists and suggests --force', async () => {
      // Pre-existing config
      fsState.files.set(mockPaths.configPath, JSON.stringify(validConfig));

      const { initCommand } = await import('../../src/commands/init.js');
      await initCommand.parseAsync(['node', '247', 'init']);

      expect(output.logs.some((l) => l.includes('already exists'))).toBe(true);
      expect(output.logs.some((l) => l.includes('--force'))).toBe(true);

      // Config should not have been modified
      const savedConfig = JSON.parse(fsState.files.get(mockPaths.configPath)!);
      expect(savedConfig.machine.id).toBe(validConfig.machine.id);
    });

    it('overwrites config when --force is used', async () => {
      // Pre-existing config
      fsState.files.set(mockPaths.configPath, JSON.stringify(validConfig));
      promptResponses = [];

      const { initCommand } = await import('../../src/commands/init.js');
      await initCommand.parseAsync(['node', '247', 'init', '--force', '--name', 'new-name']);

      const savedConfig = JSON.parse(fsState.files.get(mockPaths.configPath)!);
      expect(savedConfig.machine.name).toBe('new-name');
      expect(savedConfig.machine.id).toBe('generated-uuid-1234'); // New UUID
    });
  });

  describe('prerequisites checking', () => {
    it('exits with error if tmux is not installed', async () => {
      const { execSync } = await import('child_process');
      // Use mockImplementationOnce so it doesn't affect subsequent tests
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('command not found');
      });

      promptResponses = [{ machineName: 'test' }, { projectsPath: '~/Dev' }];

      const { initCommand } = await import('../../src/commands/init.js');

      await expect(
        initCommand.parseAsync(['node', '247', 'init', '--name', 'test'])
      ).rejects.toThrow('process.exit(1)');

      expect(output.logs.some((l) => l.toLowerCase().includes('tmux'))).toBe(true);
    });
  });

  describe('profile support', () => {
    it('creates profile in profiles directory when --profile is used', async () => {
      promptResponses = [{ machineName: 'dev-machine' }, { projectsPath: '~/Dev' }];

      const { initCommand } = await import('../../src/commands/init.js');
      await initCommand.parseAsync(['node', '247', 'init', '--profile', 'dev']);

      // Profile should be created in profiles directory
      const profilePath = `${mockPaths.profilesDir}/dev.json`;
      expect(fsState.files.has(profilePath)).toBe(true);

      const savedConfig = JSON.parse(fsState.files.get(profilePath)!);
      expect(savedConfig.machine.name).toBe('dev-machine');
    });
  });

  describe('statusLine configuration', () => {
    it('completes without mentioning hooks (deprecated)', async () => {
      promptResponses = [{ machineName: 'test' }, { projectsPath: '~/Dev' }];

      const { initCommand } = await import('../../src/commands/init.js');
      await initCommand.parseAsync(['node', '247', 'init']);

      // Config should be saved - statusLine is auto-configured by agent at startup
      expect(fsState.files.has(mockPaths.configPath)).toBe(true);

      // Should show completion message
      const allOutput = output.logs.join(' ');
      expect(allOutput.includes('complete') || allOutput.includes('Complete')).toBe(true);
    });
  });

  describe('success output', () => {
    it('shows success message and next steps', async () => {
      promptResponses = [{ machineName: 'test' }, { projectsPath: '~/Dev' }];

      const { initCommand } = await import('../../src/commands/init.js');
      await initCommand.parseAsync(['node', '247', 'init']);

      const allOutput = output.logs.join(' ');
      expect(allOutput.includes('complete') || allOutput.includes('Complete')).toBe(true);
      expect(allOutput.includes('247 start')).toBe(true);
    });
  });
});
