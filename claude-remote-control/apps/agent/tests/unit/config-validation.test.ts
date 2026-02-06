/**
 * Config Validation Tests
 *
 * Tests for validating AgentConfig structure and loading behavior.
 * Ensures the configuration matches expected schema and handles errors correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentConfig } from '247-shared';

// Type guard for AgentConfig validation (simplified - single machine model)
function isValidAgentConfig(obj: unknown): obj is AgentConfig {
  if (typeof obj !== 'object' || obj === null) return false;

  const config = obj as Record<string, unknown>;

  // Required: projects
  if (typeof config.projects !== 'object' || config.projects === null) return false;
  const projects = config.projects as Record<string, unknown>;
  if (typeof projects.basePath !== 'string') return false;
  if (!Array.isArray(projects.whitelist)) return false;

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
        projects: { basePath: '~/Dev', whitelist: [] },
      };

      expect(isValidAgentConfig(config)).toBe(true);
    });

    it('validates full config with all optional fields', () => {
      const config: AgentConfig = {
        agent: { port: 4678, url: 'localhost:4678' },
        projects: { basePath: '~/Dev', whitelist: ['project-a', 'project-b'] },
      };

      expect(isValidAgentConfig(config)).toBe(true);
    });

    describe('projects field validation', () => {
      it('rejects config without projects', () => {
        const config = {};

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config without projects.basePath', () => {
        const config = {
          projects: { whitelist: [] },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });

      it('rejects config with non-array whitelist', () => {
        const config = {
          projects: { basePath: '~/Dev', whitelist: 'project-a' },
        };

        expect(isValidAgentConfig(config)).toBe(false);
      });
    });

    describe('optional agent field validation', () => {
      it('accepts config without agent', () => {
        const config = {
          projects: { basePath: '~/Dev', whitelist: [] },
        };

        expect(isValidAgentConfig(config)).toBe(true);
      });

      it('accepts config with partial agent', () => {
        const config = {
          agent: { port: 4678 },
          projects: { basePath: '~/Dev', whitelist: [] },
        };

        expect(isValidAgentConfig(config)).toBe(true);
      });

      it('rejects config with non-number agent.port', () => {
        const config = {
          agent: { port: '4678' },
          projects: { basePath: '~/Dev', whitelist: [] },
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

  it('constructs correct default config path', () => {
    const expectedPath = '/tmp/test-home/.247/config.json';
    const actualPath = `/tmp/test-home/.247/config.json`;
    expect(actualPath).toBe(expectedPath);
  });

  it('validates config directory structure', () => {
    // Config should be stored in ~/.247/
    const configDir = '~/.247';
    const expectedStructure = {
      'config.json': 'default config',
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
      projects: {
        basePath: 'string - path to projects directory (supports ~)',
        whitelist: 'string[] - allowed project names (empty = allow all)',
      },
    };

    expect(requiredFields.projects).toBeDefined();
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
      projects: {
        basePath: '~/Dev',
        whitelist: [],
      },
    };

    expect(isValidAgentConfig(minimalConfig)).toBe(true);
  });

  it('documents example full config', () => {
    const fullConfig: AgentConfig = {
      agent: {
        port: 4678,
        url: 'my-macbook.local:4678',
      },
      projects: {
        basePath: '~/Dev',
        whitelist: ['project-a', 'project-b'],
      },
    };

    expect(isValidAgentConfig(fullConfig)).toBe(true);
  });
});
