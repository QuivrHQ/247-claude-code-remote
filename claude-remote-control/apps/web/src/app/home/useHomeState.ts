'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import { loadAgentConnection, saveAgentConnection } from '@/components/AgentConnectionSettings';
import type { RalphLoopConfig } from '247-shared';
import type { LocalMachine, SelectedSession } from './types';
import { DEFAULT_MACHINE_ID } from './types';

export function useHomeState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    setMachines: setPollingMachines,
    getAllSessions,
    getArchivedSessions,
  } = useSessionPolling();

  const [agentConnection, setAgentConnection] =
    useState<ReturnType<typeof loadAgentConnection>>(null);
  const [loading, setLoading] = useState(true);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasRestoredFromUrl = useRef(false);
  const allSessions = getAllSessions();

  // Load agent connection from localStorage
  useEffect(() => {
    const connection = loadAgentConnection();
    setAgentConnection(connection);

    if (connection) {
      const machine: LocalMachine = {
        id: DEFAULT_MACHINE_ID,
        name: connection.name || 'Local Agent',
        status: 'online',
        config: {
          projects: [],
          agentUrl: connection.url,
        },
      };
      setPollingMachines([machine]);
    } else {
      setPollingMachines([]);
    }

    setLoading(false);
  }, [setPollingMachines]);

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

  const handleConnectionSaved = useCallback(
    (connection: ReturnType<typeof saveAgentConnection>) => {
      setAgentConnection(connection);
      const machine: LocalMachine = {
        id: DEFAULT_MACHINE_ID,
        name: connection.name || 'Local Agent',
        status: 'online',
        config: {
          projects: [],
          agentUrl: connection.url,
        },
      };
      setPollingMachines([machine]);
    },
    [setPollingMachines]
  );

  const handleConnectionCleared = useCallback(() => {
    setAgentConnection(null);
    setPollingMachines([]);
    setSelectedSession(null);
    clearSessionFromUrl();
  }, [setPollingMachines, clearSessionFromUrl]);

  const getAgentUrl = useCallback(() => {
    if (!selectedSession || !agentConnection) return '';
    return agentConnection.url;
  }, [selectedSession, agentConnection]);

  const getSelectedSessionInfo = useCallback(() => {
    if (!selectedSession) return undefined;
    return allSessions.find(
      (s) => s.name === selectedSession.sessionName && s.machineId === selectedSession.machineId
    );
  }, [selectedSession, allSessions]);

  const currentMachine: LocalMachine | null = agentConnection
    ? {
        id: DEFAULT_MACHINE_ID,
        name: agentConnection.name || 'Local Agent',
        status: 'online',
        config: {
          projects: [],
          agentUrl: agentConnection.url,
        },
      }
    : null;

  const needsAttention = allSessions.filter((s) => s.status === 'needs_attention').length;

  return {
    // State
    loading,
    agentConnection,
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
    currentMachine,

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
    handleConnectionCleared,
    clearSessionFromUrl,
  };
}
