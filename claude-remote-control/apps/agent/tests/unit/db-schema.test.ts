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
  type DbSchemaVersion,
  type UpsertSessionInput,
} from '../../src/db/schema.js';

describe('Database Schema', () => {
  describe('SCHEMA_VERSION', () => {
    it('is a positive integer', () => {
      expect(SCHEMA_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    });

    it('current version is 15', () => {
      expect(SCHEMA_VERSION).toBe(15);
    });
  });

  describe('RETENTION_CONFIG', () => {
    it('has all required fields', () => {
      expect(RETENTION_CONFIG.sessionMaxAge).toBeDefined();
      expect(RETENTION_CONFIG.archivedMaxAge).toBeDefined();
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

    it('cleanupInterval is 1 hour', () => {
      const expected = 60 * 60 * 1000;
      expect(RETENTION_CONFIG.cleanupInterval).toBe(expected);
    });

    it('values are in milliseconds', () => {
      // All values should be much larger than seconds
      expect(RETENTION_CONFIG.sessionMaxAge).toBeGreaterThan(1000);
      expect(RETENTION_CONFIG.archivedMaxAge).toBeGreaterThan(1000);
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

    it('creates schema_version table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS schema_version');
    });

    it('creates indexes for performance', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_name');
      expect(CREATE_TABLES_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_project');
      expect(CREATE_TABLES_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_status');
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
      expect(columnNames).toContain('archived_at');
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
          archived_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
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
            archived_at: null,
            created_at: Date.now(),
            updated_at: Date.now(),
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
            archived_at: null,
            created_at: Date.now(),
            updated_at: Date.now(),
          };

          expect(session.status).toBe(status);
        });
      });
    });

    describe('DbSchemaVersion', () => {
      it('validates correct version structure', () => {
        const version: DbSchemaVersion = {
          version: 15,
          applied_at: Date.now(),
        };

        expect(version.version).toBe(15);
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
        };

        expect(input.attentionReason).toBe('permission');
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
  });
});
