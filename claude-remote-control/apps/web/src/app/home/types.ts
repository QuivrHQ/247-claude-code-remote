import type { RalphLoopConfig } from '@vibecompany/247-shared';

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
  ralphConfig?: RalphLoopConfig;
}

export const DEFAULT_MACHINE_ID = 'local-agent';
