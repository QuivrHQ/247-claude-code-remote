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
import { SessionInfo, SessionWithMachine } from '@/lib/types';
import { buildWebSocketUrl, buildApiUrl } from '@/lib/utils';
import { requestNotificationPermission, showBrowserNotification } from '@/lib/notifications';
import type { WSSessionsMessageFromAgent } from '247-shared';

export interface Machine {
  id: string;
  name: string;
  status: string;
  config?: {
    projects: string[];
    agentUrl?: string;
  };
}

interface MachineSessionData {
  machineId: string;
  machineName: string;
  agentUrl: string;
  sessions: SessionInfo[];
  lastFetch: number;
  error: string | null;
  wsConnected: boolean;
}

interface SessionPollingContextValue {
  sessionsByMachine: Map<string, MachineSessionData>;
  machines: Machine[];
  getSessionsForMachine: (machineId: string) => SessionInfo[];
  getAllSessions: () => SessionWithMachine[];
  getArchivedSessions: () => SessionWithMachine[];
  getSession: (machineId: string, sessionName: string) => SessionInfo | null;
  refreshMachine: (machineId: string) => Promise<void>;
  setMachines: (machines: Machine[]) => void;
  isLoading: (machineId: string) => boolean;
  getError: (machineId: string) => string | null;
  isWsConnected: (machineId: string) => boolean;
}

const SessionPollingContext = createContext<SessionPollingContextValue | null>(null);

const FALLBACK_POLLING_INTERVAL = 30000; // Fallback HTTP poll every 30s (when WS connected)
const FETCH_TIMEOUT = 5000;
const WS_RECONNECT_BASE_DELAY = 1000;
const WS_RECONNECT_MAX_DELAY = 30000;

interface ArchivedSessionData {
  machineId: string;
  machineName: string;
  agentUrl: string;
  sessions: SessionInfo[];
}

