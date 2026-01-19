// ============================================================================
// Database Row Types
// ============================================================================

export type DbSessionStatus = 'init' | 'working' | 'needs_attention' | 'idle';
// AttentionReason is now a pass-through from Claude Code's notification_type (string)
export type DbAttentionReason = string;
export type DbStatusSource = 'hook' | 'tmux';

export interface DbSession {
  id: number;
  name: string;
  project: string;
  last_event: string | null;
  last_activity: number;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
  // Status tracking (v17)
  status: DbSessionStatus | null;
  status_source: DbStatusSource | null;
  attention_reason: DbAttentionReason | null;
  last_status_change: number | null;
}

export interface DbSchemaVersion {
  version: number;
  applied_at: number;
}

// ============================================================================
// Input Types for Operations
// ============================================================================

export interface UpsertSessionInput {
  project?: string;
  lastEvent?: string | null;
  lastActivity?: number;
  // Status tracking (v17)
  status?: DbSessionStatus | null;
  statusSource?: DbStatusSource | null;
  attentionReason?: DbAttentionReason | null;
}

// ============================================================================
// SQL Schema Definitions (v17 - Status Tracking via Hooks)
// ============================================================================

export const SCHEMA_VERSION = 17;

export const CREATE_TABLES_SQL = `
-- Sessions: current state of terminal sessions with status tracking
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  project TEXT NOT NULL,
  last_event TEXT,
  last_activity INTEGER NOT NULL,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- Status tracking (v17)
  status TEXT,
  status_source TEXT,
  attention_reason TEXT,
  last_status_change INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`;

// ============================================================================
// Migration for v16 (Remove status tracking)
// ============================================================================

export const MIGRATION_16 = `
-- Migration v16: Remove status tracking columns
CREATE TABLE IF NOT EXISTS sessions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  project TEXT NOT NULL,
  last_event TEXT,
  last_activity INTEGER NOT NULL,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO sessions_new (id, name, project, last_event, last_activity, archived_at, created_at, updated_at)
SELECT id, name, project, last_event, last_activity, archived_at, created_at, updated_at
FROM sessions;

DROP TABLE IF EXISTS sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
`;

// ============================================================================
// Migration for v17 (Add status tracking via hooks)
// ============================================================================

export const MIGRATION_17 = `
-- Migration v17: Add status tracking columns for hook-based notifications
ALTER TABLE sessions ADD COLUMN status TEXT;
ALTER TABLE sessions ADD COLUMN status_source TEXT;
ALTER TABLE sessions ADD COLUMN attention_reason TEXT;
ALTER TABLE sessions ADD COLUMN last_status_change INTEGER;

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
`;

// ============================================================================
// Retention Configuration
// ============================================================================

export const RETENTION_CONFIG = {
  /** Max age for sessions before cleanup (24 hours) */
  sessionMaxAge: 24 * 60 * 60 * 1000,
  /** Max age for archived sessions before cleanup (30 days) */
  archivedMaxAge: 30 * 24 * 60 * 60 * 1000,
  /** Cleanup interval (1 hour) */
  cleanupInterval: 60 * 60 * 1000,
};
