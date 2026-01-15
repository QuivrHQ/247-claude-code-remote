export interface LocalMachine {
  id: string;
  name: string;
  status: 'online' | 'offline';
  config?: {
    projects: string[];
    agentUrl: string;
  };
}

export interface SelectedSession {
  machineId: string;
  sessionName: string;
  project: string;
  environmentId?: string;
  planningProjectId?: string;
}

// Re-export StoredAgentConnection from AgentConnectionSettings for convenience
export type { StoredAgentConnection } from '@/components/AgentConnectionSettings';

// Legacy constant - deprecated, use connection IDs instead
// @deprecated Use the connection's unique ID from StoredAgentConnection instead
export const DEFAULT_MACHINE_ID = 'local-agent';
