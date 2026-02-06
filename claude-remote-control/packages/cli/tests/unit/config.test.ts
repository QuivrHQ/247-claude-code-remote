import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock paths module
vi.mock('../../src/lib/paths.js', () => ({
  getAgentPaths: () => ({
    configDir: '/mock/.247',
    configPath: '/mock/.247/config.json',
    dataDir: '/mock/.247/data',
    logDir: '/mock/.247/logs',
    pidFile: '/mock/.247/agent.pid',
  }),
  ensureDirectories: vi.fn(),
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('CLI Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const validConfig = {
    agent: { port: 4678 },
    projects: { basePath: '~/Dev', whitelist: [] },
  };

  describe('loadConfig', () => {
    it('returns null if config file does not exist', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { loadConfig } = await import('../../src/lib/config.js');
      expect(loadConfig()).toBeNull();
    });

    it('loads and parses valid config', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const { loadConfig } = await import('../../src/lib/config.js');
      const config = loadConfig();

      expect(config).toEqual(validConfig);
    });

    it('applies AGENT_247_PORT env override', async () => {
      process.env.AGENT_247_PORT = '5000';

      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const { loadConfig } = await import('../../src/lib/config.js');
      const config = loadConfig();

      expect(config?.agent.port).toBe(5000);
    });

    it('applies AGENT_247_PROJECTS env override', async () => {
      process.env.AGENT_247_PROJECTS = '/custom/projects';

      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const { loadConfig } = await import('../../src/lib/config.js');
      const config = loadConfig();

      expect(config?.projects.basePath).toBe('/custom/projects');
    });

    it('returns null for invalid JSON', async () => {
      const { existsSync, readFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('{ invalid json }');

      const { loadConfig } = await import('../../src/lib/config.js');
      expect(loadConfig()).toBeNull();
    });
  });

  describe('saveConfig', () => {
    it('writes config to file', async () => {
      const { existsSync, writeFileSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const { saveConfig } = await import('../../src/lib/config.js');
      saveConfig(validConfig);

      expect(writeFileSync).toHaveBeenCalledWith(
        '/mock/.247/config.json',
        JSON.stringify(validConfig, null, 2),
        'utf-8'
      );
    });
  });

  describe('createConfig', () => {
    it('creates config with defaults', async () => {
      const { createConfig } = await import('../../src/lib/config.js');
      const config = createConfig({});

      expect(config.agent.port).toBe(4678);
      expect(config.projects.basePath).toBe('~/Dev');
    });

    it('uses provided port and projects path', async () => {
      const { createConfig } = await import('../../src/lib/config.js');
      const config = createConfig({
        port: 5000,
        projectsPath: '/custom/path',
      });

      expect(config.agent.port).toBe(5000);
      expect(config.projects.basePath).toBe('/custom/path');
    });
  });

  describe('configExists', () => {
    it('returns true if config file exists', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);

      const { configExists } = await import('../../src/lib/config.js');
      expect(configExists()).toBe(true);
    });

    it('returns false if config file does not exist', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const { configExists } = await import('../../src/lib/config.js');
      expect(configExists()).toBe(false);
    });
  });
});
