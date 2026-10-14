'use client';

import { useState } from 'react';
import { buildApiUrl } from '@/lib/utils';
import { authHeaders } from '@/lib/agent-auth';

interface Machine {
  id: string;
  name: string;
  status: string;
  config?: {
    projects: string[];
    agentUrl?: string;
    authToken?: string;
  };
}

interface CloneResult {
  success: boolean;
  project?: string;
  path?: string;
  error?: string;
}

export function useClone(selectedMachine: Machine | null) {
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const cloneRepo = async (url: string): Promise<CloneResult> => {
    if (!selectedMachine) {
      return { success: false, error: 'No machine selected' };
    }

    setCloning(true);
    setCloneError(null);

    try {
      const agentUrl = selectedMachine.config?.agentUrl || 'localhost:4678';
      const response = await fetch(buildApiUrl(agentUrl, '/api/clone'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(selectedMachine.config?.authToken),
        },
        body: JSON.stringify({ url }),
      });

      const result: CloneResult = await response.json();

      if (!result.success) {
        setCloneError(result.error || 'Clone failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Clone failed';
      setCloneError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setCloning(false);
    }
  };

  const clearError = () => {
    setCloneError(null);
  };

  return {
    cloneRepo,
    cloning,
    cloneError,
    clearError,
  };
}
