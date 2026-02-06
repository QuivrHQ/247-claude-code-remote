// ============================================================================
// Session Status Types (Hook-based attention notifications)
// ============================================================================

export type SessionStatus = 'init' | 'working' | 'needs_attention' | 'idle';
// AttentionReason is now a pass-through from Claude Code's notification_type
// Known values: permission_prompt, input_request, plan_mode, task_complete, input (from Stop hook)
// Using string to allow any future types from Claude Code
export type AttentionReason = string;
export type StatusSource = 'hook' | 'tmux';

export interface AttentionNotification {
  sessionId: string;
  status: SessionStatus;
  attentionReason?: AttentionReason;
  source: StatusSource;
  timestamp: number;
  eventType: string;
}

// Session types
export interface Session {
  id: string;
  project: string | null;
  tmuxSession: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

// WebSocket message types - Client to Agent (Terminal)
export type WSMessageToAgent =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'start-claude' }
  | { type: 'ping' }
  | { type: 'request-history'; lines?: number };

// WebSocket message types - Agent to Client (Terminal)
export type WSMessageFromAgent =
  | { type: 'output'; data: string }
  | { type: 'connected'; session: string }
  | { type: 'disconnected' }
  | { type: 'pong' }
  | { type: 'history'; data: string; lines: number };

// Session info for WebSocket (simplified)
export interface WSSessionInfo {
  name: string;
  project: string;
  lastEvent?: string;
  createdAt: number;
  lastActivity?: number;
  archivedAt?: number; // Timestamp when session was archived (undefined = active)
  // Status tracking (from hooks)
  status?: SessionStatus;
  statusSource?: StatusSource;
  attentionReason?: AttentionReason;
  lastStatusChange?: number;
}

// WebSocket message types - Agent to Client (Sessions channel)
export type WSSessionsMessageFromAgent =
  | { type: 'sessions-list'; sessions: WSSessionInfo[] }
  | { type: 'session-removed'; sessionName: string }
  | { type: 'session-archived'; sessionName: string; session: WSSessionInfo }
  | { type: 'status-update'; session: WSSessionInfo }
  | { type: 'version-info'; agentVersion: string }
  | { type: 'update-pending'; targetVersion: string; message: string };

// API types
export interface AgentInfo {
  name: string;
  status: 'online' | 'offline';
  projects: string[];
}

// Session archive
export interface ArchiveSessionResponse {
  success: boolean;
  message: string;
  session?: WSSessionInfo;
}

// Session output capture
export interface SessionOutputResponse {
  sessionName: string;
  output: string;
  totalLines: number;
  returnedLines: number;
  isRunning: boolean;
  capturedAt: number;
  source?: 'live' | 'file' | 'database';
}

// Session input
export interface SessionInputRequest {
  text: string;
  sendEnter?: boolean; // Default true
}

export interface SessionInputResponse {
  success: boolean;
  sessionName?: string;
  bytesSent?: number;
  error?: string;
}

// Agent configuration
export interface AgentConfig {
  agent?: {
    port: number;
    url: string; // e.g., "localhost:4678" or "mac.tailnet.ts.net:4678"
  };
  projects: {
    basePath: string;
    whitelist: string[];
  };
}
