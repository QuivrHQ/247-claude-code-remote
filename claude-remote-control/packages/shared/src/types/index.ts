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
  | 'permission'      // Claude needs permission to use a tool
  | 'input'           // Claude is waiting for user input
  | 'plan_approval'   // Claude has a plan to approve (ExitPlanMode)
  | 'task_complete';  // Claude finished the task

export type StatusSource = 'hook' | 'tmux';

// Session info for status WebSocket
export interface WSSessionInfo {
  name: string;
  project: string;
  status: SessionStatus;
  attentionReason?: AttentionReason; // Why Claude needs attention (only set when status is 'needs_attention')
  statusSource: StatusSource;
  lastEvent?: string;
  lastStatusChange?: number;
  createdAt: number;
  lastActivity?: string;
  archivedAt?: number; // Timestamp when session was archived (undefined = active)
  environmentId?: string; // Track which environment this session uses
  // Environment metadata for UI display
  environment?: {
    id: string;
    name: string;
    provider: EnvironmentProvider;
    icon: EnvironmentIcon | null;
    isDefault: boolean;
  };
}

// WebSocket message types - Client to Agent (Status channel)
export type WSStatusMessageToAgent =
  | { type: 'status-subscribe' }
  | { type: 'status-unsubscribe' };

// WebSocket message types - Agent to Client (Status channel)
export type WSStatusMessageFromAgent =
  | { type: 'sessions-list'; sessions: WSSessionInfo[] }
  | { type: 'status-update'; session: WSSessionInfo }
  | { type: 'session-removed'; sessionName: string }
  | { type: 'session-archived'; sessionName: string; session: WSSessionInfo };

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

// Editor types
export interface EditorConfig {
  enabled: boolean;
  portRange: { start: number; end: number };
  idleTimeout: number; // ms - shutdown after inactivity
}

export interface EditorStatus {
  project: string;
  running: boolean;
  port?: number;
  pid?: number;
  startedAt?: number;
  lastActivity?: number;
}

// Environment types
export type EnvironmentProvider = 'anthropic' | 'openrouter';

// Available icons for environments
export const ENVIRONMENT_ICON_OPTIONS = [
  'zap', 'globe', 'bot', 'brain', 'cpu', 'server', 'cloud',
  'rocket', 'flask', 'code', 'bug', 'wrench', 'shield', 'lock',
  'star', 'sparkles', 'flame', 'moon', 'sun', 'leaf'
] as const;

export type EnvironmentIcon = typeof ENVIRONMENT_ICON_OPTIONS[number];

// Default icons per provider (fallback when icon is null)
export const DEFAULT_PROVIDER_ICONS: Record<EnvironmentProvider, EnvironmentIcon> = {
  anthropic: 'zap',
  openrouter: 'globe',
};

export interface Environment {
  id: string;
  name: string;
  provider: EnvironmentProvider;
  icon: EnvironmentIcon | null; // Custom icon, null uses provider default
  isDefault: boolean;
  variables: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

// Safe metadata sent to dashboard (no secret values)
export interface EnvironmentMetadata {
  id: string;
  name: string;
  provider: EnvironmentProvider;
  icon: EnvironmentIcon | null; // Custom icon, null uses provider default
  isDefault: boolean;
  variableKeys: string[]; // Only variable names, not values
  createdAt: number;
  updatedAt: number;
}

// Environment API request types
export interface CreateEnvironmentRequest {
  name: string;
  provider: EnvironmentProvider;
  icon?: EnvironmentIcon | null;
  isDefault?: boolean;
  variables: Record<string, string>;
}

export interface UpdateEnvironmentRequest {
  name?: string;
  provider?: EnvironmentProvider;
  icon?: EnvironmentIcon | null;
  isDefault?: boolean;
  variables?: Record<string, string>;
}

// Provider presets for UI
export const ENVIRONMENT_PRESETS: Record<EnvironmentProvider, {
  label: string;
  defaultVariables: Record<string, string>;
  description: string;
}> = {
  anthropic: {
    label: 'Anthropic',
    defaultVariables: {
      ANTHROPIC_API_KEY: '',
    },
    description: 'Direct Anthropic API access',
  },
  openrouter: {
    label: 'OpenRouter',
    defaultVariables: {
      ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_API_KEY: '', // Must be explicitly empty
    },
    description: 'Use OpenRouter as Claude provider',
  },
};

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
  editor?: EditorConfig;
  projects: {
    basePath: string;
    whitelist: string[];
  };
  dashboard: {
    apiUrl: string;
    apiKey: string;
  };
}
