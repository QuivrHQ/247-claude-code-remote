import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    writeFileSync: vi.fn(),
  };
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn(() => ({
      unref: vi.fn(),
      pid: 12345,
    })),
  };
});

vi.mock('../../src/logger.js', () => ({
  logger: {
    main: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

vi.mock('../../src/websocket-handlers.js', () => ({
  broadcastUpdatePending: vi.fn(),
}));

describe('Updater Module', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Reset process.exit mock
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('isUpdateInProgress', () => {
    it('returns false initially', async () => {
      const { isUpdateInProgress } = await import('../../src/updater.js');
      expect(isUpdateInProgress()).toBe(false);
    });
  });

  describe('triggerUpdate', () => {
    it('creates update script with correct content', async () => {
      vi.useFakeTimers();
      const { writeFileSync } = await import('fs');
      const mockedWriteFileSync = vi.mocked(writeFileSync);

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.2.3');

      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        '/tmp/247-update.sh',
        expect.stringContaining('npm install -g 247-cli@1.2.3'),
        { mode: 0o755 }
      );

      // Advance timer to trigger process.exit
      vi.advanceTimersByTime(1100);
    });

    it('changes to /tmp directory to avoid blocking agent directory', async () => {
      vi.useFakeTimers();
      const { writeFileSync } = await import('fs');
      const mockedWriteFileSync = vi.mocked(writeFileSync);

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      const scriptContent = mockedWriteFileSync.mock.calls[0][1] as string;
      // Script should cd to /tmp before npm install to avoid ENOTEMPTY errors
      expect(scriptContent).toContain('cd /tmp');
      // The cd should come before the actual npm install command (not the comment)
      const cdIndex = scriptContent.indexOf('cd /tmp');
      const npmIndex = scriptContent.indexOf('npm install -g');
      expect(cdIndex).toBeLessThan(npmIndex);

      vi.advanceTimersByTime(1100);
    });

    it('fixes executable permissions after npm install', async () => {
      vi.useFakeTimers();
      const { writeFileSync } = await import('fs');
      const mockedWriteFileSync = vi.mocked(writeFileSync);

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      const scriptContent = mockedWriteFileSync.mock.calls[0][1] as string;
      // Script should chmod +x the CLI binary after install
      expect(scriptContent).toContain('chmod +x');
      expect(scriptContent).toContain('dist/index.js');
      // The chmod should come after npm install
      const npmIndex = scriptContent.indexOf('npm install');
      const chmodIndex = scriptContent.indexOf('chmod +x');
      expect(chmodIndex).toBeGreaterThan(npmIndex);

      vi.advanceTimersByTime(1100);
    });

    it('spawns detached process', async () => {
      vi.useFakeTimers();
      const { spawn } = await import('child_process');
      const mockedSpawn = vi.mocked(spawn);

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      expect(mockedSpawn).toHaveBeenCalledWith(
        'bash',
        ['/tmp/247-update.sh'],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        })
      );

      vi.advanceTimersByTime(1100);
    });

    it('sets PATH in spawn environment', async () => {
      vi.useFakeTimers();
      const { spawn } = await import('child_process');
      const mockedSpawn = vi.mocked(spawn);

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      const spawnOptions = mockedSpawn.mock.calls[0][2] as { env: Record<string, string> };
      expect(spawnOptions.env.PATH).toContain('/opt/homebrew/bin');
      expect(spawnOptions.env.PATH).toContain('/usr/local/bin');

      vi.advanceTimersByTime(1100);
    });

    it('exits process after delay', async () => {
      vi.useFakeTimers();
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      expect(exitSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1100);

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('logs update trigger', async () => {
      vi.useFakeTimers();
      const { logger } = await import('../../src/logger.js');

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('3.0.0');

      expect(logger.main.info).toHaveBeenCalledWith(
        { targetVersion: '3.0.0' },
        'Auto-update triggered'
      );

      vi.advanceTimersByTime(1100);
    });
  });

  describe('platform-specific restart commands', () => {
    it('uses launchctl on darwin', async () => {
      vi.useFakeTimers();
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const { writeFileSync } = await import('fs');
      const mockedWriteFileSync = vi.mocked(writeFileSync);

      // Need to re-import to pick up new platform
      vi.resetModules();
      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      const scriptContent = mockedWriteFileSync.mock.calls[0][1] as string;
      expect(scriptContent).toContain('launchctl kickstart');

      vi.advanceTimersByTime(1100);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('uses systemctl on linux', async () => {
      vi.useFakeTimers();
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const { writeFileSync } = await import('fs');
      const mockedWriteFileSync = vi.mocked(writeFileSync);

      vi.resetModules();
      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      const scriptContent = mockedWriteFileSync.mock.calls[0][1] as string;
      expect(scriptContent).toContain('systemctl --user restart');

      vi.advanceTimersByTime(1100);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('nvm support', () => {
    it('sources nvm in update script for Linux compatibility', async () => {
      vi.useFakeTimers();
      const { writeFileSync } = await import('fs');
      const mockedWriteFileSync = vi.mocked(writeFileSync);

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      const scriptContent = mockedWriteFileSync.mock.calls[0][1] as string;
      // Script should source nvm if available
      expect(scriptContent).toContain('NVM_DIR');
      expect(scriptContent).toContain('source "$NVM_DIR/nvm.sh"');
      // The nvm sourcing should come before npm install
      const nvmIndex = scriptContent.indexOf('source "$NVM_DIR/nvm.sh"');
      const npmIndex = scriptContent.indexOf('npm install -g');
      expect(nvmIndex).toBeLessThan(npmIndex);

      vi.advanceTimersByTime(1100);
    });

    it('passes NVM_DIR in spawn environment', async () => {
      vi.useFakeTimers();
      const { spawn } = await import('child_process');
      const mockedSpawn = vi.mocked(spawn);

      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      const spawnOptions = mockedSpawn.mock.calls[0][2] as { env: Record<string, string> };
      expect(spawnOptions.env.NVM_DIR).toBeDefined();
      expect(spawnOptions.env.NVM_DIR).toContain('.nvm');

      vi.advanceTimersByTime(1100);
    });

    it('includes NVM_BIN in PATH if set', async () => {
      vi.useFakeTimers();
      const originalNvmBin = process.env.NVM_BIN;
      process.env.NVM_BIN = '/home/user/.nvm/versions/node/v22.0.0/bin';

      const { spawn } = await import('child_process');
      const mockedSpawn = vi.mocked(spawn);

      vi.resetModules();
      const { triggerUpdate } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      const spawnOptions = mockedSpawn.mock.calls[0][2] as { env: Record<string, string> };
      expect(spawnOptions.env.PATH).toContain('/home/user/.nvm/versions/node/v22.0.0/bin');

      vi.advanceTimersByTime(1100);

      if (originalNvmBin) {
        process.env.NVM_BIN = originalNvmBin;
      } else {
        delete process.env.NVM_BIN;
      }
    });
  });

  describe('error handling', () => {
    it('handles writeFileSync error', async () => {
      vi.useFakeTimers();
      const { writeFileSync } = await import('fs');
      const mockedWriteFileSync = vi.mocked(writeFileSync);
      mockedWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { logger } = await import('../../src/logger.js');

      vi.resetModules();
      const { triggerUpdate, isUpdateInProgress } = await import('../../src/updater.js');
      triggerUpdate('1.0.0');

      expect(logger.main.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        'Failed to write update script'
      );

      // Update should not be in progress after error
      expect(isUpdateInProgress()).toBe(false);
    });
  });
});
