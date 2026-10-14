import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';

// Mock fs and os
vi.mock('fs');
vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
  userInfo: vi.fn(() => ({ username: 'testuser' })),
}));

// Mock child_process for detectUserShell fallback
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('init-script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('generateInitScript', () => {
    it('generates script with session and project name exports', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'my-session',
        projectName: 'my-project',
        shell: 'bash',
        targetShell: 'bash',
      });

      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('export CLAUDE_TMUX_SESSION="my-session"');
      expect(script).toContain('export CLAUDE_PROJECT="my-project"');
      expect(script).toContain('tmux set-option -t "my-session" history-limit 50000');
      expect(script).toContain('tmux set-option -t "my-session" mouse on');
      expect(script).toContain('exec bash -i');
    });

    it('includes custom env vars in script', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'test',
        projectName: 'test-project',
        customEnvVars: {
          MY_VAR: 'value1',
          ANOTHER_VAR: 'value2',
        },
      });

      expect(script).toContain('export MY_VAR="value1"');
      expect(script).toContain('export ANOTHER_VAR="value2"');
    });

    it('filters out empty env vars', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'test',
        projectName: 'test-project',
        customEnvVars: {
          VALID: 'value',
          EMPTY: '',
          WHITESPACE: '   ',
        },
      });

      expect(script).toContain('export VALID="value"');
      expect(script).not.toContain('export EMPTY=');
      expect(script).not.toContain('export WHITESPACE=');
    });

    it('escapes special characters in values', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'test',
        projectName: 'test-project',
        customEnvVars: {
          WITH_QUOTES: 'value with "quotes"',
          WITH_DOLLAR: 'value with $VAR',
          WITH_BACKTICK: 'value with `cmd`',
          WITH_BACKSLASH: 'value with \\path',
        },
      });

      // Check that special chars are escaped
      expect(script).toContain('export WITH_QUOTES="value with \\"quotes\\""');
      expect(script).toContain('export WITH_DOLLAR="value with \\$VAR"');
      expect(script).toContain('export WITH_BACKTICK="value with \\`cmd\\`"');
      expect(script).toContain('export WITH_BACKSLASH="value with \\\\path"');
    });

    it('escapes special characters in session name', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'session-with-$pecial"chars',
        projectName: 'test-project',
      });

      expect(script).toContain('export CLAUDE_TMUX_SESSION="session-with-\\$pecial\\"chars"');
    });

    it('includes tmux status bar configuration', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'test-session',
        projectName: 'my-project',
      });

      expect(script).toContain('status-left');
      expect(script).toContain('status-right');
      expect(script).toContain('my-project');
      expect(script).toContain('247');
    });

    it('includes welcome message with session info', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'brave-lion-42',
        projectName: 'my-app',
      });

      expect(script).toContain('247');
      expect(script).toContain('my-app');
      expect(script).toContain('brave-lion-42');
      expect(script).toContain('Claude Code');
    });

    it('includes useful aliases', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'test',
        projectName: 'test-project',
      });

      expect(script).toContain("alias c='claude'");
      expect(script).toContain("alias gs='git status'");
      expect(script).toContain("alias ll='ls -lah'");
    });

    it('generates bash-specific prompt configuration by default', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'test',
        projectName: 'test-project',
        shell: 'bash',
        targetShell: 'bash',
      });

      expect(script).toContain('PROMPT_COMMAND');
      expect(script).toContain('PS1=');
      expect(script).toContain('exec bash -i');
    });

    it('generates zsh-specific prompt configuration when shell is zsh', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'test',
        projectName: 'test-project',
        shell: 'zsh',
        targetShell: 'zsh',
      });

      expect(script).toContain('precmd_functions');
      expect(script).toContain('PROMPT=');
      expect(script).toContain('exec zsh -i');
    });

    it('includes history configuration', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      const script = generateInitScript({
        sessionName: 'test',
        projectName: 'test-project',
      });

      expect(script).toContain('HISTSIZE=50000');
    });
  });

  describe('detectUserShell', () => {
    const originalShell = process.env.SHELL;

    afterEach(() => {
      if (originalShell !== undefined) {
        process.env.SHELL = originalShell;
      } else {
        delete process.env.SHELL;
      }
    });

    it('detects zsh from SHELL env', async () => {
      process.env.SHELL = '/bin/zsh';
      vi.resetModules();

      const { detectUserShell } = await import('../../src/lib/init-script.js');
      expect(detectUserShell()).toBe('zsh');
    });

    it('detects bash from SHELL env', async () => {
      process.env.SHELL = '/bin/bash';
      vi.resetModules();

      const { detectUserShell } = await import('../../src/lib/init-script.js');
      expect(detectUserShell()).toBe('bash');
    });

    it('falls back to /etc/passwd when SHELL is undefined', async () => {
      delete process.env.SHELL;
      vi.resetModules();

      // Mock execSync to return zsh from /etc/passwd
      vi.mocked(child_process.execSync).mockReturnValue('/usr/bin/zsh\n');

      const { detectUserShell } = await import('../../src/lib/init-script.js');
      expect(detectUserShell()).toBe('zsh');
    });

    it('defaults to bash when SHELL is undefined and /etc/passwd lookup fails', async () => {
      delete process.env.SHELL;
      vi.resetModules();

      // Mock execSync to throw (simulating getent failure)
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error('Command failed');
      });

      const { detectUserShell } = await import('../../src/lib/init-script.js');
      expect(detectUserShell()).toBe('bash');
    });
  });

  describe('generateInitScript header comments', () => {
    it('keeps line breaks in session and project names inside their comment lines', async () => {
      const { generateInitScript } = await import('../../src/lib/init-script.js');

      // A raw newline here would end the comment and start a new, executable script line
      const script = generateInitScript({
        sessionName: 'evil\ntouch /tmp/pwned',
        projectName: 'proj\r\nrm -rf ~',
        shell: 'bash',
        targetShell: 'bash',
      });

      const lines = script.split('\n');
      const sessionIdx = lines.findIndex((line) => line.startsWith('# Session:'));
      expect(sessionIdx).toBeGreaterThan(-1);
      expect(lines[sessionIdx]).toBe('# Session: evil touch /tmp/pwned');
      expect(lines[sessionIdx + 1]).toBe('# Project: proj rm -rf ~');
      expect(lines[sessionIdx + 2]).toMatch(/^# Init Shell:/);
    });
  });

  describe('writeInitScript', () => {
    it('writes script to temp directory with correct permissions', async () => {
      const { writeInitScript } = await import('../../src/lib/init-script.js');

      const result = writeInitScript('my-session', '#!/bin/bash\necho hello');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/tmp/247-init-my-session.sh',
        '#!/bin/bash\necho hello',
        { mode: 0o755 }
      );
      expect(result).toBe('/tmp/247-init-my-session.sh');
    });

    it('cannot be steered out of the temp directory or into a shell by the session name', async () => {
      const { writeInitScript } = await import('../../src/lib/init-script.js');

      // tmux runs `bash --init-file <path>` through a shell, so the path must be inert
      const result = writeInitScript('../../etc/x;touch /tmp/pwned "$(id)" `id`', '#!/bin/bash');

      expect(path.dirname(result)).toBe('/tmp');
      expect(path.basename(result)).toMatch(/^247-init-[\w.-]+\.sh$/);
      expect(fs.writeFileSync).toHaveBeenCalledWith(result, '#!/bin/bash', { mode: 0o755 });
    });
  });

  describe('cleanupInitScript', () => {
    it('removes init script file', async () => {
      const { cleanupInitScript } = await import('../../src/lib/init-script.js');

      cleanupInitScript('my-session');

      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/247-init-my-session.sh');
    });

    it('ignores errors when file does not exist', async () => {
      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const { cleanupInitScript } = await import('../../src/lib/init-script.js');

      // Should not throw
      expect(() => cleanupInitScript('nonexistent')).not.toThrow();
    });

    it('removes the same sanitized path that writeInitScript wrote', async () => {
      const { writeInitScript, cleanupInitScript } = await import('../../src/lib/init-script.js');

      const written = writeInitScript('my session;touch x', '#!/bin/bash');
      cleanupInitScript('my session;touch x');

      expect(fs.unlinkSync).toHaveBeenCalledWith(written);
    });
  });

  describe('getInitScriptPath', () => {
    it('returns correct path for session', async () => {
      const { getInitScriptPath } = await import('../../src/lib/init-script.js');

      const result = getInitScriptPath('my-session');

      expect(result).toBe('/tmp/247-init-my-session.sh');
    });

    it('keeps dots, dashes and underscores and replaces every other character with an underscore', async () => {
      const { getInitScriptPath } = await import('../../src/lib/init-script.js');

      expect(getInitScriptPath('proj_1.2--abc')).toBe('/tmp/247-init-proj_1.2--abc.sh');
      expect(getInitScriptPath('a b/c;d$e')).toBe('/tmp/247-init-a_b_c_d_e.sh');
    });
  });
});
