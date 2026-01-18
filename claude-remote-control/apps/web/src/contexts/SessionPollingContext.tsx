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
import {
  type SessionInfo,
  requestNotificationPermission,
  showSessionNotification,
} from '@/lib/notifications';
import { buildWebSocketUrl, buildApiUrl } from '@/lib/utils';
import type { WSStatusMessageFromAgent, AttentionReason } from '247-shared';

// SSE event types from /api/events
interface SSEAttentionEvent {
  type: 'attention';
  sessionName: string;
  project: string;
  reason: AttentionReason;
  timestamp: number;
  machineId?: string;
  machineName?: string;
}

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

export interface SessionWithMachine extends SessionInfo {
  machineId: string;
  machineName: string;
  agentUrl: string;
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

  const prevSessionsRef = useRef<Map<string, SessionInfo[]>>(new Map());
  const wsConnectionsRef = useRef<Map<string, WebSocket>>(new Map());
  const wsConnectedRef = useRef<Set<string>>(new Set()); // Track connected machines via ref for polling
  const wsReconnectDelaysRef = useRef<Map<string, number>>(new Map());
  const wsReconnectTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Subscribe to SSE attention events from Next.js
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource('/api/events');

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'attention') {
              const attentionEvent = data as SSEAttentionEvent;
              console.log('[SSE] Attention event:', attentionEvent);

              // Find the machine for this event
              const machine = machines.find(
                (m) => m.id === attentionEvent.machineId || m.name === attentionEvent.machineName
              );

              if (machine) {
                // Create a minimal SessionInfo for notification
                const sessionInfo: SessionInfo = {
                  name: attentionEvent.sessionName,
                  project: attentionEvent.project,
                  createdAt: attentionEvent.timestamp,
                  status: 'needs_attention',
                  attentionReason: attentionEvent.reason,
                };

                showSessionNotification(machine.id, machine.name, sessionInfo);
              } else {
                console.log('[SSE] Machine not found for attention event:', attentionEvent);
              }
            }
          } catch (err) {
            console.error('[SSE] Failed to parse event:', err);
          }
        };

        eventSource.onerror = () => {
          console.log('[SSE] Connection error, reconnecting...');
          eventSource?.close();

          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000);
        };

        eventSource.onopen = () => {
          console.log('[SSE] Connected to attention events');
        };
      } catch (err) {
        console.error('[SSE] Failed to connect:', err);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      eventSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [machines]);

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

  const checkForNotifications = useCallback(
    (machineId: string, machineName: string, newSessions: SessionInfo[]) => {
      const prevSessions = prevSessionsRef.current.get(machineId) || [];

      for (const session of newSessions) {
        const prevSession = prevSessions.find((s) => s.name === session.name);
        // Only notify when status is 'needs_attention'
        const isActionable = session.status === 'needs_attention';

        const isNewEvent =
          !prevSession ||
          (session.lastStatusChange !== undefined &&
            session.lastStatusChange !== prevSession.lastStatusChange);

        if (isNewEvent && isActionable) {
          console.log(
            '[Notifications] TRIGGERING notification for:',
            session.name,
            session.status,
            session.attentionReason
          );
          showSessionNotification(machineId, machineName, session);
        }
      }

      prevSessionsRef.current.set(machineId, [...newSessions]);
    },
    []
  );

  // Update a single session from WebSocket
  const updateSingleSession = useCallback(
    (machineId: string, machineName: string, session: SessionInfo) => {
      setSessionsByMachine((prev) => {
        const next = new Map(prev);
        const existingData = next.get(machineId);

        if (existingData) {
          const sessionIndex = existingData.sessions.findIndex((s) => s.name === session.name);
          const updatedSessions = [...existingData.sessions];

          if (sessionIndex >= 0) {
            updatedSessions[sessionIndex] = session;
          } else {
            updatedSessions.push(session);
          }

          next.set(machineId, {
            ...existingData,
            sessions: updatedSessions,
            lastFetch: Date.now(),
          });

          // Check for notifications
          checkForNotifications(machineId, machineName, [session]);
        }

        return next;
      });
    },
    [checkForNotifications]
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
      const wsUrl = buildWebSocketUrl(agentUrl, `/status?v=${encodeURIComponent(appVersion)}`);

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
            const msg: WSStatusMessageFromAgent = JSON.parse(event.data);

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
                // Update prev sessions ref for notification tracking
                prevSessionsRef.current.set(machine.id, [...msg.sessions]);
                break;

              case 'status-update':
                console.log(`[WS] Status update: ${msg.session.name} → ${msg.session.status}`);
                updateSingleSession(machine.id, machine.name, msg.session);
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
    [machines, updateSingleSession, removeSession, archiveSession]
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

    // We now allow polling even if WS is connected as a fallback/safety net
    // The frequency is low (30s) so it won't cause load issues
    // const machinesToPoll = onlineMachines.filter((m) => !wsConnectedRef.current.has(m.id));

    console.log('[Polling] HTTP polling', onlineMachines.length, 'machines');

    const results = await Promise.all(
      onlineMachines.map((machine) => fetchSessionsForMachine(machine))
    );

    setSessionsByMachine((prev) => {
      const next = new Map(prev);
      for (const result of results) {
        next.set(result.machineId, result);

        const machine = machines.find((m) => m.id === result.machineId);
        if (machine && result.sessions.length > 0) {
          checkForNotifications(result.machineId, machine.name, result.sessions);
        }
      }
      return next;
    });
  }, [machines, fetchSessionsForMachine, checkForNotifications]);

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

      checkForNotifications(machineId, machine.name, result.sessions);

      setLoadingMachines((prev) => {
        const next = new Set(prev);
        next.delete(machineId);
        return next;
      });
    },
    [machines, fetchSessionsForMachine, checkForNotifications]
  );

  // Fallback polling interval
  useEffect(() => {
    if (machines.length === 0) return;

    pollAllMachines();
    const interval = setInterval(pollAllMachines, FALLBACK_POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [pollAllMachines, machines.length]);

  // Get all sessions across all machines, flattened with machine context
  // Note: No sorting here - let consuming components handle sorting consistently
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
