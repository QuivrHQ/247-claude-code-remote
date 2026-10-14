import { describe, it, expect, vi, beforeEach } from 'vitest';

// tmux must only ever be spawned directly (argv array, no shell)
vi.mock('child_process', () => ({
  execFile: vi.fn(),
  execFileSync: vi.fn(),
}));

import { execFile, execFileSync } from 'child_process';
import { tmuxSessionExists, runTmux, escapeSendKeysText } from '../../src/lib/tmux.js';

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

/** Make the mocked execFile complete with the given result (callback style). */
function mockExecFileResult(error: Error | null, stdout = '', stderr = ''): void {
  vi.mocked(execFile).mockImplementation(((
    _file: string,
    _args: string[],
    _options: unknown,
    callback: ExecFileCallback
  ) => {
    callback(error, stdout, stderr);
  }) as never);
}

// Names that would break out of a shell string if they were ever interpolated
const HOSTILE_NAMES = [
  'x"; touch /tmp/pwned; "',
  '$(touch /tmp/pwned)',
  '`touch /tmp/pwned`',
  "x'; touch /tmp/pwned; '",
  'x\ntouch /tmp/pwned',
  'a b',
  '-t other',
];

describe('tmux helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tmuxSessionExists', () => {
    it('runs tmux has-session directly with an argv array', () => {
      vi.mocked(execFileSync).mockReturnValue(Buffer.from(''));

      expect(tmuxSessionExists('my-session')).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith('tmux', ['has-session', '-t', 'my-session'], {
        stdio: 'ignore',
      });
    });

    it('returns false when tmux reports no such session', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error("can't find session");
      });

      expect(tmuxSessionExists('missing')).toBe(false);
    });

    it('returns false when tmux itself cannot be started', () => {
      vi.mocked(execFileSync).mockImplementation(() => {
        throw Object.assign(new Error('spawn tmux ENOENT'), { code: 'ENOENT' });
      });

      expect(tmuxSessionExists('anything')).toBe(false);
    });

    it.each(HOSTILE_NAMES)('passes %j as one literal argument without a shell', (name) => {
      vi.mocked(execFileSync).mockReturnValue(Buffer.from(''));

      tmuxSessionExists(name);

      expect(execFileSync).toHaveBeenCalledTimes(1);
      const [file, args, options] = vi.mocked(execFileSync).mock.calls[0];
      expect(file).toBe('tmux');
      expect(args).toEqual(['has-session', '-t', name]);
      expect(options).not.toHaveProperty('shell');
    });
  });

  describe('runTmux', () => {
    it('runs tmux directly with an argv array and resolves with stdout', async () => {
      mockExecFileResult(null, 'pane output\n');

      await expect(runTmux(['capture-pane', '-t', 'my-session', '-p'])).resolves.toBe(
        'pane output\n'
      );
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['capture-pane', '-t', 'my-session', '-p'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('rejects when tmux exits with an error', async () => {
      mockExecFileResult(new Error('no server running'), '', 'no server running');

      await expect(runTmux(['kill-session', '-t', 'gone'])).rejects.toThrow('no server running');
    });

    it.each(HOSTILE_NAMES)(
      'keeps %j as a single argv element and never enables a shell',
      async (name) => {
        mockExecFileResult(null);

        await runTmux(['kill-session', '-t', name]);

        const [file, args, options] = vi.mocked(execFile).mock.calls[0];
        expect(file).toBe('tmux');
        expect(args).toEqual(['kill-session', '-t', name]);
        expect(options).not.toHaveProperty('shell');
      }
    );
  });

  describe('escapeSendKeysText', () => {
    it('leaves ordinary text untouched', () => {
      expect(escapeSendKeysText('ls -la')).toBe('ls -la');
      expect(escapeSendKeysText('')).toBe('');
    });

    it('does not touch quotes, dollars, backticks or backslashes (no shell is involved)', () => {
      const text = 'echo "$HOME" `id` \\n';
      expect(escapeSendKeysText(text)).toBe(text);
    });

    it('does not touch semicolons that are not at the end', () => {
      expect(escapeSendKeysText('a;b; c')).toBe('a;b; c');
    });

    it('escapes a trailing semicolon so tmux does not treat it as a command separator', () => {
      expect(escapeSendKeysText('echo hi;')).toBe('echo hi\\;');
    });

    it('preserves a literal backslash before a trailing semicolon', () => {
      // tmux strips exactly one backslash before a trailing ';'
      expect(escapeSendKeysText('a\\;')).toBe('a\\\\;');
    });
  });
});
