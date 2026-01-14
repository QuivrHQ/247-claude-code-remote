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

// Ralph Loop configuration (original implementation)
export interface RalphLoopConfig {
  prompt: string;
  maxIterations?: number;
  completionPromise?: string;
  useWorktree?: boolean; // Create isolated git worktree for this loop
  trustMode?: boolean; // Auto-accept all Claude tool permissions (--dangerously-skip-permissions)
}

// Ralph Loop Prompt Builder types
export type RalphDeliverable = 'tests' | 'readme' | 'types' | 'docs' | 'custom';

export interface RalphPromptBuilder {
  taskDescription: string;
  successCriteria: string[];
  deliverables: RalphDeliverable[];
  customDeliverable?: string;
}

// Labels for deliverables
export const RALPH_DELIVERABLE_LABELS: Record<RalphDeliverable, string> = {
  tests: 'Unit/integration tests with >80% coverage',
  readme: 'Updated README documentation',
  types: 'TypeScript types and interfaces',
  docs: 'Code comments and JSDoc',
  custom: '', // Uses customDeliverable value
};

// Suggested success criteria for quick selection
export const RALPH_SUCCESS_CRITERIA_SUGGESTIONS = [
  'All tests pass',
  'No TypeScript errors',
  'No linter errors',
  'Code coverage >80%',
  'Build succeeds',
] as const;

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
  | { type: 'start-claude-ralph'; config: RalphLoopConfig }
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
  lastActivity?: number;
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
  // StatusLine metrics (from Claude Code heartbeat)
  model?: string; // Current model display name
  costUsd?: number; // Total cost in USD
  contextUsage?: number; // Context window usage percentage (0-100)
  linesAdded?: number; // Total lines of code added
  linesRemoved?: number; // Total lines of code removed
  // Git worktree isolation
  worktreePath?: string; // Path to worktree if session uses isolation
  branchName?: string; // Branch name for worktree session
  // Spawn/orchestration (for sub-sessions)
  parentSession?: string; // Name of parent session that spawned this one
  taskId?: string; // Group ID for related spawned sessions
  spawnPrompt?: string; // Original prompt used to spawn this session
  exitCode?: number; // Exit code when session completed
  exitedAt?: number; // Timestamp when session exited
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
  | { type: 'update-pending'; targetVersion: string; message: string }
  // Orchestration messages (for spawned sub-sessions)
  | { type: 'session-spawned'; session: WSSessionInfo; parentSession?: string }
  | { type: 'session-completed'; sessionName: string; exitCode: number };

// Task status for orchestration (grouping spawned sessions)
export type TaskStatus = 'pending' | 'running' | 'needs_attention' | 'completed' | 'failed';

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
  'zap',
  'globe',
  'bot',
  'brain',
  'cpu',
  'server',
  'cloud',
  'rocket',
  'flask',
  'code',
  'bug',
  'wrench',
  'shield',
  'lock',
  'star',
  'sparkles',
  'flame',
  'moon',
  'sun',
  'leaf',
] as const;

export type EnvironmentIcon = (typeof ENVIRONMENT_ICON_OPTIONS)[number];

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

// API Request/Response types for REST endpoints

// Clone repository
export interface CloneRequest {
  repoUrl: string;
  projectName?: string;
}

export interface CloneResponse {
  success: boolean;
  projectName?: string;
  path?: string;
  error?: string;
}

// Session archive
export interface ArchiveSessionResponse {
  success: boolean;
  message: string;
  session?: WSSessionInfo;
}

// Spawn session (for orchestration)
export interface SpawnSessionRequest {
  prompt: string; // Required - the task prompt for claude -p
  project: string; // Required - project name from whitelist
  parentSession?: string; // Parent session name for hierarchy tracking
  taskId?: string; // Group ID for related spawned sessions
  worktree?: boolean; // Create isolated git worktree
  branchName?: string; // Custom branch name for worktree
  environmentId?: string; // Environment to use (API keys, etc.)
  timeout?: number; // Timeout in milliseconds
  trustMode?: boolean; // Use --dangerously-skip-permissions
  model?: string; // Model override (opus, sonnet, etc.)
}

export interface SpawnSessionResponse {
  success: boolean;
  sessionName?: string;
  taskId?: string;
  worktreePath?: string;
  branchName?: string;
  error?: string;
  errorCode?: 'PROJECT_NOT_ALLOWED' | 'CAPACITY_EXCEEDED' | 'SPAWN_FAILED';
}

// Session output capture
export interface SessionOutputResponse {
  sessionName: string;
  output: string;
  totalLines: number;
  returnedLines: number;
  isRunning: boolean;
  capturedAt: number;
  source?: 'live' | 'file' | 'database'; // 'live' = from tmux, 'file' = from tee output file, 'database' = from stored output
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

// Provider presets for UI
export const ENVIRONMENT_PRESETS: Record<
  EnvironmentProvider,
  {
    label: string;
    defaultVariables: Record<string, string>;
    description: string;
  }
> = {
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
