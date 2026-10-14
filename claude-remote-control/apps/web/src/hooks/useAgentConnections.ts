'use client';

import { useState, useEffect, useCallback } from 'react';
import { stripProtocol } from '@/lib/utils';

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
  }) => Promise<AgentConnection>;
  removeConnection: (id: string) => Promise<void>;
  updateConnection: (
    id: string,
    data: { url?: string; name?: string; method?: string; color?: string }
  ) => Promise<AgentConnection>;
  refetch: () => Promise<void>;
}

/**
 * LOCAL MODE (self-hosted, no cloud).
 *
 * This hook stores agent connections in the browser's localStorage instead of
 * the cloud Neon database behind `/api/connections` (which requires Neon Auth
 * sign-in). That lets the dashboard talk straight to a local/LAN agent with no
 * account, no database and no sign-in.
 *
 * On first load, if no connection is stored, it seeds a default connection that
 * points at the agent on the SAME host the dashboard is served from, port 4678.
 * So opening the dashboard at http://10.0.10.2:3001 seeds agent 10.0.10.2:4678,
 * and http://localhost:3001 seeds localhost:4678 — always "local, not a
 * hard-coded localhost".
 */
const STORAGE_KEY = '247-local-connections';
const AGENT_PORT = 4678;
// Stable id for the auto-seeded local agent so that session deep-links
// (?machine=<id>) resolve to the same machine across reloads, browsers and
// devices — a random per-browser UUID would break those links.
export const LOCAL_DEFAULT_ID = 'local-default';
const SAVE_ERROR_MESSAGE = 'Could not save connections to this browser (storage blocked or full).';

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Only host[:port] is case-insensitive; paths must stay distinct.
function normalizeUrl(url: string): string {
  const [authority, ...path] = stripProtocol(url).split('/');
  return [authority.toLowerCase(), ...path].join('/');
}

// Returns null when nothing usable is stored (key absent, unreadable or
// corrupt) so first run can be told apart from a deliberately emptied list.
function readStore(): AgentConnection[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AgentConnection[]) : null;
  } catch {
    return null;
  }
}

// Returns false when the write could not be persisted (private window, storage
// disabled, or quota exceeded) so callers can surface an error instead of
// silently pretending the change was saved.
function writeStore(connections: AgentConnection[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    return true;
  } catch {
    return false;
  }
}

function defaultConnection(): AgentConnection {
  const host =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'localhost';
  const isLoopback =
    host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  return {
    id: LOCAL_DEFAULT_ID,
    url: `${host}:${AGENT_PORT}`,
    name: `${host} (local)`,
    method: isLoopback ? 'localhost' : 'custom',
    createdAt: Date.now(),
  };
}

export function useAgentConnections(): UseAgentConnectionsReturn {
  const [connections, setConnections] = useState<AgentConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Throws when the write fails so callers never report a false success.
  const persist = useCallback((next: AgentConnection[]) => {
    if (!writeStore(next)) {
      setError(SAVE_ERROR_MESSAGE);
      throw new Error(SAVE_ERROR_MESSAGE);
    }
    setConnections(next);
    setError(null);
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      setError(null);
      let stored = readStore();
      // Seed a default local agent only when nothing was ever stored, so an
      // intentionally emptied list stays empty across reloads.
      if (stored === null) {
        stored = [defaultConnection()];
        writeStore(stored);
      }
      setConnections(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
    if (typeof window === 'undefined') return;
    // Keep multiple open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setConnections(readStore() ?? []);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [fetchConnections]);

  // Mutations re-read storage right before writing (never the React snapshot),
  // so changes made in another tab are merged rather than overwritten.
  const addConnection = async (data: {
    url: string;
    name: string;
    method?: string;
    color?: string;
  }): Promise<AgentConnection> => {
    const current = readStore() ?? [];
    // Dedupe by normalized URL so the same agent is never registered twice
    // (which would open duplicate WebSockets and list every session twice).
    const existing = current.find((c) => normalizeUrl(c.url) === normalizeUrl(data.url));
    if (existing) {
      const updated: AgentConnection = {
        ...existing,
        name: data.name,
        method: (data.method as AgentConnection['method']) || existing.method,
        ...(data.color !== undefined ? { color: data.color } : {}),
      };
      persist(current.map((c) => (c.id === existing.id ? updated : c)));
      return updated;
    }
    const connection: AgentConnection = {
      id: newId(),
      url: data.url,
      name: data.name,
      method: (data.method as AgentConnection['method']) || 'custom',
      color: data.color,
      createdAt: Date.now(),
    };
    persist([...current, connection]);
    return connection;
  };

  const removeConnection = async (id: string): Promise<void> => {
    persist((readStore() ?? []).filter((c) => c.id !== id));
  };

  const updateConnection = async (
    id: string,
    data: { url?: string; name?: string; method?: string; color?: string }
  ): Promise<AgentConnection> => {
    const current = readStore() ?? [];
    const existing = current.find((c) => c.id === id);
    if (!existing) {
      throw new Error('Connection not found');
    }
    const updated: AgentConnection = {
      ...existing,
      ...(data.url !== undefined ? { url: data.url } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.method !== undefined
        ? { method: data.method as AgentConnection['method'] }
        : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
    };
    persist(current.map((c) => (c.id === id ? updated : c)));
    return updated;
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
