/**
 * CLI Hooks Installer Tests
 *
 * Tests for the simplified hooks installer (only getHooksStatus and uninstallHooks).
 * The install functionality has been removed - statusLine is now auto-configured by the agent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock paths module
const mockPaths = {
  configDir: '/mock/.247',
  configPath: '/mock/.247/config.json',
  dataDir: '/mock/.247/data',
  logDir: '/mock/.247/logs',
  pidFile: '/mock/.247/agent.pid',
  agentRoot: '/mock/agent',
  hooksDestination: '/mock/.claude-plugins/247-hooks',
  isDev: false,
  nodePath: '/usr/local/bin/node',
};

vi.mock('../../src/lib/paths.js', () => ({
  getAgentPaths: () => mockPaths,
  ensureDirectories: vi.fn(),
}));

// Mock os module
vi.mock('os', () => ({
  homedir: () => '/mock/home',
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  symlinkSync: vi.fn(),
  unlinkSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  lstatSync: vi.fn(),
  rmSync: vi.fn(),
}));

describe('CLI Hooks Installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getHooksStatus', () => {
    it('returns not installed if plugin.json missing and no settings hooks', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readFileSync).mockReturnValue('{}');

      const { getHooksStatus } = await import('../../src/hooks/installer.js');
      const status = getHooksStatus();

      expect(status.installed).toBe(false);
      expect(status.path).toBe('/mock/.claude-plugins/247-hooks');
      expect(status.settingsHooksFound).toBe(false);
    });

    it('returns installed if plugin directory exists', async () => {
      const { existsSync, lstatSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue('{}');

      const { getHooksStatus } = await import('../../src/hooks/installer.js');
      const status = getHooksStatus();

      expect(status.installed).toBe(true);
      expect(status.isSymlink).toBe(false);
    });

    it('returns installed if settings.json has old hooks', async () => {
      const { existsSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        // Plugin dir doesn't exist, but settings.json does
        if (path.includes('247-hooks')) return false;
        if (path.includes('settings.json')) return true;
        return false;
      });
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          hooks: {
            Stop: [{ hooks: [{ command: 'bash /some/path/notify-status.sh' }] }],
          },
        })
      );

      const { getHooksStatus } = await import('../../src/hooks/installer.js');
      const status = getHooksStatus();

      expect(status.installed).toBe(true);
      expect(status.settingsHooksFound).toBe(true);
    });

    it('detects symlink installation', async () => {
      const { existsSync, lstatSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => true } as any);
      vi.mocked(readFileSync).mockReturnValue('{}');

      const { getHooksStatus } = await import('../../src/hooks/installer.js');
      const status = getHooksStatus();

      expect(status.isSymlink).toBe(true);
    });
  });

  describe('uninstallHooks', () => {
    it('returns success if already uninstalled', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(readFileSync).mockReturnValue('{}');

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(true);
    });

    it('removes symlink installation', async () => {
      const { existsSync, lstatSync, unlinkSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        if (path.includes('247-hooks')) return true;
        if (path.includes('settings.json')) return true;
        return false;
      });
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => true } as any);
      vi.mocked(readFileSync).mockReturnValue('{}'); // No old hooks in settings

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(true);
      expect(unlinkSync).toHaveBeenCalledWith('/mock/.claude-plugins/247-hooks');
    });

    it('removes directory installation', async () => {
      const { existsSync, lstatSync, rmSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        if (path.includes('247-hooks')) return true;
        if (path.includes('settings.json')) return true;
        return false;
      });
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(readFileSync).mockReturnValue('{}'); // No old hooks in settings

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(true);
      expect(rmSync).toHaveBeenCalledWith('/mock/.claude-plugins/247-hooks', {
        recursive: true,
        force: true,
      });
    });

    it('removes old hooks from settings.json', async () => {
      const { existsSync, readFileSync, writeFileSync } = await import('fs');

      const oldSettings = {
        statusLine: { type: 'command', command: 'bash ~/.247/statusline.sh' },
        hooks: {
          Stop: [{ hooks: [{ command: 'bash /path/notify-status.sh' }] }],
        },
      };

      vi.mocked(existsSync).mockImplementation((path: any) => {
        if (path.includes('247-hooks')) return false; // No plugin dir
        if (path.includes('settings.json')) return true;
        return false;
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(oldSettings));

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(true);
      expect(writeFileSync).toHaveBeenCalled();

      // Check that hooks were removed but statusLine was kept
      const writtenContent = vi.mocked(writeFileSync).mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.hooks).toBeUndefined();
      expect(parsed.statusLine).toBeDefined();
    });

    it('returns error on plugin dir removal failure', async () => {
      const { existsSync, lstatSync, rmSync, readFileSync } = await import('fs');

      vi.mocked(existsSync).mockImplementation((path: any) => {
        if (path.includes('247-hooks')) return true;
        if (path.includes('settings.json')) return true;
        return false;
      });
      vi.mocked(lstatSync).mockReturnValue({ isSymbolicLink: () => false } as any);
      vi.mocked(rmSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });
      vi.mocked(readFileSync).mockReturnValue('{}');

      const { uninstallHooks } = await import('../../src/hooks/installer.js');
      const result = uninstallHooks();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });
});
