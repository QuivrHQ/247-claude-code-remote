'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import {
  loadAgentConnections,
  addAgentConnection,
  removeAgentConnection,
  type StoredAgentConnection,
  type AgentConnection,
} from '@/components/AgentConnectionSettings';
import type { RalphLoopConfig } from '247-shared';
import type { LocalMachine, SelectedSession } from './types';
import { DEFAULT_MACHINE_ID } from './types';

// Helper to convert StoredAgentConnection to LocalMachine
function connectionToMachine(connection: StoredAgentConnection): LocalMachine {
  return {
    id: connection.id,
    name: connection.name,
    status: 'online',
    config: {
      projects: [],
      agentUrl: connection.url,
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

  // Multi-agent support: store array of connections
  const [agentConnections, setAgentConnections] = useState<StoredAgentConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasRestoredFromUrl = useRef(false);
  const allSessions = getAllSessions();

  // Load all agent connections from localStorage
  useEffect(() => {
    const connections = loadAgentConnections();
    setAgentConnections(connections);

    if (connections.length > 0) {
      // Convert all connections to machines and pass to polling context
      const machines = connections.map(connectionToMachine);
      setPollingMachines(machines);
    } else {
      setPollingMachines([]);
    }

    setLoading(false);
  }, [setPollingMachines]);

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
    (
      machineId: string,
      project: string,
      environmentId?: string,
      ralphConfig?: RalphLoopConfig,
      useWorktree?: boolean
    ) => {
      const newSessionName = `${project}--new`;
      setSelectedSession({
        machineId,
        sessionName: newSessionName,
        project,
        environmentId,
        ralphConfig,
        useWorktree,
      });
      setNewSessionOpen(false);

      const params = new URLSearchParams(searchParams.toString());
      params.set('session', newSessionName);
      params.set('machine', machineId);
      params.set('create', 'true');
      if (useWorktree) {
        params.set('worktree', 'true');
      } else {
        params.delete('worktree');
      }
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

  // Add a new connection (does NOT replace existing ones)
  const handleConnectionSaved = useCallback(
    (connection: AgentConnection) => {
      // Add the new connection to storage and state
      const newConnection = addAgentConnection({
        url: connection.url,
        name: connection.name || 'Agent',
        method: connection.method,
      });

      setAgentConnections((prev) => {
        // Check if this connection already exists (by URL)
        const existingIndex = prev.findIndex(
          (c) => c.url.toLowerCase() === connection.url.toLowerCase()
        );

        if (existingIndex >= 0) {
          // Update existing connection
          const updated = [...prev];
          updated[existingIndex] = newConnection;
          return updated;
        } else {
          // Add new connection
          return [...prev, newConnection];
        }
      });

      // Update polling machines with all connections
      setAgentConnections((current) => {
        const machines = current.map(connectionToMachine);
        setPollingMachines(machines);
        return current;
      });
    },
    [setPollingMachines]
  );

  // Remove a specific connection by ID
  const handleConnectionRemoved = useCallback(
    (connectionId: string) => {
      // Remove from localStorage
      removeAgentConnection(connectionId);

      // Update state
      setAgentConnections((prev) => {
        const updated = prev.filter((c) => c.id !== connectionId);
        // Update polling machines
        const machines = updated.map(connectionToMachine);
        setPollingMachines(machines);
        return updated;
      });

      // If selected session was on this machine, clear it
      if (selectedSession?.machineId === connectionId) {
        setSelectedSession(null);
        clearSessionFromUrl();
      }
    },
    [selectedSession, clearSessionFromUrl, setPollingMachines]
  );

  // Legacy: clear all connections (kept for backward compatibility)
  const handleConnectionCleared = useCallback(() => {
    // Clear all connections
    setAgentConnections([]);
    setPollingMachines([]);
    setSelectedSession(null);
    clearSessionFromUrl();
  }, [setPollingMachines, clearSessionFromUrl]);

  const getAgentUrl = useCallback(() => {
    if (!selectedSession) return '';
    const connection = agentConnections.find((c) => c.id === selectedSession.machineId);
    return connection?.url || '';
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

  const needsAttention = allSessions.filter((s) => s.status === 'needs_attention').length;

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
    needsAttention,
    currentMachine, // Legacy: first machine
    machines, // NEW: all machines

    // Data fetchers
    getArchivedSessions,
    getAgentUrl,
    getSelectedSessionInfo,

    // Handlers
    handleSelectSession,
    handleStartSession,
    handleSessionCreated,
    handleSessionKilled,
    handleSessionArchived,
    handleConnectionSaved,
    handleConnectionRemoved, // NEW: remove specific connection
    handleConnectionCleared,
    clearSessionFromUrl,
  };
}
