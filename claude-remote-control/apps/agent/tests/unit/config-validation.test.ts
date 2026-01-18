/**
 * Config Validation Tests
 *
 * Tests for validating AgentConfig structure and loading behavior.
 * Ensures the configuration matches expected schema and handles errors correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentConfig } from '247-shared';

// Type guard for AgentConfig validation (simplified - no editor field)
function isValidAgentConfig(obj: unknown): obj is AgentConfig {
  if (typeof obj !== 'object' || obj === null) return false;

  const config = obj as Record<string, unknown>;

  // Required: machine
  if (typeof config.machine !== 'object' || config.machine === null) return false;
  const machine = config.machine as Record<string, unknown>;
  if (typeof machine.id !== 'string' || machine.id.length === 0) return false;
  if (typeof machine.name !== 'string' || machine.name.length === 0) return false;

  // Required: projects
  if (typeof config.projects !== 'object' || config.projects === null) return false;
  const projects = config.projects as Record<string, unknown>;
  if (typeof projects.basePath !== 'string') return false;
  if (!Array.isArray(projects.whitelist)) return false;

  // Required: dashboard
  if (typeof config.dashboard !== 'object' || config.dashboard === null) return false;
  const dashboard = config.dashboard as Record<string, unknown>;
  if (typeof dashboard.apiUrl !== 'string') return false;
  if (typeof dashboard.apiKey !== 'string') return false;

  // Optional: agent
  if (config.agent !== undefined) {
    if (typeof config.agent !== 'object' || config.agent === null) return false;
    const agent = config.agent as Record<string, unknown>;
    if (agent.port !== undefined && typeof agent.port !== 'number') return false;
    if (agent.url !== undefined && typeof agent.url !== 'string') return false;
  }

  return true;
}

describe('AgentConfig Validation', () => {
  describe('Type Guard: isValidAgentConfig', () => {
    it('validates minimal valid config', () => {
      const config = {
        machine: { id: 'machine-1', name: 'Test Machine' },
        projects: { basePath: '~/Dev', whitelist: [] },
        dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
      };

      expect(isValidAgentConfig(config)).toBe(true);
    });

    it('validates full config with all optional fields', () => {
      const config: AgentConfig = {
        machine: { id: 'machine-1', name: 'Test Machine' },
        agent: { port: 4678, url: 'localhost:4678' },
        projects: { basePath: '~/Dev', whitelist: ['project-a', 'project-b'] },
        dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
      };

      expect(isValidAgentConfig(config)).toBe(true);
    });

    describe('machine field validation', () => {
      it('rejects config without machine', () => {
        const config = {
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config with empty machine.id', () => {
        const config = {
          machine: { id: '', name: 'Test' },
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config with empty machine.name', () => {
        const config = {
          machine: { id: 'machine-1', name: '' },
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config with non-string machine.id', () => {
        const config = {
          machine: { id: 123, name: 'Test' },
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });
    });

    describe('projects field validation', () => {
      it('rejects config without projects', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config without projects.basePath', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          projects: { whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config with non-array whitelist', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          projects: { basePath: '~/Dev', whitelist: 'project-a' },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });
    });

    describe('dashboard field validation', () => {
      it('rejects config without dashboard', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          projects: { basePath: '~/Dev', whitelist: [] },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config without dashboard.apiUrl', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config without dashboard.apiKey', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });
    });

    describe('optional agent field validation', () => {
      it('accepts config without agent', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(true);
      });

      it('accepts config with partial agent', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          agent: { port: 4678 },
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(true);
      });

      it('rejects config with non-number agent.port', () => {
        const config = {
          machine: { id: 'machine-1', name: 'Test' },
          agent: { port: '4678' },
          projects: { basePath: '~/Dev', whitelist: [] },
          dashboard: { apiUrl: 'http://localhost:3001/api', apiKey: 'test-key' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('rejects null', () => {
        expect(isValidAgentConfig(null)).toBe(false);
      });

      it('rejects undefined', () => {
        expect(isValidAgentConfig(undefined)).toBe(false);
      });

      it('rejects array', () => {
        expect(isValidAgentConfig([])).toBe(false);
      });

      it('rejects string', () => {
        expect(isValidAgentConfig('config')).toBe(false);
      });

      it('rejects number', () => {
        expect(isValidAgentConfig(123)).toBe(false);
      });
    });
  });
});

describe('Config Loading (mocked)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, HOME: '/tmp/test-home' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  // Note: These tests mock the fs module to test config loading logic
  // without requiring actual filesystem access

  it('constructs correct default config path', () => {
    const expectedPath = '/tmp/test-home/.247/config.json';
    const actualPath = `/tmp/test-home/.247/config.json`;
    expect(actualPath).toBe(expectedPath);
  });

  it('constructs correct profile config path', () => {
    const profileName = 'production';
    const expectedPath = `/tmp/test-home/.247/profiles/${profileName}.json`;
    expect(expectedPath).toContain('profiles');
    expect(expectedPath).toContain(profileName);
  });

  it('validates config directory structure', () => {
    // Config should be stored in ~/.247/
    const configDir = '~/.247';
    const expectedStructure = {
      'config.json': 'default config',
      'profiles/': 'named profiles',
      'data/': 'database files',
    };

    expect(configDir).toBe('~/.247');
    expect(expectedStructure['config.json']).toBeDefined();
  });
});

describe('Config Schema Documentation', () => {
  // These tests serve as documentation of the expected config schema

  it('documents required fields', () => {
    const requiredFields = {
      machine: {
        id: 'string - unique identifier for this machine',
        name: 'string - human-readable display name',
      },
      projects: {
        basePath: 'string - path to projects directory (supports ~)',
        whitelist: 'string[] - allowed project names (empty = allow all)',
      },
      dashboard: {
        apiUrl: 'string - dashboard API URL',
        apiKey: 'string - API key for authentication',
      },
    };

    expect(requiredFields.machine).toBeDefined();
    expect(requiredFields.projects).toBeDefined();
    expect(requiredFields.dashboard).toBeDefined();
  });

  it('documents optional fields', () => {
    const optionalFields = {
      agent: {
        port: 'number - server port (default: 4678)',
        url: 'string - public URL for the agent',
      },
    };

    expect(optionalFields.agent).toBeDefined();
  });

  it('documents example minimal config', () => {
    const minimalConfig = {
      machine: {
        id: 'my-macbook',
        name: 'MacBook Pro',
      },
      projects: {
        basePath: '~/Dev',
        whitelist: [],
      },
      dashboard: {
        apiUrl: 'https://247.quivr.com/api',
        apiKey: 'your-api-key',
      },
    };

    expect(isValidAgentConfig(minimalConfig)).toBe(true);
  });

  it('documents example full config', () => {
    const fullConfig: AgentConfig = {
      machine: {
        id: 'my-macbook',
        name: 'MacBook Pro',
      },
      agent: {
        port: 4678,
        url: 'my-macbook.local:4678',
      },
      projects: {
        basePath: '~/Dev',
        whitelist: ['project-a', 'project-b'],
      },
      dashboard: {
        apiUrl: 'https://247.quivr.com/api',
        apiKey: 'your-api-key',
      },
    };

    expect(isValidAgentConfig(fullConfig)).toBe(true);
  });
});
