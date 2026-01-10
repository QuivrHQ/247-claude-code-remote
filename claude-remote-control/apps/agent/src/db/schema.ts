import type {
  SessionStatus,
  AttentionReason,
  EnvironmentProvider,
  TaskExecutionMode,
  TaskStatus,
} from '247-shared';

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
  // StatusLine metrics
  model: string | null;
  cost_usd: number | null;
  context_usage: number | null;
  lines_added: number | null;
  lines_removed: number | null;
  // Ralph mode fields (legacy, kept for backwards compatibility)
  ralph_enabled: number; // SQLite uses 0/1 for booleans
  ralph_config: string | null; // JSON string
  ralph_iteration: number;
  ralph_status: string | null;
  // Worktree isolation (v6)
  worktree_path: string | null;
  branch_name: string | null;
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

// Task queue types (v7)
export interface DbTask {
  id: string;
  name: string;
  prompt: string;
  project: string;
  mode: TaskExecutionMode;
  status: TaskStatus;
  position: number;
  depends_on: string; // JSON array of task IDs
  session_name: string | null;
  use_worktree: number; // SQLite boolean
  environment_id: string | null;
  error: string | null;
  retry_count: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export interface DbTaskTemplate {
  id: string;
  name: string;
  description: string | null;
  steps: string; // JSON array of TaskTemplateStep
  variables: string | null; // JSON array of variable definitions
  created_at: number;
  updated_at: number;
}

export interface DbTaskHistory {
  id: number;
  task_id: string;
  status: TaskStatus;
  event: string; // 'created', 'started', 'completed', 'failed', 'retried', 'skipped'
  details: string | null; // JSON
  timestamp: number;
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
  // StatusLine metrics
  model?: string | null;
  costUsd?: number | null;
  contextUsage?: number | null;
  linesAdded?: number | null;
  linesRemoved?: number | null;
  // Ralph mode fields (legacy, kept for backwards compatibility)
  ralphEnabled?: boolean;
  ralphConfig?: Record<string, unknown> | null;
  ralphIteration?: number;
  ralphStatus?: string | null;
  // Worktree isolation (v6)
  worktreePath?: string | null;
  branchName?: string | null;
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

export const SCHEMA_VERSION = 7;

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
  updated_at INTEGER NOT NULL,
  -- StatusLine metrics (v4)
  model TEXT,
  cost_usd REAL,
  context_usage INTEGER,
  lines_added INTEGER,
  lines_removed INTEGER,
  -- Ralph mode fields (v5)
  ralph_enabled INTEGER DEFAULT 0,
  ralph_config TEXT,
  ralph_iteration INTEGER DEFAULT 0,
  ralph_status TEXT,
  -- Worktree isolation (v6)
  worktree_path TEXT,
  branch_name TEXT
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

-- Task queue (v7)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  project TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'interactive',
  status TEXT NOT NULL DEFAULT 'pending',
  position INTEGER NOT NULL,
  depends_on TEXT NOT NULL DEFAULT '[]',
  session_name TEXT,
  use_worktree INTEGER NOT NULL DEFAULT 0,
  environment_id TEXT,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(position);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_name);

-- Task templates (v7)
CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  steps TEXT NOT NULL,
  variables TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_name ON task_templates(name);

-- Task history (v7)
CREATE TABLE IF NOT EXISTS task_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL,
  event TEXT NOT NULL,
  details TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_timestamp ON task_history(timestamp);
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
