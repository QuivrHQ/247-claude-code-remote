// Machine types
export interface Machine {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: Date | null;
  config: MachineConfig | null;
  createdAt: Date;
}

export interface MachineConfig {
  projects: string[];
  agentUrl?: string; // e.g., "localhost:4678" or "mac.tailnet.ts.net:4678"
}

// Session types
export interface Session {
  id: string;
  machineId: string;
  project: string | null;
  status: SessionStatus;
  tmuxSession: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
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

// Session status types for real-time updates
// 4 states: init (starting), working (active), needs_attention (user intervention needed), idle (session ended)
export type SessionStatus = 'init' | 'working' | 'needs_attention' | 'idle';

// Reason why Claude needs attention
export type AttentionReason =
  | 'permission' // Claude needs permission to use a tool
  | 'input' // Claude is waiting for user input
  | 'plan_approval' // Claude has a plan to approve (ExitPlanMode)
  | 'task_complete'; // Claude finished the task

export type StatusSource = 'hook' | 'tmux';

// Session info for status WebSocket (simplified)
export interface WSSessionInfo {
  name: string;
  project: string;
  status: SessionStatus;
  attentionReason?: AttentionReason; // Why Claude needs attention (only set when status is 'needs_attention')
  statusSource: StatusSource;
  lastEvent?: string;
  lastStatusChange?: number;
  createdAt: number;
  lastActivity?: number;
  archivedAt?: number; // Timestamp when session was archived (undefined = active)
}

// WebSocket message types - Client to Agent (Status channel)
export type WSStatusMessageToAgent = { type: 'status-subscribe' } | { type: 'status-unsubscribe' };

// WebSocket message types - Agent to Client (Status channel)
export type WSStatusMessageFromAgent =
  | { type: 'sessions-list'; sessions: WSSessionInfo[] }
  | { type: 'status-update'; session: WSSessionInfo }
  | { type: 'session-removed'; sessionName: string }
  | { type: 'session-archived'; sessionName: string; session: WSSessionInfo }
  | { type: 'version-info'; agentVersion: string }
  | { type: 'update-pending'; targetVersion: string; message: string };

// API types
export interface RegisterMachineRequest {
  id: string;
  name: string;
  config?: MachineConfig;
}

export interface AgentInfo {
  machine: {
    id: string;
    name: string;
  };
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

// Hook status notification (from Claude Code plugin)
export interface HookStatusRequest {
  event: string;
  status: SessionStatus;
  attention_reason?: AttentionReason;
  session_id?: string;
  tmux_session?: string;
  project?: string;
  timestamp?: string;
}

// Agent configuration
export interface AgentConfig {
  machine: {
    id: string;
    name: string;
  };
  agent?: {
    port: number;
    url: string; // e.g., "localhost:4678" or "mac.tailnet.ts.net:4678"
  };
  projects: {
    basePath: string;
    whitelist: string[];
  };
  dashboard: {
    apiUrl: string;
    apiKey: string;
  };
}
