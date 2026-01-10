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

// ============================================================================
// Task Queue System Types
// ============================================================================

/**
 * Execution mode for a task
 * - 'print': Non-interactive, background execution (claude -p "prompt")
 * - 'interactive': Normal Claude session with permission prompts
 * - 'trust': Auto-accept all permissions (--dangerously-skip-permissions)
 */
export type TaskExecutionMode = 'print' | 'interactive' | 'trust';

/**
 * Task lifecycle status
 *
 * State transitions:
 *   pending -> ready -> running -> completed | failed | skipped
 *                    -> paused (user stopped queue)
 *
 * pending: Initial state, waiting for dependencies
 * ready: Dependencies satisfied, waiting for execution slot
 * running: Currently executing
 * completed: Successfully finished
 * failed: Terminated with error (awaiting user decision)
 * skipped: User chose to skip after failure (or dependency was skipped)
 * paused: User stopped the queue
 */
export type TaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'paused';

/**
 * Task definition for the queue
 */
export interface Task {
  /** Unique task identifier */
  id: string;

  /** Human-readable task name */
  name: string;

  /** Full prompt/instruction for Claude */
  prompt: string;

  /** Project to execute in */
  project: string;

  /** Execution mode */
  mode: TaskExecutionMode;

  /** Current status */
  status: TaskStatus;

  /** Position in queue (0-indexed) */
  position: number;

  /** IDs of tasks that must complete before this one */
  dependsOn: string[];

  /** Session name created for this task (set when running) */
  sessionName?: string;

  /** Use git worktree for isolation */
  useWorktree: boolean;

  /** Environment ID to use */
  environmentId?: string;

  /** Error message if failed */
  error?: string;

  /** Retry count */
  retryCount: number;

  /** Timestamps */
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Template step definition (without runtime state)
 */
export interface TaskTemplateStep {
  /** Step name */
  name: string;

  /** Prompt template (can contain {variable} placeholders) */
  prompt: string;

  /** Execution mode */
  mode: TaskExecutionMode;

  /** Step index this depends on (0-indexed), undefined = depends on previous */
  dependsOnStep?: number;

  /** Use worktree for this step */
  useWorktree?: boolean;
}

/**
 * Reusable task template
 */
export interface TaskTemplate {
  /** Unique template identifier */
  id: string;

  /** Template name */
  name: string;

  /** Description */
  description?: string;

  /** Template steps */
  steps: TaskTemplateStep[];

  /** Variables that can be substituted in prompts */
  variables?: {
    name: string;
    description: string;
    defaultValue?: string;
  }[];

  /** Timestamps */
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Task Queue API Types
// ============================================================================

/** Request to create a new task */
export interface CreateTaskRequest {
  name: string;
  prompt: string;
  project: string;
  mode?: TaskExecutionMode;
  dependsOn?: string[];
  useWorktree?: boolean;
  environmentId?: string;
  position?: number; // Insert at position, default append
}

/** Request to create multiple tasks */
export interface CreateTaskBatchRequest {
  tasks: CreateTaskRequest[];
}

/** Request to instantiate a template */
export interface InstantiateTemplateRequest {
  templateId: string;
  project: string;
  variables?: Record<string, string>;
}

/** Request to create a template */
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  steps: TaskTemplateStep[];
  variables?: {
    name: string;
    description: string;
    defaultValue?: string;
  }[];
}

// ============================================================================
// Task Queue WebSocket Messages
// ============================================================================

/** Task queue updates sent to clients via status channel */
export type WSTaskQueueMessage =
  | { type: 'task-created'; task: Task }
  | { type: 'task-updated'; task: Task }
  | { type: 'task-removed'; taskId: string }
  | { type: 'task-failed'; task: Task; awaitingDecision: boolean }
  | { type: 'task-skipped'; task: Task; propagatedSkips: string[] }
  | { type: 'tasks-list'; tasks: Task[] }
  | { type: 'queue-paused' }
  | { type: 'queue-resumed' };
