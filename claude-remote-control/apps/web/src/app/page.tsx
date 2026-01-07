'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Monitor,
  Plus,
  Zap,
  Activity,
  AlertCircle,
  Wifi,
  HelpCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { HomeSidebar } from '@/components/HomeSidebar';
import { DashboardContent } from '@/components/DashboardContent';
import { SessionView } from '@/components/SessionView';
import { NewSessionModal } from '@/components/NewSessionModal';
import {
  AgentConnectionSettings,
  loadAgentConnection,
  saveAgentConnection,
} from '@/components/AgentConnectionSettings';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import { cn } from '@/lib/utils';

// Local "machine" derived from localStorage connection
interface LocalMachine {
  id: string;
  name: string;
  status: 'online' | 'offline';
  config?: {
    projects: string[];
    agentUrl: string;
  };
}

import type { RalphLoopConfig } from '@vibecompany/247-shared';

interface SelectedSession {
  machineId: string;
  sessionName: string;
  project: string;
  environmentId?: string;
  ralphConfig?: RalphLoopConfig;
}

type ViewTab = 'environments' | 'guide';

const DEFAULT_MACHINE_ID = 'local-agent';

function HomeContent() {
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
  const [activeTab, setActiveTab] = useState<ViewTab | null>(null);

  // Selected session for split view
  const [selectedSession, setSelectedSession] = useState<SelectedSession | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track if we've already restored from URL to avoid loops
  const hasRestoredFromUrl = useRef(false);

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
      // We only support one local machine for now
      setPollingMachines([machine]);
    } else {
      setPollingMachines([]);
    }

    setLoading(false);
  }, [setPollingMachines]);

  // Restore session from URL on load
  const allSessions = getAllSessions();
  useEffect(() => {
    if (hasRestoredFromUrl.current) return;

    const sessionParam = searchParams.get('session');
    const machineParam = searchParams.get('machine') || DEFAULT_MACHINE_ID;

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
      // ⌘K to open new session modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (agentConnection) {
          setNewSessionOpen(true);
        } else {
          setConnectionModalOpen(true);
        }
      }

      // Escape to deselect session (when not in fullscreen)
      if (e.key === 'Escape' && selectedSession && !isFullscreen) {
        e.preventDefault();
        setSelectedSession(null);
        // Clear URL params
        const params = new URLSearchParams(window.location.search);
        params.delete('session');
        params.delete('machine');
        const newUrl = params.toString() ? `?${params.toString()}` : '/';
        window.history.replaceState({}, '', newUrl);
      }

      // ⌘F to toggle fullscreen when session is selected
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && selectedSession) {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agentConnection, selectedSession, isFullscreen]);

  // Helper to clear session from URL
  const clearSessionFromUrl = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('session');
    params.delete('machine');
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [searchParams, router]);

  // Select session handler
  const handleSelectSession = useCallback(
    (machineId: string, sessionName: string, project: string) => {
      setSelectedSession({ machineId, sessionName, project });

      // Sync to URL
      const params = new URLSearchParams(searchParams.toString());
      params.set('session', sessionName);
      params.set('machine', machineId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Start new session
  const handleStartSession = useCallback(
    (machineId: string, project: string, environmentId?: string, ralphConfig?: RalphLoopConfig) => {
      // Create a new session placeholder name
      const newSessionName = `${project}--new`;
      setSelectedSession({
        machineId,
        sessionName: newSessionName,
        project,
        environmentId,
        ralphConfig,
      });
      setNewSessionOpen(false);

      // Sync to URL (will be updated to actual name by handleSessionCreated)
      const params = new URLSearchParams(searchParams.toString());
      params.set('session', newSessionName);
      params.set('machine', machineId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Handle session created (update name from --new to actual)
  const handleSessionCreated = useCallback(
    (actualSessionName: string) => {
      if (selectedSession) {
        setSelectedSession((prev) => (prev ? { ...prev, sessionName: actualSessionName } : null));
        // Update URL with actual session name
        const params = new URLSearchParams(searchParams.toString());
        params.set('session', actualSessionName);
        router.replace(`?${params.toString()}`, { scroll: false });
      }
    },
    [selectedSession, searchParams, router]
  );

  // Handle session killed
  const handleSessionKilled = useCallback(
    (machineId: string, sessionName: string) => {
      if (selectedSession?.sessionName === sessionName) {
        setSelectedSession(null);
        clearSessionFromUrl();
      }
    },
    [selectedSession, clearSessionFromUrl]
  );

  // Handle session archived
  const handleSessionArchived = useCallback(
    (machineId: string, sessionName: string) => {
      if (selectedSession?.sessionName === sessionName) {
        setSelectedSession(null);
        clearSessionFromUrl();
      }
    },
    [selectedSession, clearSessionFromUrl]
  );

  // Connection saved handler
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

  // Stats
  const needsAttention = allSessions.filter((s) => s.status === 'needs_attention').length;

  // Get agent URL for selected session
  const getAgentUrl = useCallback(() => {
    if (!selectedSession || !agentConnection) return '';
    return agentConnection.url;
  }, [selectedSession, agentConnection]);

  // Get session info for selected session
  const getSelectedSessionInfo = useCallback(() => {
    if (!selectedSession) return undefined;
    return allSessions.find(
      (s) => s.name === selectedSession.sessionName && s.machineId === selectedSession.machineId
    );
  }, [selectedSession, allSessions]);

  // Derived machine for display
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

  // Loading state
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a10]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500" />
          <p className="text-sm font-medium text-white/30">Loading...</p>
        </div>
      </main>
    );
  }

  // No connection state
  if (!agentConnection) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#0a0a10] selection:bg-orange-500/20">
        {/* Ambient Background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-orange-500/10 mix-blend-screen blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-blue-500/10 mix-blend-screen blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex max-w-lg flex-col items-center px-6 text-center"
        >
          <div
            className="group relative mb-8 cursor-pointer"
            onClick={() => setConnectionModalOpen(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-[#1c1c24] to-[#121218] shadow-2xl transition-transform duration-500 group-hover:scale-105">
              <Zap className="h-10 w-10 text-orange-500 transition-colors duration-500 group-hover:text-amber-400" />
            </div>

            {/* Status dot */}
            <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#0a0a10]">
              <div className="h-4 w-4 rounded-full border border-white/10 bg-white/10 transition-colors group-hover:border-orange-400 group-hover:bg-orange-500" />
            </div>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">Connect Agent</h1>
          <p className="mb-10 text-lg leading-relaxed text-white/40">
            Remote control for your local Claude Code agent.
            <br />
            Monitor sessions, edit files, and approve commands.
          </p>

          <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
            <button
              onClick={() => setConnectionModalOpen(true)}
              className={cn(
                'group inline-flex w-full items-center justify-center gap-3 rounded-2xl px-8 py-4 font-semibold transition-all sm:w-auto',
                'bg-gradient-to-r from-orange-500 to-amber-500 text-white',
                'hover:scale-[1.02] hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.4)]',
                'active:scale-[0.98]'
              )}
            >
              <Wifi className="h-5 w-5" />
              <span>Connect Now</span>
              <div className="mx-1 h-4 w-px bg-white/20" />
              <span className="text-xs uppercase tracking-wider opacity-60">Local</span>
            </button>

            <a
              href="https://docs.anthropic.com/en/docs/agents-and-tools/python-sdk" // TODO: Update to real docs link
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 font-medium transition-all sm:w-auto',
                'border border-white/5 bg-white/5 text-white/60 hover:border-white/10 hover:bg-white/10 hover:text-white'
              )}
            >
              <HelpCircle className="h-5 w-5" />
              <span>Guide</span>
            </a>
          </div>

          <p className="mt-8 font-mono text-xs text-white/20">v0.1.0 • waiting for connection</p>
        </motion.div>

        <AgentConnectionSettings
          open={connectionModalOpen}
          onOpenChange={setConnectionModalOpen}
          onSave={handleConnectionSaved}
        />
      </main>
    );
  }

  // Connected state - Split View Layout
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#0a0a10]">
      {/* Compact Header */}
      <header
        className={cn(
          'z-40 flex-none border-b border-white/5 bg-[#0a0a10]/80 backdrop-blur-xl',
          isFullscreen && selectedSession && 'hidden'
        )}
      >
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-500/20 bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                <Zap className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">247</h1>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <p className="font-mono text-[10px] text-white/40">{agentConnection.url}</p>
                </div>
              </div>
            </div>

            {/* Global Stats */}
            <div className="hidden items-center gap-6 rounded-full border border-white/5 bg-white/5 px-4 py-1.5 md:flex">
              <div className="flex items-center gap-2 text-xs">
                <Monitor className="h-3.5 w-3.5 text-white/30" />
                <span className="text-white/60">Local Agent</span>
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  Online
                </span>
              </div>
              <div className="h-3 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-xs">
                <Activity className="h-3.5 w-3.5 text-white/30" />
                <span className="font-medium text-white/80">{allSessions.length}</span>
                <span className="text-white/30">active sessions</span>
              </div>
              {needsAttention > 0 && (
                <>
                  <div className="h-3 w-px bg-white/10" />
                  <div className="flex items-center gap-2 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
                    <span className="font-medium text-orange-400">
                      {needsAttention} action{needsAttention !== 1 ? 's' : ''} needed
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConnectionModalOpen(true)}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                title="Connection settings"
              >
                <Wifi className="h-4 w-4" />
              </button>

              {selectedSession && (
                <button
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                  title={isFullscreen ? 'Exit fullscreen (⌘F)' : 'Fullscreen (⌘F)'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              )}

              <div className="mx-1 h-4 w-px bg-white/10" />

              <button
                onClick={() => setNewSessionOpen(true)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                  'bg-white text-black hover:bg-white/90',
                  'shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] active:scale-[0.98]'
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Session</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!isFullscreen && (
          <HomeSidebar
            sessions={allSessions}
            archivedSessions={getArchivedSessions()}
            selectedSession={selectedSession}
            onSelectSession={handleSelectSession}
            onNewSession={() => setNewSessionOpen(true)}
            onSessionKilled={handleSessionKilled}
            onSessionArchived={handleSessionArchived}
          />
        )}

        {/* Main Content Area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {selectedSession ? (
            <SessionView
              sessionName={selectedSession.sessionName}
              project={selectedSession.project}
              agentUrl={getAgentUrl()}
              sessionInfo={getSelectedSessionInfo()}
              environmentId={selectedSession.environmentId}
              ralphConfig={selectedSession.ralphConfig}
              onBack={() => {
                setSelectedSession(null);
                clearSessionFromUrl();
              }}
              onSessionCreated={handleSessionCreated}
            />
          ) : (
            <DashboardContent
              machines={currentMachine ? [currentMachine] : []}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onSelectSession={(machineId, sessionName) => {
                const session = allSessions.find(
                  (s) => s.machineId === machineId && s.name === sessionName
                );
                if (session) {
                  handleSelectSession(machineId, sessionName, session.project);
                }
              }}
              onNewSession={() => setNewSessionOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Connection Settings Modal */}
      <AgentConnectionSettings
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
        onSave={handleConnectionSaved}
      />

      {/* New Session Modal */}
      <NewSessionModal
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        machines={currentMachine ? [currentMachine] : []}
        onStartSession={handleStartSession}
      />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0a0a10]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500" />
            <p className="text-sm font-medium text-white/30">Loading...</p>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
