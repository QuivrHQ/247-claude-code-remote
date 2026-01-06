import type { SessionStatus, AttentionReason, EnvironmentProvider } from '@claude-remote/shared';

// ============================================================================
// Database Row Types
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
  environment_id: string | null;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface DbStatusHistory {
  id: number;
  session_name: string;
  status: SessionStatus;
  attention_reason: AttentionReason | null;
  event: string | null;
  timestamp: number;
}

export interface DbEnvironment {
  id: string;
  name: string;
  provider: EnvironmentProvider;
  icon: string | null; // Lucide icon name
  is_default: number; // SQLite uses 0/1 for booleans
  variables: string; // JSON string
  created_at: number;
  updated_at: number;
}

export interface DbSessionEnvironment {
  session_name: string;
  environment_id: string;
}

export interface DbSchemaVersion {
  version: number;
  applied_at: number;
}

// ============================================================================
// Input Types for Operations
// ============================================================================

export interface UpsertSessionInput {
  project: string;
  status: SessionStatus;
  attentionReason?: AttentionReason | null;
  lastEvent?: string | null;
  lastActivity: number;
  lastStatusChange: number;
  environmentId?: string | null;
}

export interface UpsertEnvironmentInput {
  id: string;
  name: string;
  provider: EnvironmentProvider;
  isDefault: boolean;
  variables: Record<string, string>;
}

// ============================================================================
// SQL Schema Definitions
// ============================================================================

export const SCHEMA_VERSION = 3;

export const CREATE_TABLES_SQL = `
-- Sessions: current state of terminal sessions
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  project TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'init',
  attention_reason TEXT,
  last_event TEXT,
  last_activity INTEGER NOT NULL,
  last_status_change INTEGER NOT NULL,
  environment_id TEXT,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);

-- Status history: audit trail of status changes
CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_name TEXT NOT NULL,
  status TEXT NOT NULL,
  attention_reason TEXT,
  event TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_session ON status_history(session_name);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON status_history(timestamp);

-- Environments: API provider configurations
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  icon TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  variables TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_environments_default ON environments(is_default);

-- Session-environment mapping
CREATE TABLE IF NOT EXISTS session_environments (
  session_name TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL
);

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
  /** Max age for status history (7 days) */
  historyMaxAge: 7 * 24 * 60 * 60 * 1000,
  /** Cleanup interval (1 hour) */
  cleanupInterval: 60 * 60 * 1000,
};
