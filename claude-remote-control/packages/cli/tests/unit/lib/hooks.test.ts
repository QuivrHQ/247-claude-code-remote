/**
 * Hooks Utility Tests
 *
 * Tests for the hooks utility functions that manage Claude Code notification hooks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  chmodSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock os
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

// Mock path resolution for __dirname
vi.mock('url', () => ({
  fileURLToPath: vi.fn(() => '/fake/path/to/lib/hooks.ts'),
}));

describe('Hooks Utility', () => {
  const HOOKS_DIR = '/home/testuser/.247/hooks';
  const HOOK_SCRIPT_PATH = join(HOOKS_DIR, 'notify-247.sh');
  const CLAUDE_SETTINGS_PATH = '/home/testuser/.claude/settings.json';

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHookVersion', () => {
    it('returns version from installed script', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('#!/bin/bash\n# VERSION: 2.25.0\n# Other stuff');

      const { getHookVersion } = await import('../../../src/lib/hooks.js');
      expect(getHookVersion()).toBe('2.25.0');
    });

    it('returns null when script does not exist', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { getHookVersion } = await import('../../../src/lib/hooks.js');
      expect(getHookVersion()).toBeNull();
    });

    it('returns null when no version header found', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('#!/bin/bash\n# No version here');

      const { getHookVersion } = await import('../../../src/lib/hooks.js');
      expect(getHookVersion()).toBeNull();
    });
  });

  // Helper to create mock settings with all hook types
  const createMockSettings = () => ({
    hooks: {
      Stop: [
        {
          matcher: '*',
          hooks: [{ type: 'command', command: 'bash ~/.247/hooks/notify-247.sh' }],
        },
      ],
      PermissionRequest: [
        {
          matcher: '*',
          hooks: [{ type: 'command', command: 'bash ~/.247/hooks/notify-247.sh' }],
        },
      ],
      Notification: [
        {
          matcher: '*',
          hooks: [{ type: 'command', command: 'bash ~/.247/hooks/notify-247.sh' }],
        },
      ],
    },
  });

  describe('isHookInstalled', () => {
    it('returns true when script exists and settings configured', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if (String(path).includes('settings.json')) {
          return JSON.stringify(createMockSettings());
        }
        return '#!/bin/bash\n# VERSION: 2.25.0';
      });

      const { isHookInstalled } = await import('../../../src/lib/hooks.js');
      expect(isHookInstalled()).toBe(true);
    });

    it('returns false when script does not exist', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockImplementation((path) => {
        return !String(path).includes('notify-247.sh');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(createMockSettings()));

      const { isHookInstalled } = await import('../../../src/lib/hooks.js');
      expect(isHookInstalled()).toBe(false);
    });

    it('returns false when settings not configured', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if (String(path).includes('settings.json')) {
          return JSON.stringify({});
        }
        return '#!/bin/bash\n# VERSION: 2.25.0';
      });

      const { isHookInstalled } = await import('../../../src/lib/hooks.js');
      expect(isHookInstalled()).toBe(false);
    });
  });

  describe('needsUpdate', () => {
    it('returns true when packaged version is newer', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('notify-247.sh') && pathStr.includes('.247')) {
          return '#!/bin/bash\n# VERSION: 2.24.0';
        }
        if (pathStr.includes('notify-247.sh')) {
          return '#!/bin/bash\n# VERSION: 2.25.0';
        }
        if (pathStr.includes('package.json')) {
          return JSON.stringify({ version: '2.25.0' });
        }
        return '';
      });

      const { needsUpdate } = await import('../../../src/lib/hooks.js');
      expect(needsUpdate()).toBe(true);
    });

    it('returns false when versions match', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('notify-247.sh')) {
          return '#!/bin/bash\n# VERSION: 2.25.0';
        }
        if (pathStr.includes('package.json')) {
          return JSON.stringify({ version: '2.25.0' });
        }
        return '';
      });

      const { needsUpdate } = await import('../../../src/lib/hooks.js');
      expect(needsUpdate()).toBe(false);
    });

    it('returns true when no installed version', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockImplementation((path) => {
        return !String(path).includes('.247/hooks');
      });
      vi.mocked(readFileSync).mockImplementation((path) => {
        if (String(path).includes('package.json')) {
          return JSON.stringify({ version: '2.25.0' });
        }
        return '#!/bin/bash\n# VERSION: 2.25.0';
      });

      const { needsUpdate } = await import('../../../src/lib/hooks.js');
      expect(needsUpdate()).toBe(true);
    });
  });

  describe('getHooksStatus', () => {
    it('returns comprehensive status when hooks installed', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('settings.json')) {
          return JSON.stringify(createMockSettings());
        }
        if (pathStr.includes('notify-247.sh')) {
          return '#!/bin/bash\n# VERSION: 2.25.0';
        }
        if (pathStr.includes('package.json')) {
          return JSON.stringify({ version: '2.25.0' });
        }
        return '';
      });

      const { getHooksStatus } = await import('../../../src/lib/hooks.js');
      const status = getHooksStatus();

      expect(status.installed).toBe(true);
      expect(status.version).toBe('2.25.0');
      expect(status.settingsConfigured).toBe(true);
      expect(status.needsUpdate).toBe(false);
    });

    it('returns not installed when script missing', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('settings.json');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({}));

      const { getHooksStatus } = await import('../../../src/lib/hooks.js');
      const status = getHooksStatus();

      expect(status.installed).toBe(false);
      expect(status.version).toBeNull();
    });
  });

  describe('installHook', () => {
    it('installs hook successfully', async () => {
      const { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, chmodSync } =
        await import('fs');

      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        // Packaged hook exists (check for notify-247.sh in any location that's not .247)
        if (pathStr.includes('notify-247.sh') && !pathStr.includes('.247')) {
          return true;
        }
        // Settings file and .claude dir exist
        if (pathStr.includes('settings.json') || pathStr.includes('.claude')) {
          return true;
        }
        // pnpm-workspace.yaml for dev detection
        if (pathStr.includes('pnpm-workspace.yaml')) {
          return true;
        }
        // Hooks dir doesn't exist yet
        return false;
      });

      vi.mocked(readFileSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('settings.json')) {
          return JSON.stringify({});
        }
        if (pathStr.includes('notify-247.sh')) {
          return '#!/bin/bash\n# VERSION: 2.25.0';
        }
        return '';
      });

      const { installHook } = await import('../../../src/lib/hooks.js');
      const result = installHook();

      expect(result.success).toBe(true);
      expect(mkdirSync).toHaveBeenCalled();
      expect(copyFileSync).toHaveBeenCalled();
      expect(chmodSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('fails when packaged hook not found', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { installHook } = await import('../../../src/lib/hooks.js');
      const result = installHook();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('preserves existing hooks in settings', async () => {
      const { existsSync, readFileSync, writeFileSync, copyFileSync, chmodSync } =
        await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        const pathStr = String(path);
        if (pathStr.includes('settings.json')) {
          return JSON.stringify({
            hooks: {
              Notification: [
                {
                  matcher: '*.ts',
                  hooks: [{ type: 'command', command: 'other-hook.sh' }],
                },
              ],
              OtherEvent: [{ matcher: '*', hooks: [] }],
            },
          });
        }
        if (pathStr.includes('notify-247.sh')) {
          return '#!/bin/bash\n# VERSION: 2.25.0';
        }
        return '';
      });

      const { installHook } = await import('../../../src/lib/hooks.js');
      installHook();

      // Check that writeFileSync was called with settings that preserve other hooks
      const writeCall = vi
        .mocked(writeFileSync)
        .mock.calls.find((call) => String(call[0]).includes('settings.json'));
      expect(writeCall).toBeDefined();
      const writtenSettings = JSON.parse(writeCall![1] as string);
      expect(writtenSettings.hooks.OtherEvent).toBeDefined();
      expect(writtenSettings.hooks.Notification.length).toBe(2);
    });
  });

  describe('uninstallHook', () => {
    it('removes hook from settings and deletes script', async () => {
      const { existsSync, readFileSync, writeFileSync, unlinkSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if (String(path).includes('settings.json')) {
          return JSON.stringify({
            hooks: {
              Notification: [
                {
                  matcher: '*',
                  hooks: [{ type: 'command', command: 'bash ~/.247/hooks/notify-247.sh' }],
                },
              ],
            },
          });
        }
        return '';
      });

      const { uninstallHook } = await import('../../../src/lib/hooks.js');
      const result = uninstallHook(true);

      expect(result.success).toBe(true);
      expect(unlinkSync).toHaveBeenCalled();
      expect(writeFileSync).toHaveBeenCalled();
    });

    it('keeps script when removeScript is false', async () => {
      const { existsSync, readFileSync, writeFileSync, unlinkSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if (String(path).includes('settings.json')) {
          return JSON.stringify({
            hooks: {
              Notification: [
                {
                  matcher: '*',
                  hooks: [{ type: 'command', command: 'bash ~/.247/hooks/notify-247.sh' }],
                },
              ],
            },
          });
        }
        return '';
      });

      const { uninstallHook } = await import('../../../src/lib/hooks.js');
      const result = uninstallHook(false);

      expect(result.success).toBe(true);
      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('cleans up empty hooks object', async () => {
      const { existsSync, readFileSync, writeFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((path) => {
        if (String(path).includes('settings.json')) {
          return JSON.stringify({
            hooks: {
              Notification: [
                {
                  matcher: '*',
                  hooks: [{ type: 'command', command: 'bash ~/.247/hooks/notify-247.sh' }],
                },
              ],
            },
          });
        }
        return '';
      });

      const { uninstallHook } = await import('../../../src/lib/hooks.js');
      uninstallHook(false);

      const writeCall = vi
        .mocked(writeFileSync)
        .mock.calls.find((call) => String(call[0]).includes('settings.json'));
      const writtenSettings = JSON.parse(writeCall![1] as string);
      expect(writtenSettings.hooks).toBeUndefined();
    });
  });
});
