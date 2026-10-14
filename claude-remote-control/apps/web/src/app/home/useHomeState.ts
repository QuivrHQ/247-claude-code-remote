'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import {
  useAgentConnections,
  type AgentConnection as DbAgentConnection,
} from '@/hooks/useAgentConnections';
import type { LocalMachine, SelectedSession } from './types';
import { DEFAULT_MACHINE_ID } from './types';

// Legacy type for backward compatibility with AgentConnectionSettings component
export interface AgentConnection {
  url: string;
  name?: string;
  method: 'localhost' | 'tailscale' | 'custom' | 'cloud';
  isCloud?: boolean;
  cloudAgentId?: string;
  authToken?: string;
}

// Type for stored connections (from API)
export type StoredAgentConnection = DbAgentConnection;

// Helper to convert StoredAgentConnection to LocalMachine
function connectionToMachine(connection: StoredAgentConnection): LocalMachine {
  return {
    id: connection.id,
    name: connection.name,
    status: 'online',
    color: connection.color,
    config: {
      projects: [],
      agentUrl: connection.url,
      authToken: connection.authToken,
    },
  };
}

export function useHomeState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    setMachines: setPollingMachines,
    getAllSessions,
    getArchivedSessions,
  } = useSessionPolling();

  // Use the API-based hook for agent connections
  const {
    connections: agentConnections,
    loading: connectionsLoading,
    addConnection,
    removeConnection,
    updateConnection,
  } = useAgentConnections();

  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasRestoredFromUrl = useRef(false);
  const allSessions = getAllSessions();

  // Sync connections to polling context when they change
  useEffect(() => {
    if (agentConnections.length > 0) {
      const machines = agentConnections.map(connectionToMachine);
      setPollingMachines(machines);
    } else {
      setPollingMachines([]);
    }
  }, [agentConnections, setPollingMachines]);

  // Loading state
  const loading = connectionsLoading;

  // Legacy compatibility: get first connection as "agentConnection"
  const agentConnection = useMemo(() => {
    if (agentConnections.length === 0) return null;
    const first = agentConnections[0];
    return {
      url: first.url,
      name: first.name,
      method: first.method,
      isCloud: first.isCloud,
      cloudAgentId: first.cloudAgentId,
    };
  }, [agentConnections]);

  // Restore session from URL on load OR create new session from URL params
  useEffect(() => {
    if (hasRestoredFromUrl.current) return;

    const sessionParam = searchParams.get('session');
    const machineParam = searchParams.get('machine') || DEFAULT_MACHINE_ID;
    const createParam = searchParams.get('create') === 'true';
    const projectParam = searchParams.get('project');
    const planningProjectIdParam = searchParams.get('planningProjectId');

    // Handle session creation from URL (e.g., from planning modal)
    if (createParam && sessionParam && projectParam) {
      setSelectedSession({
        machineId: machineParam,
        sessionName: sessionParam,
        project: projectParam,
        planningProjectId: planningProjectIdParam || undefined,
      });
      hasRestoredFromUrl.current = true;
      return;
    }

    // Handle restoring existing session from URL
    if (sessionParam && allSessions.length > 0) {
      const session = allSessions.find(
        (s) => s.name === sessionParam && s.machineId === machineParam
      );
      if (session) {
        setSelectedSession({
          machineId: machineParam,
          sessionName: sessionParam,
          project: session.project,
        });
        hasRestoredFromUrl.current = true;
      }
    }
  }, [searchParams, allSessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (agentConnection) {
          setNewSessionOpen(true);
        } else {
          setConnectionModalOpen(true);
        }
      }

      if (e.key === 'Escape' && selectedSession && !isFullscreen) {
        e.preventDefault();
        setSelectedSession(null);
        const params = new URLSearchParams(window.location.search);
        params.delete('session');
        params.delete('machine');
        const newUrl = params.toString() ? `?${params.toString()}` : '/';
        window.history.replaceState({}, '', newUrl);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && selectedSession) {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agentConnection, selectedSession, isFullscreen]);

  const clearSessionFromUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('session');
    params.delete('machine');
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  const handleSelectSession = useCallback(
    (machineId: string, sessionName: string, project: string) => {
      setSelectedSession({ machineId, sessionName, project });

      const params = new URLSearchParams(searchParams.toString());
      params.set('session', sessionName);
      params.set('machine', machineId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  const handleStartSession = useCallback(
    (machineId: string, project: string, environmentId?: string) => {
      const newSessionName = `${project}--new`;
      setSelectedSession({
        machineId,
        sessionName: newSessionName,
        project,
        environmentId,
      });
      setNewSessionOpen(false);

      const params = new URLSearchParams(searchParams.toString());
      params.set('session', newSessionName);
      params.set('machine', machineId);
      params.set('create', 'true');
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  const handleSessionCreated = useCallback(
    (actualSessionName: string) => {
      if (selectedSession) {
        setSelectedSession((prev) => (prev ? { ...prev, sessionName: actualSessionName } : null));
        const params = new URLSearchParams(searchParams.toString());
        params.set('session', actualSessionName);
        params.delete('create');
        router.replace(`?${params.toString()}`, { scroll: false });
      }
    },
    [selectedSession, searchParams, router]
  );

  const handleSessionKilled = useCallback(
    (machineId: string, sessionName: string) => {
      if (selectedSession?.sessionName === sessionName) {
        setSelectedSession(null);
        clearSessionFromUrl();
      }
    },
    [selectedSession, clearSessionFromUrl]
  );

  const handleSessionArchived = useCallback(
    (machineId: string, sessionName: string) => {
      if (selectedSession?.sessionName === sessionName) {
        setSelectedSession(null);
        clearSessionFromUrl();
      }
    },
    [selectedSession, clearSessionFromUrl]
  );

  // Add a new connection (uses API)
  const handleConnectionSaved = useCallback(
    async (connection: AgentConnection) => {
      try {
        await addConnection({
          url: connection.url,
          name: connection.name || 'Agent',
          method: connection.method,
          authToken: connection.authToken,
        });
        // The hook automatically updates the connections state
      } catch (error) {
        console.error('Failed to save connection:', error);
      }
    },
    [addConnection]
  );

  // Remove a specific connection by ID (uses API)
  const handleConnectionRemoved = useCallback(
    async (connectionId: string) => {
      try {
        await removeConnection(connectionId);

        // If selected session was on this machine, clear it
        if (selectedSession?.machineId === connectionId) {
          setSelectedSession(null);
          clearSessionFromUrl();
        }
      } catch (error) {
        console.error('Failed to remove connection:', error);
      }
    },
    [selectedSession, clearSessionFromUrl, removeConnection]
  );

  // Legacy: clear all connections (kept for backward compatibility)
  const handleConnectionCleared = useCallback(async () => {
    // Remove all connections one by one
    for (const conn of agentConnections) {
      try {
        await removeConnection(conn.id);
      } catch (error) {
        console.error('Failed to remove connection:', error);
      }
    }
    setSelectedSession(null);
    clearSessionFromUrl();
  }, [agentConnections, removeConnection, clearSessionFromUrl]);

  // Edit an existing connection (name, color, etc.)
  const handleConnectionEdited = useCallback(
    async (connectionId: string, data: { name?: string; color?: string }) => {
      try {
        await updateConnection(connectionId, data);
      } catch (error) {
        console.error('Failed to update connection:', error);
        throw error;
      }
    },
    [updateConnection]
  );

  const getAgentUrl = useCallback(() => {
    if (!selectedSession) return '';
    const connection = agentConnections.find((c) => c.id === selectedSession.machineId);
    return connection?.url || '';
  }, [selectedSession, agentConnections]);

  const getAuthToken = useCallback(() => {
    if (!selectedSession) return undefined;
    const connection = agentConnections.find((c) => c.id === selectedSession.machineId);
    return connection?.authToken;
  }, [selectedSession, agentConnections]);

  const getSelectedSessionInfo = useCallback(() => {
    if (!selectedSession) return undefined;
    return allSessions.find(
      (s) => s.name === selectedSession.sessionName && s.machineId === selectedSession.machineId
    );
  }, [selectedSession, allSessions]);

  // All machines from all connections
  const machines: LocalMachine[] = agentConnections.map(connectionToMachine);

  // Legacy: currentMachine is the first machine (for backward compatibility)
  const currentMachine: LocalMachine | null = machines.length > 0 ? machines[0] : null;

  return {
    // State
    loading,
    agentConnection, // Legacy: first connection
    agentConnections, // NEW: all connections
    connectionModalOpen,
    setConnectionModalOpen,
    newSessionOpen,
    setNewSessionOpen,
    selectedSession,
    setSelectedSession,
    isFullscreen,
    setIsFullscreen,
    allSessions,
    currentMachine, // Legacy: first machine
    machines, // NEW: all machines

    // Data fetchers
    getArchivedSessions,
    getAgentUrl,
    getAuthToken,
    getSelectedSessionInfo,

    // Handlers
    handleSelectSession,
    handleStartSession,
    handleSessionCreated,
    handleSessionKilled,
    handleSessionArchived,
    handleConnectionSaved,
    handleConnectionRemoved, // NEW: remove specific connection
    handleConnectionEdited, // NEW: edit connection (name, color)
    handleConnectionCleared,
    clearSessionFromUrl,
  };
}
