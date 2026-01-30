'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/utils';
import type { AgentConnection } from './useAgentConnections';

export interface UseSessionActionsReturn {
  /** Kill (terminate) a session */
  killSession: (machineId: string, sessionName: string) => Promise<boolean>;
  /** Archive a session (close terminal but keep in history) */
  archiveSession: (machineId: string, sessionName: string) => Promise<boolean>;
  /** Acknowledge a session (clear needs_attention status) */
  acknowledgeSession: (machineId: string, sessionName: string) => Promise<boolean>;
}

/**
 * Shared hook for session actions (kill, archive, acknowledge).
 * Used by both mobile (MobileStatusStrip) and desktop (SessionListPanel via home/index.tsx).
 */
export function useSessionActions(agentConnections: AgentConnection[]): UseSessionActionsReturn {
  const findMachine = useCallback(
    (machineId: string) => {
      return agentConnections.find((c) => c.id === machineId);
    },
    [agentConnections]
  );

  const killSession = useCallback(
    async (machineId: string, sessionName: string): Promise<boolean> => {
      const machine = findMachine(machineId);
      if (!machine) {
        toast.error('Agent not found');
        return false;
      }

      try {
        const response = await fetch(
          buildApiUrl(machine.url, `/api/sessions/${encodeURIComponent(sessionName)}`),
          { method: 'DELETE' }
        );

        if (response.ok) {
          toast.success('Session terminated');
          return true;
        }
        toast.error('Failed to terminate session');
        return false;
      } catch (err) {
        console.error('Failed to kill session:', err);
        toast.error('Could not connect to agent');
        return false;
      }
    },
    [findMachine]
  );

  const archiveSession = useCallback(
    async (machineId: string, sessionName: string): Promise<boolean> => {
      const machine = findMachine(machineId);
      if (!machine) {
        toast.error('Agent not found');
        return false;
      }

      try {
        const response = await fetch(
          buildApiUrl(machine.url, `/api/sessions/${encodeURIComponent(sessionName)}/archive`),
          { method: 'POST' }
        );

        if (response.ok) {
          toast.success('Session archived');
          return true;
        }
        toast.error('Failed to archive session');
        return false;
      } catch (err) {
        console.error('Failed to archive session:', err);
        toast.error('Could not connect to agent');
        return false;
      }
    },
    [findMachine]
  );

  const acknowledgeSession = useCallback(
    async (machineId: string, sessionName: string): Promise<boolean> => {
      const machine = findMachine(machineId);
      if (!machine) {
        return false;
      }

      try {
        const response = await fetch(
          buildApiUrl(machine.url, `/api/sessions/${encodeURIComponent(sessionName)}/acknowledge`),
          { method: 'POST' }
        );
        return response.ok;
      } catch (err) {
        console.error('Failed to acknowledge session:', err);
        return false;
      }
    },
    [findMachine]
  );

  return { killSession, archiveSession, acknowledgeSession };
}
