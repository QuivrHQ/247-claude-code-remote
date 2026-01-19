/**
 * Hooks Command Tests
 *
 * Tests for the hooks command that manages Claude Code notification hooks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    bold: (s: string) => s,
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
  },
}));

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

// Mock hooks lib
vi.mock('../../../src/lib/hooks.js', () => ({
  getHooksStatus: vi.fn(),
  installHook: vi.fn(),
  uninstallHook: vi.fn(),
  needsUpdate: vi.fn(),
  getHookVersion: vi.fn(),
  getPackagedHookVersion: vi.fn(),
}));

describe('Hooks Command', () => {
  let consoleLogs: string[];
  let originalConsoleLog: typeof console.log;
  let exitMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Capture console output
    consoleLogs = [];
    originalConsoleLog = console.log;
    console.log = vi.fn((...args) => {
      consoleLogs.push(args.join(' '));
    });

    // Mock process.exit
    exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    exitMock.mockRestore();
  });

  describe('install subcommand', () => {
    it('installs hooks when not installed', async () => {
      const { getHooksStatus, installHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        version: null,
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: false,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });
      vi.mocked(installHook).mockReturnValue({
        success: true,
        installedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'install']);

      expect(installHook).toHaveBeenCalled();
    });

    it('skips install when already up to date', async () => {
      const { getHooksStatus, installHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.25.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'install']);

      expect(installHook).not.toHaveBeenCalled();
    });

    it('updates when newer version available', async () => {
      const { getHooksStatus, installHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.24.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: true,
        packagedVersion: '2.25.0',
      });
      vi.mocked(installHook).mockReturnValue({
        success: true,
        installedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'install']);

      expect(installHook).toHaveBeenCalled();
    });

    it('force reinstalls when --force flag used', async () => {
      const { getHooksStatus, installHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.25.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });
      vi.mocked(installHook).mockReturnValue({
        success: true,
        installedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'install', '--force']);

      expect(installHook).toHaveBeenCalled();
    });

    it('exits with error on install failure', async () => {
      const { getHooksStatus, installHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        version: null,
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: false,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });
      vi.mocked(installHook).mockReturnValue({
        success: false,
        error: 'Permission denied',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');

      try {
        await hooksCommand.parseAsync(['node', 'hooks', 'install']);
      } catch (e) {
        expect((e as Error).message).toBe('process.exit');
      }

      expect(exitMock).toHaveBeenCalledWith(1);
    });
  });

  describe('uninstall subcommand', () => {
    it('uninstalls hooks when installed', async () => {
      const { getHooksStatus, uninstallHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.25.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });
      vi.mocked(uninstallHook).mockReturnValue({ success: true });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'uninstall']);

      expect(uninstallHook).toHaveBeenCalledWith(true);
    });

    it('keeps script when --keep-script flag used', async () => {
      const { getHooksStatus, uninstallHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.25.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });
      vi.mocked(uninstallHook).mockReturnValue({ success: true });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'uninstall', '--keep-script']);

      expect(uninstallHook).toHaveBeenCalledWith(false);
    });

    it('does nothing when not installed', async () => {
      const { getHooksStatus, uninstallHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        version: null,
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: false,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'uninstall']);

      expect(uninstallHook).not.toHaveBeenCalled();
    });
  });

  describe('status subcommand', () => {
    it('shows installed status', async () => {
      const { getHooksStatus } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.25.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'status']);

      expect(consoleLogs.some((log) => log.includes('installed'))).toBe(true);
      expect(consoleLogs.some((log) => log.includes('2.25.0'))).toBe(true);
    });

    it('shows update available', async () => {
      const { getHooksStatus } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.24.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: true,
        packagedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'status']);

      expect(consoleLogs.some((log) => log.includes('Update available'))).toBe(true);
    });

    it('shows not installed status', async () => {
      const { getHooksStatus } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        version: null,
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: false,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'status']);

      expect(consoleLogs.some((log) => log.includes('not installed'))).toBe(true);
    });
  });

  describe('update subcommand', () => {
    it('updates hooks when update available', async () => {
      const { getHooksStatus, installHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.24.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: true,
        packagedVersion: '2.25.0',
      });
      vi.mocked(installHook).mockReturnValue({
        success: true,
        installedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'update']);

      expect(installHook).toHaveBeenCalled();
    });

    it('does nothing when already up to date', async () => {
      const { getHooksStatus, installHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: true,
        version: '2.25.0',
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: true,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'update']);

      expect(installHook).not.toHaveBeenCalled();
    });

    it('prompts install when not installed', async () => {
      const { getHooksStatus, installHook } = await import('../../../src/lib/hooks.js');
      vi.mocked(getHooksStatus).mockReturnValue({
        installed: false,
        version: null,
        path: '/home/user/.247/hooks/notify-247.sh',
        settingsConfigured: false,
        needsUpdate: false,
        packagedVersion: '2.25.0',
      });

      const { hooksCommand } = await import('../../../src/commands/hooks.js');
      await hooksCommand.parseAsync(['node', 'hooks', 'update']);

      expect(installHook).not.toHaveBeenCalled();
    });
  });
});
