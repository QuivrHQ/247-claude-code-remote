import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Force bash shell for consistent test results
const originalShell = process.env.SHELL;
process.env.SHELL = '/bin/bash';

// Track init script writes for testing
let writtenInitScripts: { path: string; content: string }[] = [];

// Mock fs module for init script handling
vi.mock('fs', () => ({
  writeFileSync: vi.fn((path: string, content: string) => {
    writtenInitScripts.push({ path, content });
  }),
  unlinkSync: vi.fn(),
}));

// Create mock PTY process
const createMockPtyProcess = () => {
  const emitter = new EventEmitter();
  return {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
    onData: (cb: (data: string) => void) => {
      emitter.on('data', cb);
      return { dispose: () => emitter.off('data', cb) };
    },
    onExit: (cb: (info: { exitCode: number; signal?: number }) => void) => {
      emitter.on('exit', cb);
      return { dispose: () => emitter.off('exit', cb) };
    },
    _emit: (event: string, data: unknown) => emitter.emit(event, data),
  };
};

let mockPtyProcess: ReturnType<typeof createMockPtyProcess>;
let execSyncResponses: Record<string, string | Error> = {};
let execAsyncResponses: Record<string, { stdout: string; stderr: string } | Error> = {};

// Mock node-pty
vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: vi.fn(() => mockPtyProcess),
}));

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    const key = Object.keys(execSyncResponses).find((k) => cmd.includes(k));
    if (key) {
      const response = execSyncResponses[key];
      if (response instanceof Error) throw response;
      return response;
    }
    throw new Error('Command not mocked');
  }),
  exec: vi.fn(
    (cmd: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
      // If callback provided, call it asynchronously
      if (callback) {
        setImmediate(() => callback(null, '', ''));
      }
    }
  ),
}));

// Mock promisify to return our async mock
vi.mock('util', () => ({
  promisify: () => async (cmd: string) => {
    const key = Object.keys(execAsyncResponses).find((k) => cmd.includes(k));
    if (key) {
      const response = execAsyncResponses[key];
      if (response instanceof Error) throw response;
      return response;
    }
    return { stdout: '', stderr: '' };
  },
}));

describe('Terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPtyProcess = createMockPtyProcess();
    execSyncResponses = {};
    execAsyncResponses = {};
    writtenInitScripts = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createTerminal', () => {
    it('creates a new tmux session when session does not exist', async () => {
      // Session does not exist
      execSyncResponses['has-session'] = new Error('session not found');

      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'test-session');

      expect(terminal).toBeDefined();
      expect(terminal.write).toBeDefined();
      expect(terminal.resize).toBeDefined();
      expect(terminal.kill).toBeDefined();
      expect(terminal.detach).toBeDefined();
      expect(terminal.captureHistory).toBeDefined();
      expect(terminal.isExistingSession()).toBe(false);
    });

    it('attaches to existing tmux session when it exists', async () => {
      // Session exists
      execSyncResponses['has-session'] = '';

      // Re-import to get fresh module state
      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'existing-session');

      expect(terminal.isExistingSession()).toBe(true);
    });

    it('forwards write calls to PTY', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'write-test');

      terminal.write('hello');
      expect(mockPtyProcess.write).toHaveBeenCalledWith('hello');
    });

    it('forwards resize calls to PTY', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'resize-test');

      terminal.resize(120, 40);
      expect(mockPtyProcess.resize).toHaveBeenCalledWith(120, 40);
    });

    it('sends detach command when detach is called', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'detach-test');

      terminal.detach();
      // Ctrl+B, d for tmux detach
      expect(mockPtyProcess.write).toHaveBeenCalledWith('\x02d');
    });

    it('captures history from tmux scrollback', async () => {
      execSyncResponses['has-session'] = new Error('not found');
      execAsyncResponses['capture-pane'] = {
        stdout: 'line 1\nline 2\nline 3\n',
        stderr: '',
      };

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'history-test');

      const history = await terminal.captureHistory(100);
      expect(history).toBe('line 1\nline 2\nline 3\n');
    });

    it('returns empty string when history capture fails', async () => {
      execSyncResponses['has-session'] = new Error('not found');
      execAsyncResponses['capture-pane'] = new Error('tmux error');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'history-error-test');

      const history = await terminal.captureHistory();
      expect(history).toBe('');
    });

    it('registers data callback', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'data-test');

      const dataCallback = vi.fn();
      terminal.onData(dataCallback);

      // Simulate data from PTY
      mockPtyProcess._emit('data', 'test output');
      expect(dataCallback).toHaveBeenCalledWith('test output');
    });

    it('registers exit callback', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'exit-test');

      const exitCallback = vi.fn();
      terminal.onExit(exitCallback);

      // Simulate exit from PTY
      mockPtyProcess._emit('exit', { exitCode: 0 });
      expect(exitCallback).toHaveBeenCalledWith({ exitCode: 0 });
    });

    it('kills PTY when kill is called', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'kill-test');

      terminal.kill();
      expect(mockPtyProcess.kill).toHaveBeenCalled();
    });

    it('writes init script with env vars for new sessions', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      createTerminal('/tmp/test', 'init-script-test', { MY_VAR: 'my-value' });

      // Verify init script was written
      expect(writtenInitScripts.length).toBe(1);
      const script = writtenInitScripts[0];

      // Check script path
      expect(script.path).toMatch(/247-init-init-script-test\.sh$/);

      // Check script contains required exports
      expect(script.content).toContain('export CLAUDE_TMUX_SESSION="init-script-test"');
      expect(script.content).toContain('export MY_VAR="my-value"');

      // Check script contains tmux config
      expect(script.content).toContain('tmux set-option');
      expect(script.content).toContain('history-limit 50000');
      expect(script.content).toContain('mouse on');

      // Check script ends with interactive shell
      expect(script.content).toContain('exec bash -i');
    });

    it('does not write init script for existing sessions', async () => {
      // Session exists
      execSyncResponses['has-session'] = '';

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      createTerminal('/tmp/test', 'existing-session');

      // No init script should be written
      expect(writtenInitScripts.length).toBe(0);
    });

    it('onReady fires immediately for existing sessions', async () => {
      // Session exists
      execSyncResponses['has-session'] = '';

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'existing-ready-test');

      const readyCallback = vi.fn();
      terminal.onReady(readyCallback);

      // Should fire immediately since session already exists
      expect(readyCallback).toHaveBeenCalledTimes(1);
    });

    it('onReady fires after init for new sessions', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'new-ready-test');

      const readyCallback = vi.fn();
      terminal.onReady(readyCallback);

      // Should NOT fire immediately
      expect(readyCallback).not.toHaveBeenCalled();

      // Wait for setTimeout (150ms for init script)
      await new Promise((r) => setTimeout(r, 200));

      // Should now have fired
      expect(readyCallback).toHaveBeenCalledTimes(1);
    });

    it('onReady fires multiple callbacks for new sessions', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'multi-ready-test');

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      terminal.onReady(callback1);
      terminal.onReady(callback2);

      // Wait for init to complete (150ms + buffer)
      await new Promise((r) => setTimeout(r, 200));

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('onReady fires immediately if called after terminal is ready', async () => {
      execSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'late-ready-test');

      // Wait for init to complete (150ms + buffer)
      await new Promise((r) => setTimeout(r, 200));

      // Now call onReady after terminal is ready
      const lateCallback = vi.fn();
      terminal.onReady(lateCallback);

      // Should fire immediately since terminal is already ready
      expect(lateCallback).toHaveBeenCalledTimes(1);
    });
  });
});
