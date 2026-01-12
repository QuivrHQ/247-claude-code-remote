'use client';

import { useState, useEffect, useCallback } from 'react';

const PROVISIONING_URL = process.env.NEXT_PUBLIC_PROVISIONING_URL;

export interface FlyioStatus {
  connected: boolean;
  orgId?: string;
  orgName?: string;
  connectedAt?: string;
}

interface UseFlyioStatusReturn {
  status: FlyioStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and manage Fly.io connection status
 * Only fetches when user is authenticated
 */
export function useFlyioStatus(isAuthenticated: boolean): UseFlyioStatusReturn {
  const [status, setStatus] = useState<FlyioStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!PROVISIONING_URL || !isAuthenticated) {
      setStatus(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${PROVISIONING_URL}/api/flyio/status`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, clear status
          setStatus(null);
          return;
        }
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Fly.io status');
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on mount and when auth changes
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh: fetchStatus,
  };
}
