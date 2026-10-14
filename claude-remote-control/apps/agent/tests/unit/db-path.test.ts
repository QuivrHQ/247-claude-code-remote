import { describe, it, expect } from 'vitest';
import { join, resolve } from 'path';
import { getDefaultDbPath } from '../../src/db/index.js';

/**
 * Regression guard for test-suite hermeticity.
 *
 * These assertions fail loudly if the AGENT_DB_PATH override (configured in
 * tests/setup.ts via vitest's setupFiles) ever stops protecting the developer's
 * real database at ~/.247/data/agent.db.
 */
describe('agent database path (hermetic test environment)', () => {
  const realDataDir = resolve(process.env.HOME || '~', '.247', 'data');
  const realDbPath = join(realDataDir, 'agent.db');

  it('sets AGENT_DB_PATH so the suite never touches the real database', () => {
    expect(process.env.AGENT_DB_PATH).toBeTruthy();
  });

  it('resolves the default db path outside the real ~/.247 data directory', () => {
    const resolved = getDefaultDbPath();
    expect(resolved).not.toBe(realDbPath);
    expect(resolved.startsWith(realDataDir)).toBe(false);
  });

  it('falls back to ~/.247/data/agent.db in production (no override)', () => {
    const saved = process.env.AGENT_DB_PATH;
    delete process.env.AGENT_DB_PATH;
    try {
      expect(getDefaultDbPath()).toBe(realDbPath);
    } finally {
      if (saved !== undefined) {
        process.env.AGENT_DB_PATH = saved;
      }
    }
  });
});
