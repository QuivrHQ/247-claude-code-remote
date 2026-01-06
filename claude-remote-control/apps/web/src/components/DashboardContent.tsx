'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Zap, Settings, List, HelpCircle } from 'lucide-react';
import { SessionListView } from './SessionListView';
import { EnvironmentsList } from './EnvironmentsList';
import { ConnectionGuide } from './ConnectionGuide';
import { type SessionWithMachine } from '@/contexts/SessionPollingContext';
import { cn } from '@/lib/utils';

export type ViewTab = 'environments' | 'guide';

interface DashboardContentProps {
  // sessions prop removed as it's no longer needed for the list
  machines: Machine[];
  activeTab: ViewTab | null; // null means "welcome" screen
  onTabChange: (tab: ViewTab | null) => void;
  onSelectSession: (machineId: string, sessionName: string) => void; // Kept (maybe used by other components?)
  onNewSession: () => void;
}

export function DashboardContent({
  machines,
  activeTab,
  onTabChange,
  onNewSession,
}: DashboardContentProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-white/5 px-6 pt-4">
        <div className="flex gap-1">
          {/* Welcome Tab (hidden/implicit or explicit?) - Let's use a "Home" icon maybe or just keep tabs for Settings/Guide */}
          <button
            onClick={() => onTabChange(null)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px',
              activeTab === null
                ? 'text-orange-400 border-orange-400'
                : 'text-white/50 border-transparent hover:text-white/70'
            )}
          >
            <Zap className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => onTabChange('environments')}
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
            onClick={() => onTabChange('guide')}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === null ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-2xl mx-auto text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20 flex items-center justify-center mb-6 shadow-2xl shadow-orange-500/10">
                  <Zap className="w-10 h-10 text-orange-500" />
                </div>

                <h2 className="text-3xl font-bold text-white mb-3">Welcome to Claude Remote</h2>
                <p className="text-white/40 text-lg mb-10 max-w-md">
                  Select a session from the sidebar to continue working, or start a new task below.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <button
                    onClick={onNewSession}
                    className={cn(
                      'flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold transition-all',
                      'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400',
                      'text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02]',
                      'active:scale-[0.98]'
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    <span>Start New Session</span>
                  </button>

                  <button
                    onClick={() => onTabChange('guide')}
                    className={cn(
                      'flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-medium transition-all',
                      'bg-white/5 border border-white/10 text-white/70',
                      'hover:bg-white/10 hover:text-white hover:border-white/20'
                    )}
                  >
                    <HelpCircle className="w-5 h-5" />
                    <span>View Guide</span>
                  </button>
                </div>

                <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
                      <List className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="text-white font-medium mb-1">Session History</h3>
                    <p className="text-white/30 text-xs">Access past conversations and terminals from the sidebar.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
                      <Settings className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-medium mb-1">Environments</h3>
                    <p className="text-white/30 text-xs">Manage API keys and environment variables.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
                      <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-white font-medium mb-1">Real-time</h3>
                    <p className="text-white/30 text-xs">Live terminal streaming and instant feedback.</p>
                  </div>
                </div>
              </div>
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
      </div>
    </div>
  );
}
