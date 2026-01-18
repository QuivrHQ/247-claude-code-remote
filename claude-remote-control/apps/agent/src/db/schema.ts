import type { SessionStatus, AttentionReason } from '247-shared';

// ============================================================================
// Database Row Types (Simplified)
// ============================================================================

export interface DbSession {
  id: number;
  name: string;
  project: string;
  status: SessionStatus;
  attention_reason: AttentionReason | null;
  last_event: string | null;
  last_activity: number;
  last_status_change: number;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
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
  status?: SessionStatus;
  attentionReason?: AttentionReason | null;
  lastEvent?: string | null;
  lastActivity?: number;
  lastStatusChange?: number;
}

// ============================================================================
// SQL Schema Definitions (Simplified v15)
// ============================================================================

export const SCHEMA_VERSION = 15;

export const CREATE_TABLES_SQL = `
-- Sessions: current state of terminal sessions (simplified)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  project TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'init',
  attention_reason TEXT,
  last_event TEXT,
  last_activity INTEGER NOT NULL,
  last_status_change INTEGER NOT NULL,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
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
