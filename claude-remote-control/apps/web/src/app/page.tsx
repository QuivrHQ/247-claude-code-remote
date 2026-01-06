'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Plus,
  RefreshCw,
  Zap,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { MachineCard } from '@/components/MachineCard';
import { NewSessionModal } from '@/components/NewSessionModal';
import { RecentActivityFeed } from '@/components/RecentActivityFeed';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import { cn } from '@/lib/utils';

interface Machine {
  id: string;
  name: string;
  status: string;
  tunnelUrl: string | null;
  config?: {
    projects: string[];
    agentUrl?: string;
  };
  lastSeen: string | null;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const { setMachines: setPollingMachines, sessionsByMachine } = useSessionPolling();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);

  const fetchMachines = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const response = await fetch('/api/machines');
      const data = await response.json();
      setMachines(data);
      setPollingMachines(data);
    } catch (err) {
      console.error('Failed to fetch machines:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [setPollingMachines]);

  useEffect(() => {
    fetchMachines();
    const interval = setInterval(() => fetchMachines(), 30000);
    return () => clearInterval(interval);
  }, [fetchMachines]);

  // Keyboard shortcut: ⌘K to open new session modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setNewSessionOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMachineClick = (machineId: string) => {
    router.push(`/terminal/${machineId}`);
  };

  const handleStartSession = (machineId: string, project: string) => {
    router.push(`/terminal/${machineId}?project=${encodeURIComponent(project)}`);
  };

  const handleSelectSession = (machineId: string, project: string, sessionName: string) => {
    router.push(
      `/terminal/${machineId}?project=${encodeURIComponent(project)}&session=${encodeURIComponent(sessionName)}`
    );
  };

  // Stats
  const onlineMachines = machines.filter((m) => m.status === 'online');
  const offlineMachines = machines.filter((m) => m.status !== 'online');

  // Calculate total sessions across all machines
  let totalSessions = 0;
  let needsAttention = 0;
  sessionsByMachine.forEach((data) => {
    totalSessions += data.sessions.length;
    needsAttention += data.sessions.filter(
      (s) => s.status === 'waiting' || s.status === 'permission'
    ).length;
  });

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
                <p className="text-sm text-white/40">Mission Control</p>
              </div>
            </div>

            {/* Global Stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <Monitor className="w-4 h-4 text-white/40" />
                <span className="text-emerald-400 font-medium">{onlineMachines.length}</span>
                <span className="text-white/30">/ {machines.length} machines</span>
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-white/40" />
                <span className="text-white/70 font-medium">{totalSessions}</span>
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
                onClick={() => fetchMachines(true)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  'text-white/40 hover:text-white hover:bg-white/5'
                )}
                aria-label="Refresh"
              >
                <RefreshCw className={cn('w-5 h-5', isRefreshing && 'animate-spin')} />
              </button>

              <button
                onClick={() => setNewSessionOpen(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
                  'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400',
                  'text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30',
                  'active:scale-[0.98]'
                )}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Session</span>
                <kbd className="hidden lg:inline-flex px-1.5 py-0.5 text-[10px] bg-white/20 rounded ml-1">
                  ⌘K
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          // Loading State
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-2xl bg-white/5 border border-white/10 animate-pulse"
                />
              ))}
            </div>
            <div className="h-96 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          </div>
        ) : machines.length === 0 ? (
          // Empty State
          <div className="flex items-center justify-center min-h-[60vh]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md"
            >
              <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                <Monitor className="w-10 h-10 text-white/20" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">No machines registered</h2>
              <p className="text-white/40 mb-6">
                Start a local agent to register your first machine and begin managing Claude Code sessions remotely.
              </p>
              <code className="inline-block px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60 font-mono">
                pnpm dev:agent
              </code>
            </motion.div>
          </div>
        ) : (
          // Main Layout: Machines + Activity Feed
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Machines Grid */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Machines</h2>
                <span className="text-sm text-white/30">
                  {onlineMachines.length} online, {offlineMachines.length} offline
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
                  {/* Online machines first */}
                  {onlineMachines.map((machine, index) => (
                    <motion.div
                      key={machine.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <MachineCard
                        machine={machine}
                        onClick={() => handleMachineClick(machine.id)}
                      />
                    </motion.div>
                  ))}

                  {/* Offline machines */}
                  {offlineMachines.map((machine, index) => (
                    <motion.div
                      key={machine.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2, delay: (onlineMachines.length + index) * 0.05 }}
                    >
                      <MachineCard
                        machine={machine}
                        onClick={() => handleMachineClick(machine.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 p-4 rounded-2xl bg-white/[0.02] border border-white/5 min-h-[500px]">
                <RecentActivityFeed onSelectSession={handleSelectSession} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Session Modal */}
      <NewSessionModal
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        machines={machines}
        onStartSession={handleStartSession}
      />
    </main>
  );
}
