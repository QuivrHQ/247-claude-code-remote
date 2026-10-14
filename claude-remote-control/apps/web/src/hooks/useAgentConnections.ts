'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLocalAgentHost, stripProtocol } from '@/lib/utils';
import {
  CONNECTIONS_STORAGE_KEY,
  LEGACY_CONNECTIONS_KEY,
  LEGACY_SINGLE_CONNECTION_KEY,
} from '@/lib/connection-storage';

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

export interface UseAgentConnectionsOptions {
  /**
   * Seed a default agent (on the dashboard's own host) when nothing has ever
   * been stored. Pages that save their own first connection, such as the
   * pairing page, turn this off so no extra machine appears next to it.
   */
  seedDefault?: boolean;
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
 * On first load, connections saved by earlier versions (`agentConnections`,
 * `agentConnection`) are migrated. If there are none, a default connection is
 * seeded that points at the agent on the SAME host the dashboard is served
 * from, port 4678: opening http://10.0.10.2:3001 seeds 10.0.10.2:4678, and
 * http://localhost:3001 seeds localhost:4678.
 */
const AGENT_PORT = 4678;
const STORE_LOCK_NAME = '247-local-connections';
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

function isStoredConnection(value: unknown): value is AgentConnection {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.url === 'string';
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// Returns null when nothing usable is stored (key absent, unreadable or
// corrupt) so first run can be told apart from a deliberately emptied list.
function readStore(): AgentConnection[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = parseJson(window.localStorage.getItem(CONNECTIONS_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed.filter(isStoredConnection) : null;
  } catch {
    return null;
  }
}

// Connections saved by earlier versions: a list under `agentConnections` or a
// single connection under `agentConnection`. Left in place; only read.
function readLegacyConnections(): AgentConnection[] {
  if (typeof window === 'undefined') return [];
  try {
    const list = parseJson(window.localStorage.getItem(LEGACY_CONNECTIONS_KEY));
    if (Array.isArray(list)) {
      const connections = list.filter(isStoredConnection);
      if (connections.length > 0) return connections;
    }

    const single = parseJson(window.localStorage.getItem(LEGACY_SINGLE_CONNECTION_KEY));
    if (typeof single === 'object' && single !== null) {
      const { url, name, method } = single as Record<string, unknown>;
      if (typeof url === 'string') {
        return [
          {
            id: newId(),
            url,
            name: typeof name === 'string' && name ? name : 'Local Agent',
            method: (method as AgentConnection['method']) || 'custom',
            createdAt: Date.now(),
          },
        ];
      }
    }
  } catch {
    // Storage unavailable: nothing to migrate.
  }
  return [];
}

// Returns false when the write could not be persisted (private window, storage
// disabled, or quota exceeded) so callers can surface an error instead of
// silently pretending the change was saved.
function writeStore(connections: AgentConnection[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connections));
    return true;
  } catch {
    return false;
  }
}

// Serialize read-modify-write cycles across tabs where the Web Locks API
// exists (secure contexts). Elsewhere the cycle still re-reads storage right
// before writing, which leaves only a sub-millisecond window.
async function withStoreLock<T>(task: () => T): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return task();
  return locks.request(STORE_LOCK_NAME, async () => task());
}

function defaultConnection(): AgentConnection {
  const host = getLocalAgentHost();
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

export function useAgentConnections(
  options: UseAgentConnectionsOptions = {}
): UseAgentConnectionsReturn {
  const { seedDefault = true } = options;
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
      if (stored === null) {
        // First run: carry over earlier connections, else seed the default
        // agent. Seeding only happens when nothing was ever stored, so an
        // intentionally emptied list stays empty across reloads.
        const migrated = readLegacyConnections();
        if (migrated.length > 0) {
          stored = migrated;
          writeStore(stored);
        } else if (seedDefault) {
          stored = [defaultConnection()];
          writeStore(stored);
        } else {
          stored = [];
        }
      }
      setConnections(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [seedDefault]);

  useEffect(() => {
    fetchConnections();
    if (typeof window === 'undefined') return;
    // Keep multiple open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONNECTIONS_STORAGE_KEY) setConnections(readStore() ?? []);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [fetchConnections]);

  // Mutations re-read storage inside the lock (never the React snapshot), so
  // changes made in another tab are merged rather than overwritten.
  const addConnection = (data: {
    url: string;
    name: string;
    method?: string;
    color?: string;
  }): Promise<AgentConnection> =>
    withStoreLock(() => {
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
    });

  const removeConnection = (id: string): Promise<void> =>
    withStoreLock(() => {
      persist((readStore() ?? []).filter((c) => c.id !== id));
    });

  const updateConnection = (
    id: string,
    data: { url?: string; name?: string; method?: string; color?: string }
  ): Promise<AgentConnection> =>
    withStoreLock(() => {
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
    });

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
