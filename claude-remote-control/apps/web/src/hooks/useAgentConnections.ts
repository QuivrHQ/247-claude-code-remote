'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'agentUrl';

// Migrate from old multi-connection format or old single connection format
function migrateIfNeeded(): void {
  if (typeof window === 'undefined') return;
  try {
    // Check for old multi-connection format
    const oldMulti = localStorage.getItem('agentConnections');
    if (oldMulti && !localStorage.getItem(STORAGE_KEY)) {
      const connections = JSON.parse(oldMulti);
      if (Array.isArray(connections) && connections.length > 0) {
        localStorage.setItem(STORAGE_KEY, connections[0].url);
      }
      localStorage.removeItem('agentConnections');
    }
    // Check for old single connection format
    const oldSingle = localStorage.getItem('agentConnection');
    if (oldSingle && !localStorage.getItem(STORAGE_KEY)) {
      const conn = JSON.parse(oldSingle);
      if (conn?.url) {
        localStorage.setItem(STORAGE_KEY, conn.url);
      }
      localStorage.removeItem('agentConnection');
    }
  } catch {
    // Ignore migration errors
  }
}

export interface UseAgentConnectionReturn {
  agentUrl: string | null;
  loading: boolean;
  setAgentUrl: (url: string) => void;
  clearAgentUrl: () => void;
}

export function useAgentConnection(): UseAgentConnectionReturn {
  const [agentUrl, setAgentUrlState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    migrateIfNeeded();
    const stored = localStorage.getItem(STORAGE_KEY);
    setAgentUrlState(stored);
    setLoading(false);
  }, []);

  const setAgentUrl = useCallback((url: string) => {
    localStorage.setItem(STORAGE_KEY, url);
    setAgentUrlState(url);
  }, []);

  const clearAgentUrl = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAgentUrlState(null);
  }, []);

  return {
    agentUrl,
    loading,
    setAgentUrl,
    clearAgentUrl,
  };
}
