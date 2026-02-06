import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';

// Mock fs before importing the module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('Agent Config', () => {
  const mockHome = '/mock/home';
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.HOME = mockHome;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const validConfig = {
    projects: { basePath: '~/Dev', whitelist: [] },
  };

  describe('loadConfig', () => {
    it('loads default config from ~/.247/config.json', async () => {
      const { existsSync, readFileSync } = await import('fs');
      const mockedExistsSync = vi.mocked(existsSync);
      const mockedReadFileSync = vi.mocked(readFileSync);

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const { loadConfig } = await import('../../src/config.js');
      const config = loadConfig();

      expect(config).toEqual(validConfig);
      expect(mockedExistsSync).toHaveBeenCalledWith(resolve(mockHome, '.247', 'config.json'));
    });

    it('throws error if no config found', async () => {
      const { existsSync } = await import('fs');
      const mockedExistsSync = vi.mocked(existsSync);
      mockedExistsSync.mockReturnValue(false);

      // Module import will throw because loadConfig() is called at module load time
      await expect(import('../../src/config.js')).rejects.toThrow('No configuration found');
    });

    it('caches config after first load (returns same reference)', async () => {
      const { existsSync, readFileSync } = await import('fs');
      const mockedExistsSync = vi.mocked(existsSync);
      const mockedReadFileSync = vi.mocked(readFileSync);

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(JSON.stringify(validConfig));

      const { loadConfig, config } = await import('../../src/config.js');

      // loadConfig() should return cached config (same as exported config)
      const config2 = loadConfig();

      expect(config).toBe(config2);
      // readFileSync should only be called once (at module load)
      expect(mockedReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('throws error for invalid JSON at module load', async () => {
      const { existsSync, readFileSync } = await import('fs');
      const mockedExistsSync = vi.mocked(existsSync);
      const mockedReadFileSync = vi.mocked(readFileSync);

      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('{ invalid json }');

      // Module import will throw because loadConfig() is called at module load time
      // and invalid JSON falls through to the "no config found" error
      await expect(import('../../src/config.js')).rejects.toThrow('No configuration found');
    });
  });
});
