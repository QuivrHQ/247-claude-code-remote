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
let execFileSyncResponses: Record<string, string | Error> = {};
let execFileAsyncResponses: Record<string, { stdout: string; stderr: string } | Error> = {};

// Mock node-pty
vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: vi.fn(() => mockPtyProcess),
}));

// Mock child_process: tmux is only ever spawned via execFile/execFileSync (argv array, no shell).
// Responses are matched against the space-joined "file arg arg ..." command line.
vi.mock('child_process', () => ({
  execFileSync: vi.fn((file: string, args: string[]) => {
    const cmd = [file, ...args].join(' ');
    const key = Object.keys(execFileSyncResponses).find((k) => cmd.includes(k));
    if (key) {
      const response = execFileSyncResponses[key];
      if (response instanceof Error) throw response;
      return response;
    }
    throw new Error('Command not mocked');
  }),
  execFile: vi.fn(
    (
      file: string,
      args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      const cmd = [file, ...args].join(' ');
      const key = Object.keys(execFileAsyncResponses).find((k) => cmd.includes(k));
      const response = key ? execFileAsyncResponses[key] : { stdout: '', stderr: '' };
      setImmediate(() => {
        if (response instanceof Error) callback(response, '', '');
        else callback(null, response.stdout, response.stderr);
      });
    }
  ),
  // Shell-based variants must never be used to talk to tmux: fail loudly if they are.
  exec: vi.fn(() => {
    throw new Error('exec (shell) must not be used for tmux commands');
  }),
  execSync: vi.fn(() => {
    throw new Error('execSync (shell) must not be used for tmux commands');
  }),
}));

describe('Terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPtyProcess = createMockPtyProcess();
    execFileSyncResponses = {};
    execFileAsyncResponses = {};
    writtenInitScripts = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createTerminal', () => {
    it('creates a new tmux session when session does not exist', async () => {
      // Session does not exist
      execFileSyncResponses['has-session'] = new Error('session not found');

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
      execFileSyncResponses['has-session'] = '';

      // Re-import to get fresh module state
      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'existing-session');

      expect(terminal.isExistingSession()).toBe(true);
    });

    it('forwards write calls to PTY', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'write-test');

      terminal.write('hello');
      expect(mockPtyProcess.write).toHaveBeenCalledWith('hello');
    });

    it('forwards resize calls to PTY', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'resize-test');

      terminal.resize(120, 40);
      expect(mockPtyProcess.resize).toHaveBeenCalledWith(120, 40);
    });

    it('sends detach command when detach is called', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'detach-test');

      terminal.detach();
      // Ctrl+B, d for tmux detach
      expect(mockPtyProcess.write).toHaveBeenCalledWith('\x02d');
    });

    it('captures history from tmux scrollback', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');
      execFileAsyncResponses['capture-pane'] = {
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
      execFileSyncResponses['has-session'] = new Error('not found');
      execFileAsyncResponses['capture-pane'] = new Error('tmux error');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'history-error-test');

      const history = await terminal.captureHistory();
      expect(history).toBe('');
    });

    it('registers data callback', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

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
      execFileSyncResponses['has-session'] = new Error('not found');

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
      execFileSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'kill-test');

      terminal.kill();
      expect(mockPtyProcess.kill).toHaveBeenCalled();
    });

    it('writes init script with env vars for new sessions', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      createTerminal('/tmp/test', 'init-script-test', { MY_VAR: 'my-value' });

      // Verify init script was written
      expect(writtenInitScripts.length).toBe(1);
      const script = writtenInitScripts[0];

      // Check script path (session name is hashed into the filename, not interpolated)
      expect(script.path).toMatch(/\/247-init-[0-9a-f]{64}\.sh$/);

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
      execFileSyncResponses['has-session'] = '';

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      createTerminal('/tmp/test', 'existing-session');

      // No init script should be written
      expect(writtenInitScripts.length).toBe(0);
    });

    it('onReady fires immediately for existing sessions', async () => {
      // Session exists
      execFileSyncResponses['has-session'] = '';

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', 'existing-ready-test');

      const readyCallback = vi.fn();
      terminal.onReady(readyCallback);

      // Should fire immediately since session already exists
      expect(readyCallback).toHaveBeenCalledTimes(1);
    });

    it('onReady fires after init for new sessions', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

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
      execFileSyncResponses['has-session'] = new Error('not found');

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
      execFileSyncResponses['has-session'] = new Error('not found');

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

  describe('shell injection hardening', () => {
    // The session name comes from the `session` URL parameter of the terminal WebSocket,
    // so it is attacker-controlled and must never reach a shell.
    const HOSTILE = 'evil"; touch /tmp/pwned; echo "';

    it('checks for an existing session without going through a shell', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      createTerminal('/tmp/test', HOSTILE);

      const cp = await import('child_process');
      expect(cp.execFileSync).toHaveBeenCalledWith('tmux', ['has-session', '-t', HOSTILE], {
        stdio: 'ignore',
      });
      expect(cp.execSync).not.toHaveBeenCalled();
      expect(cp.exec).not.toHaveBeenCalled();
    });

    it('passes the session name to new-session as a single argv element', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      createTerminal('/tmp/test', HOSTILE);

      const pty = await import('@homebridge/node-pty-prebuilt-multiarch');
      const [file, args] = vi.mocked(pty.spawn).mock.calls[0];
      expect(file).toBe('tmux');
      expect((args as string[]).slice(0, 3)).toEqual(['new-session', '-s', HOSTILE]);
    });

    it('keeps session-name characters out of the init script path and tmux shell command', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      createTerminal('/tmp/test', HOSTILE);

      // tmux runs the trailing new-session argument through a shell, so the path must be inert
      expect(writtenInitScripts).toHaveLength(1);
      const scriptPath = writtenInitScripts[0].path;
      expect(scriptPath).toMatch(/\/247-init-[0-9a-f]{64}\.sh$/);

      const pty = await import('@homebridge/node-pty-prebuilt-multiarch');
      const [, args] = vi.mocked(pty.spawn).mock.calls[0];
      const tmuxArgs = args as string[];
      expect(tmuxArgs[tmuxArgs.length - 1]).toBe(`bash --init-file ${scriptPath}`);
    });

    it('enables mouse mode on an existing session via execFile', async () => {
      execFileSyncResponses['has-session'] = '';

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      createTerminal('/tmp/test', HOSTILE);

      // terminal.ts applies mouse mode 100ms after attaching
      await new Promise((r) => setTimeout(r, 150));

      const cp = await import('child_process');
      expect(cp.execFile).toHaveBeenCalledWith(
        'tmux',
        ['set-option', '-t', HOSTILE, 'mouse', 'on'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(cp.exec).not.toHaveBeenCalled();
    });

    it('captures history with the session name as a single argv element', async () => {
      execFileSyncResponses['has-session'] = new Error('not found');
      execFileAsyncResponses['capture-pane'] = { stdout: 'history\n', stderr: '' };

      vi.resetModules();
      const { createTerminal } = await import('../../src/terminal.js');
      const terminal = createTerminal('/tmp/test', HOSTILE);

      await expect(terminal.captureHistory(250)).resolves.toBe('history\n');

      const cp = await import('child_process');
      expect(cp.execFile).toHaveBeenCalledWith(
        'tmux',
        ['capture-pane', '-t', HOSTILE, '-p', '-S', '-250', '-J'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(cp.exec).not.toHaveBeenCalled();
    });
  });
});
