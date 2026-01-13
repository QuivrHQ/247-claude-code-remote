import type { Config } from '../config/index.js';

export interface SessionInfo {
  name: string;
  project: string;
  status: 'init' | 'working' | 'needs_attention' | 'idle';
  attentionReason?: 'permission' | 'input' | 'plan_approval' | 'task_complete';
  lastEvent?: string;
  lastStatusChange?: number;
  createdAt: number;
  lastActivity?: number;
  model?: string;
  costUsd?: number;
  contextUsage?: number;
  worktreePath?: string;
  branchName?: string;
}

export interface SpawnRequest {
  prompt: string;
  project: string;
  parentSession?: string;
  taskId?: string;
  worktree?: boolean;
  branchName?: string;
  environmentId?: string;
  timeout?: number;
  trustMode?: boolean;
  model?: string;
}

export interface SpawnResponse {
  success: boolean;
  sessionName?: string;
  taskId?: string;
  worktreePath?: string;
  branchName?: string;
  error?: string;
}

export interface SessionOutputResponse {
  sessionName: string;
  output: string;
  totalLines: number;
  returnedLines: number;
  isRunning: boolean;
}

export interface SessionInputResponse {
  success: boolean;
  sessionName: string;
  error?: string;
}

export class AgentClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: Config) {
    this.baseUrl = config.agentUrl;
    this.timeout = config.timeout;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }

      return response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    return this.fetch<SessionInfo[]>('/api/sessions');
  }

  async getSession(name: string): Promise<SessionInfo | null> {
    try {
      const sessions = await this.listSessions();
      return sessions.find((s) => s.name === name) || null;
    } catch {
      return null;
    }
  }

  async spawnSession(request: SpawnRequest): Promise<SpawnResponse> {
    return this.fetch<SpawnResponse>('/api/sessions/spawn', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSessionOutput(
    name: string,
    lines = 1000,
    format: 'raw' | 'plain' = 'plain'
  ): Promise<SessionOutputResponse> {
    return this.fetch<SessionOutputResponse>(
      `/api/sessions/${encodeURIComponent(name)}/output?lines=${lines}&format=${format}`
    );
  }

  async sendInput(name: string, text: string, sendEnter = true): Promise<SessionInputResponse> {
    return this.fetch<SessionInputResponse>(`/api/sessions/${encodeURIComponent(name)}/input`, {
      method: 'POST',
      body: JSON.stringify({ text, sendEnter }),
    });
  }

  async stopSession(name: string): Promise<{ success: boolean; error?: string }> {
    return this.fetch(`/api/sessions/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  async archiveSession(name: string): Promise<{ success: boolean; session?: SessionInfo }> {
    return this.fetch(`/api/sessions/${encodeURIComponent(name)}/archive`, {
      method: 'POST',
    });
  }

  async getCapacity(): Promise<{ max: number; running: number; available: number }> {
    return this.fetch('/api/capacity');
  }

  async listProjects(): Promise<string[]> {
    const data = await this.fetch<{ projects: string[] }>('/api/projects');
    return data.projects;
  }
}
