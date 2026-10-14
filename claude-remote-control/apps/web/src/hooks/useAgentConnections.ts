'use client';

import { useState, useEffect, useCallback } from 'react';

// Re-export the type with proper typing for method field
// This matches StoredAgentConnection in AgentConnectionSettings.tsx
export interface AgentConnection {
  id: string;
  url: string;
  name: string;
  method: 'localhost' | 'tailscale' | 'custom' | 'cloud';
  createdAt: number;
  isCloud?: boolean;
  cloudAgentId?: string;
  color?: string;
  /** Bearer token the agent requires (entered by the user when connecting). */
  authToken?: string;
}

export interface UseAgentConnectionsReturn {
  connections: AgentConnection[];
  loading: boolean;
  error: string | null;
  addConnection: (data: {
    url: string;
    name: string;
    method?: string;
    color?: string;
    authToken?: string;
  }) => Promise<AgentConnection>;
  removeConnection: (id: string) => Promise<void>;
  updateConnection: (
    id: string,
    data: { url?: string; name?: string; method?: string; color?: string; authToken?: string }
  ) => Promise<AgentConnection>;
  refetch: () => Promise<void>;
}

export function useAgentConnections(): UseAgentConnectionsReturn {
  const [connections, setConnections] = useState<AgentConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/connections');
      if (!res.ok) {
        if (res.status === 401) {
          // Not authenticated, middleware will handle redirect
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch connections');
      }
      const data = await res.json();
      // Convert DB format to AgentConnection format
      setConnections(
        data.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          url: c.url as string,
          name: c.name as string,
          method: c.method as AgentConnection['method'],
          createdAt: c.createdAt ? new Date(c.createdAt as string).getTime() : Date.now(),
          isCloud: c.isCloud as boolean | undefined,
          cloudAgentId: c.cloudAgentId as string | undefined,
          color: c.color as string | undefined,
          authToken: c.authToken as string | undefined,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const addConnection = async (data: {
    url: string;
    name: string;
    method?: string;
    color?: string;
    authToken?: string;
  }): Promise<AgentConnection> => {
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error('Failed to create connection');
    }

    const raw = await res.json();
    const connection: AgentConnection = {
      id: raw.id,
      url: raw.url,
      name: raw.name,
      method: raw.method as AgentConnection['method'],
      createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now(),
      isCloud: raw.isCloud,
      cloudAgentId: raw.cloudAgentId,
      color: raw.color,
      authToken: raw.authToken,
    };
    setConnections((prev) => [...prev, connection]);
    return connection;
  };

  const removeConnection = async (id: string): Promise<void> => {
    const res = await fetch(`/api/connections/${id}`, { method: 'DELETE' });

    if (!res.ok) {
      throw new Error('Failed to delete connection');
    }

    setConnections((prev) => prev.filter((c) => c.id !== id));
  };

  const updateConnection = async (
    id: string,
    data: { url?: string; name?: string; method?: string; color?: string; authToken?: string }
  ): Promise<AgentConnection> => {
    const res = await fetch(`/api/connections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error('Failed to update connection');
    }

    const raw = await res.json();
    const connection: AgentConnection = {
      id: raw.id,
      url: raw.url,
      name: raw.name,
      method: raw.method as AgentConnection['method'],
      createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now(),
      isCloud: raw.isCloud,
      cloudAgentId: raw.cloudAgentId,
      color: raw.color,
      authToken: raw.authToken,
    };
    setConnections((prev) => prev.map((c) => (c.id === id ? connection : c)));
    return connection;
  };

  return {
    connections,
    loading,
    error,
    addConnection,
    removeConnection,
    updateConnection,
    refetch: fetchConnections,
  };
}
