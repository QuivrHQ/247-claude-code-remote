'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import { useAgentConnection } from '@/hooks/useAgentConnections';
import { stripProtocol } from '@/lib/utils';
import type { SelectedSession } from './types';

export function useHomeState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessions, agentUrl: pollingAgentUrl, setAgentUrl: setPollingAgentUrl } =
    useSessionPolling();

  const { agentUrl, loading: agentLoading, setAgentUrl, clearAgentUrl } = useAgentConnection();

  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasRestoredFromUrl = useRef(false);

  // Sync agent URL to polling context
  useEffect(() => {
    setPollingAgentUrl(agentUrl);
  }, [agentUrl, setPollingAgentUrl]);

  const loading = agentLoading;

  // Restore session from URL on load
  useEffect(() => {
    if (hasRestoredFromUrl.current) return;

    const sessionParam = searchParams.get('session');
    const createParam = searchParams.get('create') === 'true';
    const projectParam = searchParams.get('project');
    const planningProjectIdParam = searchParams.get('planningProjectId');

    // Handle session creation from URL
    if (createParam && sessionParam && projectParam) {
      setSelectedSession({
        sessionName: sessionParam,
        project: projectParam,
        planningProjectId: planningProjectIdParam || undefined,
      });
      hasRestoredFromUrl.current = true;
      return;
    }

    // Handle restoring existing session from URL
    if (sessionParam && sessions.length > 0) {
      const session = sessions.find((s) => s.name === sessionParam);
      if (session) {
        setSelectedSession({
          sessionName: sessionParam,
          project: session.project,
        });
        hasRestoredFromUrl.current = true;
      }
    }
  }, [searchParams, sessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (agentUrl) {
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
  }, [agentUrl, selectedSession, isFullscreen]);

  const clearSessionFromUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('session');
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  const handleSelectSession = useCallback(
    (sessionName: string, project: string) => {
      setSelectedSession({ sessionName, project });

      const params = new URLSearchParams(searchParams.toString());
      params.set('session', sessionName);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  const handleStartSession = useCallback(
    (project: string, environmentId?: string) => {
      const newSessionName = `${project}--new`;
      setSelectedSession({
        sessionName: newSessionName,
        project,
        environmentId,
      });
      setNewSessionOpen(false);

      const params = new URLSearchParams(searchParams.toString());
      params.set('session', newSessionName);
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
    (sessionName: string) => {
      if (selectedSession?.sessionName === sessionName) {
        setSelectedSession(null);
        clearSessionFromUrl();
      }
    },
    [selectedSession, clearSessionFromUrl]
  );

  const handleSessionArchived = useCallback(
    (sessionName: string) => {
      if (selectedSession?.sessionName === sessionName) {
        setSelectedSession(null);
        clearSessionFromUrl();
      }
    },
    [selectedSession, clearSessionFromUrl]
  );

  const handleConnectionSaved = useCallback(
    (url: string) => {
      setAgentUrl(stripProtocol(url));
    },
    [setAgentUrl]
  );

  const handleDisconnect = useCallback(() => {
    clearAgentUrl();
    setSelectedSession(null);
    clearSessionFromUrl();
  }, [clearAgentUrl, clearSessionFromUrl]);

  const getSelectedSessionInfo = useCallback(() => {
    if (!selectedSession) return undefined;
    return sessions.find((s) => s.name === selectedSession.sessionName);
  }, [selectedSession, sessions]);

  return {
    // State
    loading,
    agentUrl,
    connectionModalOpen,
    setConnectionModalOpen,
    newSessionOpen,
    setNewSessionOpen,
    selectedSession,
    setSelectedSession,
    isFullscreen,
    setIsFullscreen,
    sessions,

    // Data fetchers
    getSelectedSessionInfo,

    // Handlers
    handleSelectSession,
    handleStartSession,
    handleSessionCreated,
    handleSessionKilled,
    handleSessionArchived,
    handleConnectionSaved,
    handleDisconnect,
    clearSessionFromUrl,
  };
}
