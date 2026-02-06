'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { SessionInfo } from '@/lib/types';
import { buildWebSocketUrl, buildApiUrl } from '@/lib/utils';
import { wsLogger, pollingLogger, archivedLogger } from '@/lib/logger';
import type { WSSessionsMessageFromAgent } from '247-shared';

interface SessionPollingContextValue {
  sessions: SessionInfo[];
  archivedSessions: SessionInfo[];
  agentUrl: string | null;
  setAgentUrl: (url: string | null) => void;
  refreshSessions: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isWsConnected: boolean;
  setOnNeedsAttention: (callback: ((sessionName: string) => void) | undefined) => void;
}

const SessionPollingContext = createContext<SessionPollingContextValue | null>(null);

const FALLBACK_POLLING_INTERVAL = 30000;
const FETCH_TIMEOUT = 5000;
const WS_RECONNECT_BASE_DELAY = 1000;
const WS_RECONNECT_MAX_DELAY = 30000;
const MAX_SESSIONS = 50;
const MAX_ARCHIVED = 100;

function limitSessions(sessions: SessionInfo[], maxCount: number): SessionInfo[] {
  if (sessions.length <= maxCount) return sessions;
  const sorted = [...sessions].sort((a, b) => {
    const aTime = a.lastStatusChange ? new Date(a.lastStatusChange).getTime() : 0;
    const bTime = b.lastStatusChange ? new Date(b.lastStatusChange).getTime() : 0;
    return bTime - aTime;
  });
  return sorted.slice(0, maxCount);
}

