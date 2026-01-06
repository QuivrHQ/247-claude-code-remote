'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadAgentConnection, type AgentConnection } from '@/components/AgentConnectionSettings';
import { type SessionInfo } from '@/lib/notifications';

const DEFAULT_MACHINE_NAME = 'Local Agent';

interface SessionContextValue {
  // Data
  agentConnection: AgentConnection | null;
  projects: string[];
  sessions: SessionInfo[];
  loading: boolean;
  error: string | null;

  // Derived
  machineId: string;
  sessionName: string;
  currentProject: string;
  currentSessionInfo: SessionInfo | undefined;
  agentUrl: string;
  machineName: string;

  // Actions
  handleSelectSession: (sessionName: string | null, project: string) => void;
  handleNewSessionClick: () => void;
  handleSessionKilled: () => void;
  handleSessionCreated: (actualSessionName: string) => void;

  // Modal state
  showNewSessionModal: boolean;
  setShowNewSessionModal: (show: boolean) => void;
  handleNewSession: (machineId: string, project: string, envId?: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const params = useParams();
  const router = useRouter();
  const machineId = params.machineId as string;
  const sessionName = decodeURIComponent(params.sessionName as string);

  // Extract project from session name (format: project--adjective-noun-number)
  const projectFromSession = sessionName.split('--')[0];

  const [agentConnection, setAgentConnection] = useState<AgentConnection | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);

  const agentUrl = agentConnection?.url || 'localhost:4678';
  const machineName = agentConnection?.name || DEFAULT_MACHINE_NAME;

  // Current session info
  const currentSessionInfo = useMemo(() => {
    return sessions.find((s) => s.name === sessionName);
  }, [sessions, sessionName]);

  const currentProject = currentSessionInfo?.project || projectFromSession;

  // Load agent connection from localStorage
  useEffect(() => {
    const connection = loadAgentConnection();
    if (!connection) {
      setError('No agent connection found. Please connect your agent first.');
      setLoading(false);
      return;
    }
    setAgentConnection(connection);
    setLoading(false);
  }, []);

  // Fetch projects and sessions from agent
  useEffect(() => {
    if (!agentConnection) return;

    const url = agentConnection.url;
    const protocol = url.includes('localhost') ? 'http' : 'https';

    const fetchData = async () => {
      try {
        const [projectsRes, sessionsRes] = await Promise.all([
          fetch(`${protocol}://${url}/api/projects`),
          fetch(`${protocol}://${url}/api/sessions`),
        ]);

        if (projectsRes.ok) {
          const p: string[] = await projectsRes.json();
          setProjects(p);
        }

        if (sessionsRes.ok) {
          const s: SessionInfo[] = await sessionsRes.json();
          setSessions(s);
        }
      } catch (e) {
        console.error('Failed to fetch data:', e);
      }
    };

    fetchData();

    // Poll for sessions every 3s
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [agentConnection]);

  // Navigate to a different session
  const handleSelectSession = useCallback(
    (newSessionName: string | null, project: string) => {
      if (newSessionName) {
        router.push(`/s/${machineId}/${encodeURIComponent(newSessionName)}`);
      }
    },
    [machineId, router]
  );

  // Handle new session button click - open modal
  const handleNewSessionClick = useCallback(() => {
    setShowNewSessionModal(true);
  }, []);

  // Handle new session creation from modal
  const handleNewSession = useCallback(
    (targetMachineId: string, project: string, envId?: string) => {
      setShowNewSessionModal(false);
      let url = `/s/${targetMachineId}/${encodeURIComponent(`${project}--new`)}`;
      if (envId) {
        url += `?env=${encodeURIComponent(envId)}`;
      }
      router.push(url);
    },
    [router]
  );

  // Handle session killed
  const handleSessionKilled = useCallback(() => {
    router.push('/');
  }, [router]);

  // Handle session created - update URL with actual session name
  const handleSessionCreated = useCallback(
    (actualSessionName: string) => {
      if (actualSessionName && actualSessionName !== sessionName) {
        router.replace(`/s/${machineId}/${encodeURIComponent(actualSessionName)}`);
      }
    },
    [machineId, sessionName, router]
  );

  const value: SessionContextValue = {
    agentConnection,
    projects,
    sessions,
    loading,
    error,
    machineId,
    sessionName,
    currentProject,
    currentSessionInfo,
    agentUrl,
    machineName,
    handleSelectSession,
    handleNewSessionClick,
    handleSessionKilled,
    handleSessionCreated,
    showNewSessionModal,
    setShowNewSessionModal,
    handleNewSession,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
