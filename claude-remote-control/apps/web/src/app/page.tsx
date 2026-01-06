'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { AgentConnectionSettings, loadAgentConnection, saveAgentConnection } from '@/components/AgentConnectionSettings';
import { useSessionPolling, type SessionWithMachine } from '@/contexts/SessionPollingContext';
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

interface SelectedSession {
  machineId: string;
  sessionName: string;
  project: string;
  environmentId?: string;
}

type ViewTab = 'environments' | 'guide';

const DEFAULT_MACHINE_ID = 'local-agent';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setMachines: setPollingMachines, getAllSessions, getArchivedSessions } = useSessionPolling();
  const [agentConnection, setAgentConnection] = useState<ReturnType<typeof loadAgentConnection>>(null);
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
        s => s.name === sessionParam && s.machineId === machineParam
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
        setIsFullscreen(prev => !prev);
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
    (machineId: string, project: string, environmentId?: string) => {
      // Create a new session placeholder name
      const newSessionName = `${project}--new`;
      setSelectedSession({
        machineId,
        sessionName: newSessionName,
        project,
        environmentId,
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
  const handleSessionCreated = useCallback((actualSessionName: string) => {
    if (selectedSession) {
      setSelectedSession(prev => prev ? { ...prev, sessionName: actualSessionName } : null);
      // Update URL with actual session name
      const params = new URLSearchParams(searchParams.toString());
      params.set('session', actualSessionName);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [selectedSession, searchParams, router]);

  // Handle session killed
  const handleSessionKilled = useCallback((machineId: string, sessionName: string) => {
    if (selectedSession?.sessionName === sessionName) {
      setSelectedSession(null);
      clearSessionFromUrl();
    }
  }, [selectedSession, clearSessionFromUrl]);

  // Handle session archived
  const handleSessionArchived = useCallback((machineId: string, sessionName: string) => {
    if (selectedSession?.sessionName === sessionName) {
      setSelectedSession(null);
      clearSessionFromUrl();
    }
  }, [selectedSession, clearSessionFromUrl]);

  // Connection saved handler
  const handleConnectionSaved = useCallback((connection: ReturnType<typeof saveAgentConnection>) => {
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
  }, [setPollingMachines]);

  // Stats
  const needsAttention = allSessions.filter(
    (s) => s.status === 'needs_attention'
  ).length;

  // Get agent URL for selected session
  const getAgentUrl = useCallback(() => {
    if (!selectedSession || !agentConnection) return '';
    return agentConnection.url;
  }, [selectedSession, agentConnection]);

  // Get session info for selected session
  const getSelectedSessionInfo = useCallback(() => {
    if (!selectedSession) return undefined;
    return allSessions.find(
      s => s.name === selectedSession.sessionName && s.machineId === selectedSession.machineId
    );
  }, [selectedSession, allSessions]);

  // Derived machine for display
  const currentMachine: LocalMachine | null = agentConnection ? {
    id: DEFAULT_MACHINE_ID,
    name: agentConnection.name || 'Local Agent',
    status: 'online',
    config: {
      projects: [],
      agentUrl: agentConnection.url,
    },
  } : null;

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a10] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          <p className="text-white/30 text-sm font-medium">Loading...</p>
        </div>
      </main>
    );
  }

  // No connection state
  if (!agentConnection) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center relative bg-[#0a0a10] selection:bg-orange-500/20">
        {/* Ambient Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-orange-500/10 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full mix-blend-screen" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center text-center max-w-lg px-6"
        >
          <div className="mb-8 relative group cursor-pointer" onClick={() => setConnectionModalOpen(true)}>
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#1c1c24] to-[#121218] border border-white/10 flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-500">
              <Zap className="w-10 h-10 text-orange-500 group-hover:text-amber-400 transition-colors duration-500" />
            </div>

            {/* Status dot */}
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#0a0a10] flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-white/10 border border-white/10 group-hover:bg-orange-500 group-hover:border-orange-400 transition-colors" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Connect Agent
          </h1>
          <p className="text-lg text-white/40 mb-10 leading-relaxed">
            Remote control for your local Claude Code agent.<br />
            Monitor sessions, edit files, and approve commands.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setConnectionModalOpen(true)}
              className={cn(
                'group w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-semibold transition-all',
                'bg-gradient-to-r from-orange-500 to-amber-500 text-white',
                'hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.4)] hover:scale-[1.02]',
                'active:scale-[0.98]'
              )}
            >
              <Wifi className="w-5 h-5" />
              <span>Connect Now</span>
              <div className="w-px h-4 bg-white/20 mx-1" />
              <span className="opacity-60 text-xs uppercase tracking-wider">Local</span>
            </button>

            <a
              href="https://docs.anthropic.com/en/docs/agents-and-tools/python-sdk" // TODO: Update to real docs link
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-medium transition-all',
                'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/10'
              )}
            >
              <HelpCircle className="w-5 h-5" />
              <span>Guide</span>
            </a>
          </div>

          <p className="mt-8 text-xs text-white/20 font-mono">
            v0.1.0 • waiting for connection
          </p>
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
    <main className="h-screen flex flex-col bg-[#0a0a10] overflow-hidden">
      {/* Compact Header */}
      <header className={cn(
        'flex-none z-40 bg-[#0a0a10]/80 backdrop-blur-xl border-b border-white/5',
        isFullscreen && selectedSession && 'hidden'
      )}>
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">Claude Remote</h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] text-white/40 font-mono">{agentConnection.url}</p>
                </div>
              </div>
            </div>

            {/* Global Stats */}
            <div className="hidden md:flex items-center gap-6 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
              <div className="flex items-center gap-2 text-xs">
                <Monitor className="w-3.5 h-3.5 text-white/30" />
                <span className="text-white/60">Local Agent</span>
                <span className="text-emerald-400 font-medium text-[10px] px-1.5 py-0.5 bg-emerald-500/10 rounded-full">Online</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-2 text-xs">
                <Activity className="w-3.5 h-3.5 text-white/30" />
                <span className="text-white/80 font-medium">{allSessions.length}</span>
                <span className="text-white/30">active sessions</span>
              </div>
              {needsAttention > 0 && (
                <>
                  <div className="w-px h-3 bg-white/10" />
                  <div className="flex items-center gap-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-orange-400 font-medium">{needsAttention} action{needsAttention !== 1 ? 's' : ''} needed</span>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConnectionModalOpen(true)}
                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                title="Connection settings"
              >
                <Wifi className="w-4 h-4" />
              </button>

              {selectedSession && (
                <button
                  onClick={() => setIsFullscreen(prev => !prev)}
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  title={isFullscreen ? 'Exit fullscreen (⌘F)' : 'Fullscreen (⌘F)'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              )}

              <div className="w-px h-4 bg-white/10 mx-1" />

              <button
                onClick={() => setNewSessionOpen(true)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all',
                  'bg-white text-black hover:bg-white/90',
                  'shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] active:scale-[0.98]'
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Session</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden">
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
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {selectedSession ? (
            <SessionView
              sessionName={selectedSession.sessionName}
              project={selectedSession.project}
              agentUrl={getAgentUrl()}
              sessionInfo={getSelectedSessionInfo()}
              environmentId={selectedSession.environmentId}
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
                const session = allSessions.find(s => s.machineId === machineId && s.name === sessionName);
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