export function SessionPollingProvider({ children }: { children: ReactNode }) {
  const [agentUrl, setAgentUrlState] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_BASE_DELAY);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onNeedsAttentionRef = useRef<((sessionName: string) => void) | undefined>(undefined);
  const agentUrlRef = useRef<string | null>(null);

  const setOnNeedsAttention = useCallback(
    (callback: ((sessionName: string) => void) | undefined) => {
      onNeedsAttentionRef.current = callback;
    },
    []
  );

  const setAgentUrl = useCallback((url: string | null) => {
    setAgentUrlState(url);
    agentUrlRef.current = url;
  }, []);

  // Keep ref in sync
  useEffect(() => {
    agentUrlRef.current = agentUrl;
  }, [agentUrl]);

  // Fetch sessions via HTTP
  const fetchSessions = useCallback(async (url: string): Promise<void> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(buildApiUrl(url, '/api/sessions'), {
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Failed to fetch sessions');

      const data: SessionInfo[] = await response.json();
      setSessions(limitSessions(data, MAX_SESSIONS));
      setError(null);
    } catch (err) {
      const errorMsg =
        (err as Error).name === 'AbortError'
          ? 'Agent not responding'
          : 'Could not connect to agent';
      setError(errorMsg);
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  // Fetch archived sessions
  const fetchArchivedSessions = useCallback(async (url: string): Promise<void> => {
    try {
      const response = await fetch(buildApiUrl(url, '/api/sessions/archived'));
      if (!response.ok) return;

      const data: SessionInfo[] = await response.json();
      setArchivedSessions(limitSessions(data, MAX_ARCHIVED));
    } catch (err) {
      archivedLogger.error('Failed to fetch archived sessions', err);
    }
  }, []);

  // Connect WebSocket
  const connectWebSocket = useCallback(
    (url: string) => {
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';
      const wsUrl = buildWebSocketUrl(url, `/sessions?v=${encodeURIComponent(appVersion)}`);

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      wsLogger.info(`Connecting to ${wsUrl}`);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          wsLogger.info('WebSocket connected');
          reconnectDelayRef.current = WS_RECONNECT_BASE_DELAY;
          setWsConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const msg: WSSessionsMessageFromAgent = JSON.parse(event.data);

            switch (msg.type) {
              case 'sessions-list':
                wsLogger.info(`Received sessions-list: ${msg.sessions.length} sessions`);
                setSessions(limitSessions(msg.sessions, MAX_SESSIONS));
                setError(null);
                break;

              case 'session-removed':
                wsLogger.info(`Session removed: ${msg.sessionName}`);
                setSessions((prev) => prev.filter((s) => s.name !== msg.sessionName));
                break;

              case 'session-archived':
                wsLogger.info(`Session archived: ${msg.sessionName}`);
                setSessions((prev) => prev.filter((s) => s.name !== msg.sessionName));
                setArchivedSessions((prev) => {
                  const exists = prev.some((s) => s.name === msg.session.name);
                  if (exists) return prev;
                  return limitSessions([msg.session, ...prev], MAX_ARCHIVED);
                });
                break;

              case 'version-info':
                wsLogger.info(`Agent version: ${msg.agentVersion}`);
                break;

              case 'update-pending':
                wsLogger.info(`Agent updating to ${msg.targetVersion}: ${msg.message}`);
                break;

              case 'status-update':
                wsLogger.info(`Status update: ${msg.session.name} -> ${msg.session.status}`);
                setSessions((prev) => {
                  const idx = prev.findIndex((s) => s.name === msg.session.name);
                  if (idx === -1) return prev;
                  const previousStatus = prev[idx].status;
                  const updated = [...prev];
                  updated[idx] = {
                    ...updated[idx],
                    status: msg.session.status,
                    attentionReason: msg.session.attentionReason,
                    statusSource: msg.session.statusSource,
                    lastStatusChange: msg.session.lastStatusChange,
                  };
                  if (
                    msg.session.status === 'needs_attention' &&
                    previousStatus !== 'needs_attention'
                  ) {
                    onNeedsAttentionRef.current?.(msg.session.name);
                  }
                  return updated;
                });
                break;
            }
          } catch (err) {
            wsLogger.error('Failed to parse message', err);
          }
        };

        ws.onclose = (event) => {
          wsLogger.info('WebSocket disconnected', { code: event.code, reason: event.reason });
          wsRef.current = null;
          setWsConnected(false);

          const currentDelay = reconnectDelayRef.current;
          const nextDelay = Math.min(currentDelay * 2, WS_RECONNECT_MAX_DELAY);
          reconnectDelayRef.current = nextDelay;

          wsLogger.info(`Reconnecting in ${currentDelay}ms`);

          reconnectTimeoutRef.current = setTimeout(() => {
            const currentUrl = agentUrlRef.current;
            if (currentUrl) {
              connectWebSocket(currentUrl);
            }
          }, currentDelay);
        };

        ws.onerror = () => {
          wsLogger.error('WebSocket error');
        };
      } catch (err) {
        wsLogger.error('Failed to create WebSocket', err);
      }
    },
    []
  );

  // Manage WebSocket connection based on agentUrl
  useEffect(() => {
    if (agentUrl) {
      connectWebSocket(agentUrl);
      fetchArchivedSessions(agentUrl);
    } else {
      // Disconnect
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setSessions([]);
      setArchivedSessions([]);
      setWsConnected(false);
      setError(null);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [agentUrl, connectWebSocket, fetchArchivedSessions]);

  // Fallback HTTP polling
  useEffect(() => {
    if (!agentUrl) return;

    fetchSessions(agentUrl);
    const interval = setInterval(() => {
      if (agentUrl) {
        pollingLogger.info('HTTP polling');
        fetchSessions(agentUrl);
      }
    }, FALLBACK_POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [agentUrl, fetchSessions]);

  const refreshSessions = useCallback(async () => {
    if (!agentUrl) return;
    setIsLoading(true);
    await fetchSessions(agentUrl);
    setIsLoading(false);
  }, [agentUrl, fetchSessions]);

  const value: SessionPollingContextValue = {
    sessions,
    archivedSessions,
    agentUrl,
    setAgentUrl,
    refreshSessions,
    isLoading,
    error,
    isWsConnected: wsConnected,
    setOnNeedsAttention,
  };

  return <SessionPollingContext.Provider value={value}>{children}</SessionPollingContext.Provider>;
}

export function useSessionPolling() {
  const context = useContext(SessionPollingContext);
  if (!context) {
    throw new Error('useSessionPolling must be used within SessionPollingProvider');
  }
  return context;
}

// Re-export types for convenience
export type { SessionInfo };