export function SessionPollingProvider({ children }: { children: ReactNode }) {
  const [machines, setMachinesState] = useState<Machine[]>([]);
  const [sessionsByMachine, setSessionsByMachine] = useState<Map<string, MachineSessionData>>(
    new Map()
  );
  const [archivedByMachine, setArchivedByMachine] = useState<Map<string, ArchivedSessionData>>(
    new Map()
  );
  const [loadingMachines, setLoadingMachines] = useState<Set<string>>(new Set());

  const wsConnectionsRef = useRef<Map<string, WebSocket>>(new Map());
  const wsConnectedRef = useRef<Set<string>>(new Set()); // Track connected machines via ref for polling
  const wsReconnectDelaysRef = useRef<Map<string, number>>(new Map());
  const wsReconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear any pending reconnect timeouts
      for (const timeout of wsReconnectTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      wsReconnectTimeoutsRef.current.clear();
    };
  }, []);

  // NOTE: Machines are now managed by the parent component (from localStorage)
  // We no longer fetch from /api/machines - the dashboard is stateless!

  const fetchSessionsForMachine = useCallback(
    async (machine: Machine): Promise<MachineSessionData> => {
      const agentUrl = machine.config?.agentUrl || 'localhost:4678';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      // Check WS connected via ref (always current)
      const isWsConnected = wsConnectedRef.current.has(machine.id);

      try {
        const response = await fetch(buildApiUrl(agentUrl, '/api/sessions'), {
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Failed to fetch sessions');

        const sessions: SessionInfo[] = await response.json();

        return {
          machineId: machine.id,
          machineName: machine.name,
          agentUrl,
          sessions,
          lastFetch: Date.now(),
          error: null,
          wsConnected: isWsConnected,
        };
      } catch (err) {
        const errorMsg =
          (err as Error).name === 'AbortError'
            ? 'Agent not responding'
            : 'Could not connect to agent';

        return {
          machineId: machine.id,
          machineName: machine.name,
          agentUrl,
          sessions: [],
          lastFetch: Date.now(),
          error: errorMsg,
          wsConnected: isWsConnected,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
    []
  );

  // Remove a session from WebSocket
  const removeSession = useCallback((machineId: string, sessionName: string) => {
    setSessionsByMachine((prev) => {
      const next = new Map(prev);
      const existingData = next.get(machineId);

      if (existingData) {
        next.set(machineId, {
          ...existingData,
          sessions: existingData.sessions.filter((s) => s.name !== sessionName),
          lastFetch: Date.now(),
        });
      }

      return next;
    });
  }, []);

  // Archive a session (move from active to archived)
  const archiveSession = useCallback(
    (machineId: string, machineName: string, agentUrl: string, session: SessionInfo) => {
      // Remove from active sessions
      setSessionsByMachine((prev) => {
        const next = new Map(prev);
        const existingData = next.get(machineId);

        if (existingData) {
          next.set(machineId, {
            ...existingData,
            sessions: existingData.sessions.filter((s) => s.name !== session.name),
            lastFetch: Date.now(),
          });
        }

        return next;
      });

      // Add to archived sessions
      setArchivedByMachine((prev) => {
        const next = new Map(prev);
        const existingData = next.get(machineId);

        if (existingData) {
          // Add to existing archived list (avoid duplicates)
          const alreadyExists = existingData.sessions.some((s) => s.name === session.name);
          if (!alreadyExists) {
            next.set(machineId, {
              ...existingData,
              sessions: [session, ...existingData.sessions],
            });
          }
        } else {
          next.set(machineId, {
            machineId,
            machineName,
            agentUrl,
            sessions: [session],
          });
        }

        return next;
      });
    },
    []
  );

  // Fetch archived sessions for a machine
  const fetchArchivedSessions = useCallback(async (machine: Machine): Promise<void> => {
    const agentUrl = machine.config?.agentUrl || 'localhost:4678';

    try {
      const response = await fetch(buildApiUrl(agentUrl, '/api/sessions/archived'));
      if (!response.ok) return;

      const sessions: SessionInfo[] = await response.json();

      setArchivedByMachine((prev) => {
        const next = new Map(prev);
        next.set(machine.id, {
          machineId: machine.id,
          machineName: machine.name,
          agentUrl,
          sessions,
        });
        return next;
      });
    } catch (err) {
      console.error('[Archived] Failed to fetch archived sessions:', err);
    }
  }, []);

  // Connect WebSocket for a machine
  const connectWebSocket = useCallback(
    (machine: Machine) => {
      const agentUrl = machine.config?.agentUrl || 'localhost:4678';
      // Include app version in WebSocket URL for auto-update detection
      const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';
      const wsUrl = buildWebSocketUrl(agentUrl, `/sessions?v=${encodeURIComponent(appVersion)}`);

      // Close existing connection if any
      const existingWs = wsConnectionsRef.current.get(machine.id);
      if (existingWs) {
        existingWs.close();
        wsConnectionsRef.current.delete(machine.id);
      }

      console.log(`[WS] Connecting to ${wsUrl} for machine ${machine.name}`);

      try {
        const ws = new WebSocket(wsUrl);
        wsConnectionsRef.current.set(machine.id, ws);

        ws.onopen = () => {
          console.log(`[WS] Connected to ${machine.name}`);
          wsReconnectDelaysRef.current.set(machine.id, WS_RECONNECT_BASE_DELAY);
          wsConnectedRef.current.add(machine.id); // Track via ref for polling

          setSessionsByMachine((prev) => {
            const next = new Map(prev);
            const existingData = next.get(machine.id);
            if (existingData) {
              next.set(machine.id, { ...existingData, wsConnected: true, error: null });
            } else {
              next.set(machine.id, {
                machineId: machine.id,
                machineName: machine.name,
                agentUrl,
                sessions: [],
                lastFetch: Date.now(),
                error: null,
                wsConnected: true,
              });
            }
            return next;
          });
        };

        ws.onmessage = (event) => {
          try {
            const msg: WSSessionsMessageFromAgent = JSON.parse(event.data);

            switch (msg.type) {
              case 'sessions-list':
                console.log(`[WS] Received sessions-list: ${msg.sessions.length} sessions`);
                setSessionsByMachine((prev) => {
                  const next = new Map(prev);
                  next.set(machine.id, {
                    machineId: machine.id,
                    machineName: machine.name,
                    agentUrl,
                    sessions: msg.sessions,
                    lastFetch: Date.now(),
                    error: null,
                    wsConnected: true,
                  });
                  return next;
                });
                break;

              case 'session-removed':
                console.log(`[WS] Session removed: ${msg.sessionName}`);
                removeSession(machine.id, msg.sessionName);
                break;

              case 'session-archived':
                console.log(`[WS] Session archived: ${msg.sessionName}`);
                archiveSession(machine.id, machine.name, agentUrl, msg.session);
                break;

              case 'version-info':
                console.log(`[WS] Agent version: ${msg.agentVersion}`);
                break;

              case 'update-pending':
                console.log(`[WS] Agent updating to ${msg.targetVersion}: ${msg.message}`);
                // Agent will restart, WebSocket will reconnect automatically
                break;

              case 'status-update':
                console.log(`[WS] Status update: ${msg.session.name} -> ${msg.session.status}`);
                setSessionsByMachine((prev) => {
                  const next = new Map(prev);
                  const existingData = next.get(machine.id);
                  if (existingData) {
                    const sessionIndex = existingData.sessions.findIndex(
                      (s) => s.name === msg.session.name
                    );
                    if (sessionIndex !== -1) {
                      const updatedSessions = [...existingData.sessions];
                      updatedSessions[sessionIndex] = {
                        ...updatedSessions[sessionIndex],
                        status: msg.session.status,
                        attentionReason: msg.session.attentionReason,
                        statusSource: msg.session.statusSource,
                        lastStatusChange: msg.session.lastStatusChange,
                      };
                      next.set(machine.id, { ...existingData, sessions: updatedSessions });
                    }
                  }
                  return next;
                });
                // Trigger browser notification for needs_attention (except task_complete)
                if (
                  msg.session.status === 'needs_attention' &&
                  msg.session.attentionReason !== 'task_complete'
                ) {
                  showBrowserNotification(msg.session.project, msg.session.attentionReason);
                }
                break;
            }
          } catch (err) {
            console.error('[WS] Failed to parse message:', err);
          }
        };

        ws.onclose = (event) => {
          console.log(`[WS] Disconnected from ${machine.name}:`, event.code, event.reason);
          wsConnectionsRef.current.delete(machine.id);
          wsConnectedRef.current.delete(machine.id); // Remove from ref

          setSessionsByMachine((prev) => {
            const next = new Map(prev);
            const existingData = next.get(machine.id);
            if (existingData) {
              next.set(machine.id, { ...existingData, wsConnected: false });
            }
            return next;
          });

          // Schedule reconnection with exponential backoff
          const currentDelay =
            wsReconnectDelaysRef.current.get(machine.id) || WS_RECONNECT_BASE_DELAY;
          const nextDelay = Math.min(currentDelay * 2, WS_RECONNECT_MAX_DELAY);
          wsReconnectDelaysRef.current.set(machine.id, nextDelay);

          console.log(`[WS] Reconnecting to ${machine.name} in ${currentDelay}ms`);

          const timeout = setTimeout(() => {
            // Only reconnect if machine is still online
            const currentMachine = machines.find((m) => m.id === machine.id);
            if (currentMachine?.status === 'online') {
              connectWebSocket(currentMachine);
            }
          }, currentDelay);

          wsReconnectTimeoutsRef.current.set(machine.id, timeout);
        };

        ws.onerror = (event) => {
          console.error(`[WS] Error for ${machine.name}:`, event);
        };
      } catch (err) {
        console.error(`[WS] Failed to create WebSocket for ${machine.name}:`, err);
      }
    },
    [machines, removeSession, archiveSession]
  );

  // Manage WebSocket connections based on online machines
  useEffect(() => {
    const onlineMachines = machines.filter((m) => m.status === 'online');

    // Connect to new online machines
    for (const machine of onlineMachines) {
      if (!wsConnectionsRef.current.has(machine.id)) {
        connectWebSocket(machine);
      }
    }

    // Close connections for offline machines
    for (const [machineId, ws] of wsConnectionsRef.current) {
      const machine = machines.find((m) => m.id === machineId);
      if (!machine || machine.status !== 'online') {
        ws.close();
        wsConnectionsRef.current.delete(machineId);

        // Clear reconnect timeout
        const timeout = wsReconnectTimeoutsRef.current.get(machineId);
        if (timeout) {
          clearTimeout(timeout);
          wsReconnectTimeoutsRef.current.delete(machineId);
        }
      }
    }

    // Cleanup on unmount
    return () => {
      for (const ws of wsConnectionsRef.current.values()) {
        ws.close();
      }
      wsConnectionsRef.current.clear();

      for (const timeout of wsReconnectTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      wsReconnectTimeoutsRef.current.clear();
    };
  }, [machines, connectWebSocket]);

  // Fetch archived sessions when machines change
  useEffect(() => {
    const onlineMachines = machines.filter((m) => m.status === 'online');
    for (const machine of onlineMachines) {
      // Fetch archived sessions if not already loaded
      if (!archivedByMachine.has(machine.id)) {
        fetchArchivedSessions(machine);
      }
    }
  }, [machines, archivedByMachine, fetchArchivedSessions]);

  // Fallback HTTP polling (less frequent when WS is working)
  const pollAllMachines = useCallback(async () => {
    const onlineMachines = machines.filter((m) => m.status === 'online');

    if (onlineMachines.length === 0) return;

    console.log('[Polling] HTTP polling', onlineMachines.length, 'machines');

    const results = await Promise.all(
      onlineMachines.map((machine) => fetchSessionsForMachine(machine))
    );

    setSessionsByMachine((prev) => {
      const next = new Map(prev);
      for (const result of results) {
        next.set(result.machineId, result);
      }
      return next;
    });
  }, [machines, fetchSessionsForMachine]);

  const refreshMachine = useCallback(
    async (machineId: string) => {
      const machine = machines.find((m) => m.id === machineId);
      if (!machine || machine.status !== 'online') return;

      setLoadingMachines((prev) => new Set(prev).add(machineId));

      const result = await fetchSessionsForMachine(machine);

      setSessionsByMachine((prev) => {
        const next = new Map(prev);
        next.set(result.machineId, result);
        return next;
      });

      setLoadingMachines((prev) => {
        const next = new Set(prev);
        next.delete(machineId);
        return next;
      });
    },
    [machines, fetchSessionsForMachine]
  );

  // Fallback polling interval
  useEffect(() => {
    if (machines.length === 0) return;

    pollAllMachines();
    const interval = setInterval(pollAllMachines, FALLBACK_POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [pollAllMachines, machines.length]);

  // Get all sessions across all machines, flattened with machine context
  const getAllSessions = useCallback((): SessionWithMachine[] => {
    const allSessions: SessionWithMachine[] = [];
    for (const [, data] of sessionsByMachine) {
      for (const session of data.sessions) {
        allSessions.push({
          ...session,
          machineId: data.machineId,
          machineName: data.machineName,
          agentUrl: data.agentUrl,
        });
      }
    }
    return allSessions;
  }, [sessionsByMachine]);

  // Get all archived sessions across all machines
  const getArchivedSessions = useCallback((): SessionWithMachine[] => {
    const allArchived: SessionWithMachine[] = [];
    for (const [, data] of archivedByMachine) {
      for (const session of data.sessions) {
        allArchived.push({
          ...session,
          machineId: data.machineId,
          machineName: data.machineName,
          agentUrl: data.agentUrl,
        });
      }
    }
    return allArchived;
  }, [archivedByMachine]);

  // Get a specific session by machine and name
  const getSession = useCallback(
    (machineId: string, sessionName: string): SessionInfo | null => {
      const data = sessionsByMachine.get(machineId);
      if (!data) return null;
      return data.sessions.find((s) => s.name === sessionName) || null;
    },
    [sessionsByMachine]
  );

  const value: SessionPollingContextValue = {
    sessionsByMachine,
    machines,
    getSessionsForMachine: (machineId: string) => sessionsByMachine.get(machineId)?.sessions || [],
    getAllSessions,
    getArchivedSessions,
    getSession,
    refreshMachine,
    setMachines: setMachinesState,
    isLoading: (machineId: string) => loadingMachines.has(machineId),
    getError: (machineId: string) => sessionsByMachine.get(machineId)?.error || null,
    isWsConnected: (machineId: string) => sessionsByMachine.get(machineId)?.wsConnected ?? false,
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
export type { SessionInfo, SessionWithMachine };
