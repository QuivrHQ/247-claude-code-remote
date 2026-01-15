import type { SessionStatus, AttentionReason, EnvironmentProvider } from '247-shared';

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
  // Worktree isolation (v6)
  worktree_path: string | null;
  branch_name: string | null;
  // Spawn/orchestration fields (v9)
  spawn_prompt: string | null;
  parent_session: string | null;
  task_id: string | null;
  exit_code: number | null;
  exited_at: number | null;
  // Output capture (v10)
  output_content: string | null;
  output_captured_at: number | null;
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

export type WebhookType = 'telegram' | 'slack' | 'discord' | 'generic';
export type WebhookEvent = 'needs_attention' | 'task_complete' | 'session_start' | 'session_end';

export interface DbWebhook {
  id: string;
  name: string;
  url: string;
  type: WebhookType;
  enabled: number; // SQLite uses 0/1 for booleans
  events: string; // JSON array of WebhookEvent
  secret: string | null; // Optional secret for HMAC signing
  created_at: number;
  updated_at: number;
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
  environmentId?: string | null;
  // StatusLine metrics
  model?: string | null;
  costUsd?: number | null;
  contextUsage?: number | null;
  linesAdded?: number | null;
  linesRemoved?: number | null;
  // Worktree isolation (v6)
  worktreePath?: string | null;
  branchName?: string | null;
  // Spawn/orchestration fields (v9)
  spawn_prompt?: string | null;
  parent_session?: string | null;
  task_id?: string | null;
  exit_code?: number | null;
  exited_at?: number | null;
  // Output capture (v10)
  output_content?: string | null;
  output_captured_at?: number | null;
}

export interface UpsertEnvironmentInput {
  id: string;
  name: string;
  provider: EnvironmentProvider;
  isDefault: boolean;
  variables: Record<string, string>;
}

export interface UpsertWebhookInput {
  id?: string;
  name: string;
  url: string;
  type: WebhookType;
  enabled?: boolean;
  events: WebhookEvent[];
  secret?: string | null;
}

// ============================================================================
// SQL Schema Definitions
// ============================================================================

export const SCHEMA_VERSION = 13;

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
  -- Worktree isolation (v6)
  worktree_path TEXT,
  branch_name TEXT,
  -- Spawn/orchestration fields (v9)
  spawn_prompt TEXT,
  parent_session TEXT,
  task_id TEXT,
  exit_code INTEGER,
  exited_at INTEGER,
  -- Output capture (v10)
  output_content TEXT,
  output_captured_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sessions_name ON sessions(name);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session);
CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id);

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

-- Push subscriptions for Web Push notifications (v8)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_endpoint ON push_subscriptions(endpoint);

-- Webhooks for external notifications (v13)
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'generic',
  enabled INTEGER NOT NULL DEFAULT 1,
  events TEXT NOT NULL DEFAULT '["needs_attention"]',
  secret TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
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
