/**
 * Database Schema Tests
 *
 * Tests for schema definitions, types, and configuration constants.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import {
  CREATE_TABLES_SQL,
  SCHEMA_VERSION,
  RETENTION_CONFIG,
  type DbSession,
  type DbStatusHistory,
  type DbEnvironment,
  type DbSessionEnvironment,
  type DbSchemaVersion,
  type UpsertSessionInput,
  type UpsertEnvironmentInput,
} from '../../src/db/schema.js';

describe('Database Schema', () => {
  describe('SCHEMA_VERSION', () => {
    it('is a positive integer', () => {
      expect(SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    });

    it('current version is 7', () => {
      expect(SCHEMA_VERSION).toBe(7);
    });
  });

  describe('RETENTION_CONFIG', () => {
    it('has all required fields', () => {
      expect(RETENTION_CONFIG.sessionMaxAge).toBeDefined();
      expect(RETENTION_CONFIG.archivedMaxAge).toBeDefined();
      expect(RETENTION_CONFIG.historyMaxAge).toBeDefined();
      expect(RETENTION_CONFIG.cleanupInterval).toBeDefined();
    });

    it('sessionMaxAge is 24 hours', () => {
      const expected = 24 * 60 * 60 * 1000;
      expect(RETENTION_CONFIG.sessionMaxAge).toBe(expected);
    });

    it('archivedMaxAge is 30 days', () => {
      const expected = 30 * 24 * 60 * 60 * 1000;
      expect(RETENTION_CONFIG.archivedMaxAge).toBe(expected);
    });

    it('historyMaxAge is 7 days', () => {
      const expected = 7 * 24 * 60 * 60 * 1000;
      expect(RETENTION_CONFIG.historyMaxAge).toBe(expected);
    });

    it('cleanupInterval is 1 hour', () => {
      const expected = 60 * 60 * 1000;
      expect(RETENTION_CONFIG.cleanupInterval).toBe(expected);
    });

    it('values are in milliseconds', () => {
      // All values should be much larger than seconds
      expect(RETENTION_CONFIG.sessionMaxAge).toBeGreaterThan(1000);
      expect(RETENTION_CONFIG.archivedMaxAge).toBeGreaterThan(1000);
      expect(RETENTION_CONFIG.historyMaxAge).toBeGreaterThan(1000);
      expect(RETENTION_CONFIG.cleanupInterval).toBeGreaterThan(1000);
    });
  });

  describe('CREATE_TABLES_SQL', () => {
    it('is a non-empty string', () => {
      expect(typeof CREATE_TABLES_SQL).toBe('string');
      expect(CREATE_TABLES_SQL.length).toBeGreaterThan(0);
    });

    it('creates sessions table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS sessions');
    });

    it('creates status_history table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS status_history');
    });

    it('creates environments table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS environments');
    });

    it('creates session_environments table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS session_environments');
    });

    it('creates schema_version table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS schema_version');
    });

    it('creates indexes for performance', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_name');
      expect(CREATE_TABLES_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_project');
      expect(CREATE_TABLES_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_status');
      expect(CREATE_TABLES_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_history_session');
      expect(CREATE_TABLES_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_history_timestamp');
    });

    it('executes without error on fresh database', () => {
      const db = new Database(':memory:');

      expect(() => {
        db.exec(CREATE_TABLES_SQL);
      }).not.toThrow();

      db.close();
    });

    it('creates correct table structure', () => {
      const db = new Database(':memory:');
      db.exec(CREATE_TABLES_SQL);

      // Get table names
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('status_history');
      expect(tableNames).toContain('environments');
      expect(tableNames).toContain('session_environments');
      expect(tableNames).toContain('schema_version');

      db.close();
    });

    it('sessions table has all required columns', () => {
      const db = new Database(':memory:');
      db.exec(CREATE_TABLES_SQL);

      const columns = db.pragma('table_info(sessions)') as Array<{ name: string }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('project');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('attention_reason');
      expect(columnNames).toContain('last_event');
      expect(columnNames).toContain('last_activity');
      expect(columnNames).toContain('last_status_change');
      expect(columnNames).toContain('environment_id');
      expect(columnNames).toContain('archived_at');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
      // StatusLine metrics (v4)
      expect(columnNames).toContain('model');
      expect(columnNames).toContain('cost_usd');
      expect(columnNames).toContain('context_usage');
      expect(columnNames).toContain('lines_added');
      expect(columnNames).toContain('lines_removed');
      // Git worktree isolation (v6)
      expect(columnNames).toContain('worktree_path');
      expect(columnNames).toContain('branch_name');

      db.close();
    });

    it('status_history table has all required columns', () => {
      const db = new Database(':memory:');
      db.exec(CREATE_TABLES_SQL);

      const columns = db.pragma('table_info(status_history)') as Array<{ name: string }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('session_name');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('attention_reason');
      expect(columnNames).toContain('event');
      expect(columnNames).toContain('timestamp');

      db.close();
    });

    it('environments table has all required columns', () => {
      const db = new Database(':memory:');
      db.exec(CREATE_TABLES_SQL);

      const columns = db.pragma('table_info(environments)') as Array<{ name: string }>;
      const columnNames = columns.map((c) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('provider');
      expect(columnNames).toContain('icon');
      expect(columnNames).toContain('is_default');
      expect(columnNames).toContain('variables');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');

      db.close();
    });
  });

  describe('Type definitions', () => {
    describe('DbSession', () => {
      it('validates correct session structure', () => {
        const session: DbSession = {
          id: 1,
          name: 'test--session-1',
          project: 'test',
          status: 'working',
          attention_reason: null,
          last_event: 'PreToolUse',
          last_activity: Date.now(),
          last_status_change: Date.now(),
          environment_id: null,
          archived_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          // StatusLine metrics
          model: null,
          cost_usd: null,
          context_usage: null,
          lines_added: null,
          lines_removed: null,
          // Ralph mode fields
          ralph_enabled: 0,
          ralph_config: null,
          ralph_iteration: 0,
          ralph_status: null,
          // Worktree isolation
          worktree_path: null,
          branch_name: null,
        };

        expect(session.id).toBe(1);
        expect(session.status).toBe('working');
      });

      it('validates session with all attention reasons', () => {
        const reasons = ['permission', 'input', 'plan_approval', 'task_complete'] as const;

        reasons.forEach((reason) => {
          const session: DbSession = {
            id: 1,
            name: 'test',
            project: 'test',
            status: 'needs_attention',
            attention_reason: reason,
            last_event: null,
            last_activity: Date.now(),
            last_status_change: Date.now(),
            environment_id: null,
            archived_at: null,
            created_at: Date.now(),
            updated_at: Date.now(),
            model: null,
            cost_usd: null,
            context_usage: null,
            lines_added: null,
            lines_removed: null,
            ralph_enabled: 0,
            ralph_config: null,
            ralph_iteration: 0,
            ralph_status: null,
            worktree_path: null,
            branch_name: null,
          };

          expect(session.attention_reason).toBe(reason);
        });
      });

      it('validates all session statuses', () => {
        const statuses = ['init', 'working', 'needs_attention', 'idle'] as const;

        statuses.forEach((status) => {
          const session: DbSession = {
            id: 1,
            name: 'test',
            project: 'test',
            status: status,
            attention_reason: null,
            last_event: null,
            last_activity: Date.now(),
            last_status_change: Date.now(),
            environment_id: null,
            archived_at: null,
            created_at: Date.now(),
            updated_at: Date.now(),
            model: null,
            cost_usd: null,
            context_usage: null,
            lines_added: null,
            lines_removed: null,
            ralph_enabled: 0,
            ralph_config: null,
            ralph_iteration: 0,
            ralph_status: null,
            worktree_path: null,
            branch_name: null,
          };

          expect(session.status).toBe(status);
        });
      });

      it('validates session with StatusLine metrics', () => {
        const session: DbSession = {
          id: 1,
          name: 'test--session-1',
          project: 'test',
          status: 'working',
          attention_reason: null,
          last_event: 'PreToolUse',
          last_activity: Date.now(),
          last_status_change: Date.now(),
          environment_id: null,
          archived_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          model: 'Opus 4.5',
          cost_usd: 4.1,
          context_usage: 36,
          lines_added: 26,
          lines_removed: 2,
          ralph_enabled: 0,
          ralph_config: null,
          ralph_iteration: 0,
          ralph_status: null,
          worktree_path: null,
          branch_name: null,
        };

        expect(session.model).toBe('Opus 4.5');
        expect(session.cost_usd).toBe(4.1);
        expect(session.context_usage).toBe(36);
        expect(session.lines_added).toBe(26);
        expect(session.lines_removed).toBe(2);
      });
    });

    describe('DbStatusHistory', () => {
      it('validates correct history structure', () => {
        const history: DbStatusHistory = {
          id: 1,
          session_name: 'test--session-1',
          status: 'working',
          attention_reason: null,
          event: 'PreToolUse',
          timestamp: Date.now(),
        };

        expect(history.id).toBe(1);
        expect(history.session_name).toBe('test--session-1');
      });
    });

    describe('DbEnvironment', () => {
      it('validates correct environment structure', () => {
        const env: DbEnvironment = {
          id: 'env-123',
          name: 'Production',
          provider: 'anthropic',
          icon: 'zap',
          is_default: 1,
          variables: JSON.stringify({ ANTHROPIC_API_KEY: 'key' }),
          created_at: Date.now(),
          updated_at: Date.now(),
        };

        expect(env.provider).toBe('anthropic');
        expect(env.is_default).toBe(1);
      });

      it('validates all providers', () => {
        const providers = ['anthropic', 'openrouter'] as const;

        providers.forEach((provider) => {
          const env: DbEnvironment = {
            id: 'env-123',
            name: 'Test',
            provider: provider,
            icon: null,
            is_default: 0,
            variables: '{}',
            created_at: Date.now(),
            updated_at: Date.now(),
          };

          expect(env.provider).toBe(provider);
        });
      });
    });

    describe('DbSessionEnvironment', () => {
      it('validates correct mapping structure', () => {
        const mapping: DbSessionEnvironment = {
          session_name: 'test--session-1',
          environment_id: 'env-123',
        };

        expect(mapping.session_name).toBe('test--session-1');
        expect(mapping.environment_id).toBe('env-123');
      });
    });

    describe('DbSchemaVersion', () => {
      it('validates correct version structure', () => {
        const version: DbSchemaVersion = {
          version: 3,
          applied_at: Date.now(),
        };

        expect(version.version).toBe(3);
        expect(typeof version.applied_at).toBe('number');
      });
    });

    describe('UpsertSessionInput', () => {
      it('validates minimal input', () => {
        const input: UpsertSessionInput = {
          project: 'test',
          status: 'init',
          lastActivity: Date.now(),
          lastStatusChange: Date.now(),
        };

        expect(input.project).toBe('test');
        expect(input.status).toBe('init');
      });

      it('validates full input', () => {
        const input: UpsertSessionInput = {
          project: 'test',
          status: 'needs_attention',
          attentionReason: 'permission',
          lastEvent: 'PreToolUse',
          lastActivity: Date.now(),
          lastStatusChange: Date.now(),
          environmentId: 'env-123',
        };

        expect(input.attentionReason).toBe('permission');
        expect(input.environmentId).toBe('env-123');
      });
    });

    describe('UpsertEnvironmentInput', () => {
      it('validates correct input structure', () => {
        const input: UpsertEnvironmentInput = {
          id: 'env-123',
          name: 'Production',
          provider: 'anthropic',
          isDefault: true,
          variables: { ANTHROPIC_API_KEY: 'key' },
        };

        expect(input.name).toBe('Production');
        expect(input.isDefault).toBe(true);
        expect(input.variables.ANTHROPIC_API_KEY).toBe('key');
      });
    });
  });

  describe('Schema constraints', () => {
    it('sessions.name is unique', () => {
      const db = new Database(':memory:');
      db.exec(CREATE_TABLES_SQL);

      const now = Date.now();

      db.prepare(
        `
        INSERT INTO sessions (name, project, status, last_activity, last_status_change, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run('unique-name', 'test', 'init', now, now, now, now);

      expect(() => {
        db.prepare(
          `
          INSERT INTO sessions (name, project, status, last_activity, last_status_change, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run('unique-name', 'test', 'init', now, now, now, now);
      }).toThrow();

      db.close();
    });

    it('environments.id is primary key', () => {
      const db = new Database(':memory:');
      db.exec(CREATE_TABLES_SQL);

      const now = Date.now();

      db.prepare(
        `
        INSERT INTO environments (id, name, provider, variables, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run('env-1', 'Test', 'anthropic', '{}', now, now);

      expect(() => {
        db.prepare(
          `
          INSERT INTO environments (id, name, provider, variables, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run('env-1', 'Another', 'openrouter', '{}', now, now);
      }).toThrow();

      db.close();
    });

    it('session_environments.session_name is primary key', () => {
      const db = new Database(':memory:');
      db.exec(CREATE_TABLES_SQL);

      db.prepare(
        `
        INSERT INTO session_environments (session_name, environment_id)
        VALUES (?, ?)
      `
      ).run('session-1', 'env-1');

      expect(() => {
        db.prepare(
          `
          INSERT INTO session_environments (session_name, environment_id)
          VALUES (?, ?)
        `
        ).run('session-1', 'env-2');
      }).toThrow();

      db.close();
    });
  });
});
