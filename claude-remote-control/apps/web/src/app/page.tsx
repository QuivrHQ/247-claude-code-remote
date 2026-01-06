'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Plus,
  Zap,
  Activity,
  AlertCircle,
  LayoutGrid,
  List,
  Settings,
  Wifi,
  HelpCircle,
} from 'lucide-react';
import { SessionListView } from '@/components/SessionListView';
import { NewSessionModal } from '@/components/NewSessionModal';
import { EnvironmentsList } from '@/components/EnvironmentsList';
import { AgentConnectionSettings, loadAgentConnection, saveAgentConnection } from '@/components/AgentConnectionSettings';
import { ConnectionGuide } from '@/components/ConnectionGuide';
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

type ViewTab = 'sessions' | 'environments' | 'guide';

const DEFAULT_MACHINE_ID = 'local-agent';

export default function Home() {
  const router = useRouter();
  const { setMachines: setPollingMachines, sessionsByMachine, getAllSessions } = useSessionPolling();
  const [agentConnection, setAgentConnection] = useState<ReturnType<typeof loadAgentConnection>>(null);
  const [machines, setMachines] = useState<LocalMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('sessions');

  // Load agent connection from localStorage
  useEffect(() => {
    const connection = loadAgentConnection();
    setAgentConnection(connection);

    if (connection) {
      // Create a "machine" from the connection
      const machine: LocalMachine = {
        id: DEFAULT_MACHINE_ID,
        name: connection.name || 'Local Agent',
        status: 'online', // Assume online - will be verified on connection
        config: {
          projects: [],
          agentUrl: connection.url,
        },
      };
      setMachines([machine]);
      setPollingMachines([machine]);
    }

    setLoading(false);
  }, [setPollingMachines]);

  // Keyboard shortcut: ⌘K to open new session modal
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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agentConnection]);

  // Navigate to session
  const handleSelectSession = useCallback(
    (machineId: string, sessionName: string) => {
      router.push(`/s/${machineId}/${encodeURIComponent(sessionName)}`);
    },
    [router]
  );

  // Start new session
  const handleStartSession = useCallback(
    (machineId: string, project: string, environmentId?: string) => {
      let url = `/s/${machineId}/${encodeURIComponent(`${project}--new`)}`;
      if (environmentId) {
        url += `?env=${encodeURIComponent(environmentId)}`;
      }
      router.push(url);
    },
    [router]
  );

  // Machine click
  const handleMachineClick = useCallback(
    (machineId: string) => {
      const machineSessions = sessionsByMachine.get(machineId)?.sessions || [];
      if (machineSessions.length > 0) {
        handleSelectSession(machineId, machineSessions[0].name);
      } else {
        setNewSessionOpen(true);
      }
    },
    [sessionsByMachine, handleSelectSession]
  );

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
    setMachines([machine]);
    setPollingMachines([machine]);
  }, [setPollingMachines]);

  const [newSessionOpen, setNewSessionOpen] = useState(false);

  // Stats
  const onlineMachines = machines.filter((m) => m.status === 'online');
  const allSessions = getAllSessions();
  const needsAttention = allSessions.filter(
    (s) => s.status === 'waiting' || s.status === 'permission'
  ).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0a10] via-[#0d0d14] to-[#0a0a10]">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a10]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Claude Remote Control</h1>
                <p className="text-sm text-white/40">
                  {agentConnection ? `Connected to ${agentConnection.url}` : 'Not connected'}
                </p>
              </div>
            </div>

            {/* Global Stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="w-4 h-4 text-white/40" />
                <span className="text-emerald-400 font-medium">{onlineMachines.length}</span>
                <span className="text-white/30">agent{onlineMachines.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-white/40" />
                <span className="text-white/70 font-medium">{allSessions.length}</span>
                <span className="text-white/30">sessions</span>
              </div>
              {needsAttention > 0 && (
                <>
                  <div className="w-px h-4 bg-white/10" />
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    <span className="text-orange-400 font-medium">{needsAttention}</span>
                    <span className="text-white/30">need attention</span>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConnectionModalOpen(true)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  agentConnection
                    ? 'text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-orange-400/60 hover:text-orange-400 hover:bg-orange-500/10'
                )}
                title={agentConnection ? 'Change connection' : 'Connect agent'}
              >
                <Wifi className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  if (agentConnection) {
                    setNewSessionOpen(true);
                  } else {
                    setConnectionModalOpen(true);
                  }
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
                  agentConnection
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 active:scale-[0.98]'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 active:scale-[0.98]'
                )}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {agentConnection ? 'New Session' : 'Connect Agent'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      {agentConnection && (
        <div className="border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('sessions')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px',
                  activeTab === 'sessions'
                    ? 'text-orange-400 border-orange-400'
                    : 'text-white/50 border-transparent hover:text-white/70'
                )}
              >
                <List className="w-4 h-4" />
                Sessions
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs',
                    activeTab === 'sessions' ? 'bg-orange-500/20' : 'bg-white/10'
                  )}
                >
                  {allSessions.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('environments')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px',
                  activeTab === 'environments'
                    ? 'text-orange-400 border-orange-400'
                    : 'text-white/50 border-transparent hover:text-white/70'
                )}
              >
                <Settings className="w-4 h-4" />
                Environments
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px',
                  activeTab === 'guide'
                    ? 'text-orange-400 border-orange-400'
                    : 'text-white/50 border-transparent hover:text-white/70'
                )}
              >
                <HelpCircle className="w-4 h-4" />
                Connection Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-white/5 border border-white/10 animate-pulse"
              />
            ))}
          </div>
        ) : !agentConnection ? (
          // No Connection State
          <div className="flex items-center justify-center min-h-[60vh]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md"
            >
              <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                <Wifi className="w-10 h-10 text-white/20" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Connect Your Agent</h2>
              <p className="text-white/40 mb-6">
                Connect to your local Claude Code agent to start managing sessions remotely.
                Choose how you want to connect.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setConnectionModalOpen(true)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                    'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400',
                    'text-white shadow-lg shadow-orange-500/20'
                  )}
                >
                  <Wifi className="w-4 h-4" />
                  Connect Agent
                </button>
                <button
                  onClick={() => setActiveTab('guide')}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                    'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                  )}
                >
                  <HelpCircle className="w-4 h-4" />
                  View Connection Guide
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          // Content based on active tab
          <AnimatePresence mode="wait">
            {activeTab === 'sessions' ? (
              <motion.div
                key="sessions"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {allSessions.length === 0 ? (
                  <div className="flex items-center justify-center min-h-[40vh]">
                    <div className="text-center max-w-md">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-8 h-8 text-white/20" />
                      </div>
                      <h3 className="text-lg font-medium text-white/80 mb-2">No active sessions</h3>
                      <p className="text-sm text-white/40 mb-6">
                        Start a new session to begin working with Claude Code
                      </p>
                      <button
                        onClick={() => setNewSessionOpen(true)}
                        className={cn(
                          'inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
                          'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400',
                          'text-white shadow-lg shadow-orange-500/20'
                        )}
                      >
                        <Plus className="w-4 h-4" />
                        New Session
                      </button>
                    </div>
                  </div>
                ) : (
                  <SessionListView
                    sessions={allSessions}
                    onSelectSession={handleSelectSession}
                  />
                )}
              </motion.div>
            ) : activeTab === 'environments' ? (
              <motion.div
                key="environments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <EnvironmentsList machines={machines} />
              </motion.div>
            ) : (
              <motion.div
                key="guide"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <ConnectionGuide />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Connection Settings Modal */}
      <AgentConnectionSettings
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
        onSave={handleConnectionSaved}
      />

      {/* New Session Modal */}
      {agentConnection && (
        <NewSessionModal
          open={newSessionOpen}
          onOpenChange={setNewSessionOpen}
          machines={machines}
          onStartSession={handleStartSession}
        />
      )}
    </main>
  );
}
