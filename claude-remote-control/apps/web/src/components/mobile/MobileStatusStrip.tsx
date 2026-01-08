'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusRing } from '@/components/ui/StatusRing';
import { SessionMiniCard } from './SessionMiniCard';
import { type SessionWithMachine } from '@/contexts/SessionPollingContext';
import type { SessionStatus } from '@vibecompany/247-shared';

export type MobileFilterType = 'all' | 'active' | 'waiting' | 'done';

export interface MobileStatusStripProps {
  sessions: SessionWithMachine[];
  currentSession: {
    machineId: string;
    sessionName: string;
    project: string;
  } | null;
  onSelectSession: (machineId: string, name: string, project: string) => void;
  onNewSession: () => void;
}

function getStatusColor(status: SessionStatus): string {
  switch (status) {
    case 'working':
      return 'bg-cyan-400';
    case 'init':
      return 'bg-purple-400';
    case 'needs_attention':
      return 'bg-amber-400';
    case 'idle':
    default:
      return 'bg-gray-500';
  }
}

export function MobileStatusStrip({
  sessions,
  currentSession,
  onSelectSession,
  onNewSession,
}: MobileStatusStripProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<MobileFilterType>('all');
  const [search, setSearch] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Prevent body scroll when expanded
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  // Status dots for quick glance (max 5)
  const statusDots = useMemo(() => {
    return sessions.slice(0, 5).map((s) => ({
      id: s.name,
      status: s.status,
      isActive: s.name === currentSession?.sessionName,
    }));
  }, [sessions, currentSession]);

  const currentSessionData = useMemo(() => {
    return sessions.find((s) => s.name === currentSession?.sessionName);
  }, [sessions, currentSession]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Apply search filter
    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.project.toLowerCase().includes(query) ||
          s.machineName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filter !== 'all') {
      result = result.filter((s) => {
        if (filter === 'active') return s.status === 'working' || s.status === 'init';
        if (filter === 'waiting')
          return s.status === 'needs_attention' && s.attentionReason !== 'task_complete';
        if (filter === 'done')
          return (
            s.status === 'idle' ||
            (s.status === 'needs_attention' && s.attentionReason === 'task_complete')
          );
        return true;
      });
    }

    // Sort by createdAt (newest first)
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions, search, filter]);

  // Session counts by status
  const statusCounts = useMemo(() => {
    return sessions.reduce(
      (acc, s) => {
        if (s.status === 'working' || s.status === 'init') acc.active++;
        else if (s.status === 'needs_attention') {
          if (s.attentionReason === 'task_complete') acc.done++;
          else acc.waiting++;
        } else acc.done++;
        return acc;
      },
      { active: 0, waiting: 0, done: 0 }
    );
  }, [sessions]);

  const handleSessionSelect = useCallback(
    (machineId: string, name: string, project: string) => {
      onSelectSession(machineId, name, project);
      setIsExpanded(false);
    },
    [onSelectSession]
  );

  const handleNewSession = useCallback(() => {
    onNewSession();
    setIsExpanded(false);
  }, [onNewSession]);

  const displayName = currentSession
    ? currentSession.sessionName.split('--')[1] || currentSession.sessionName
    : 'No session';

  return (
    <>
      {/* Collapsed Strip */}
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-40',
          'pt-[env(safe-area-inset-top)]',
          'bg-[#0d0d14]/95 backdrop-blur-xl',
          'border-b border-white/5'
        )}
        data-testid="mobile-status-strip"
      >
        <div className="flex h-11 items-center gap-2 px-3">
          {/* Current Session Trigger */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2',
              'rounded-lg px-2.5 py-1.5',
              'bg-white/5 transition-colors hover:bg-white/10',
              'touch-manipulation active:scale-[0.98]'
            )}
            data-testid="session-trigger"
            aria-expanded={isExpanded}
            aria-haspopup="true"
          >
            {/* Status Ring */}
            <StatusRing status={currentSessionData?.status || 'idle'} size={20} />

            {/* Session Name */}
            <span className="flex-1 truncate text-left font-mono text-sm text-white/90">
              {displayName}
            </span>

            {/* Chevron */}
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-white/40" />
            </motion.div>
          </button>

          {/* Mini Status Dots */}
          <div className="flex items-center gap-1 px-2" data-testid="status-dots">
            {statusDots.map((dot, i) => (
              <motion.div
                key={dot.id}
                className={cn(
                  'h-2 w-2 rounded-full transition-all',
                  dot.isActive && 'ring-1 ring-white/30 ring-offset-1 ring-offset-[#0d0d14]',
                  getStatusColor(dot.status)
                )}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                data-testid={`status-dot-${i}`}
              />
            ))}
            {sessions.length > 5 && (
              <span className="ml-1 font-mono text-[10px] text-white/30">
                +{sessions.length - 5}
              </span>
            )}
          </div>

          {/* Quick Add */}
          <button
            onClick={onNewSession}
            className={cn(
              'h-9 w-9 rounded-lg',
              'bg-gradient-to-br from-orange-500/20 to-amber-500/20',
              'border border-orange-500/30',
              'flex items-center justify-center',
              'hover:from-orange-500/30 hover:to-amber-500/30',
              'transition-all active:scale-95'
            )}
            data-testid="quick-add-button"
            aria-label="New session"
          >
            <Plus className="h-4 w-4 text-orange-400" />
          </button>
        </div>
      </header>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsExpanded(false)}
              data-testid="backdrop"
            />

            {/* Dropdown Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                'z-35 fixed left-0 right-0',
                'top-[calc(env(safe-area-inset-top)+44px)]',
                'max-h-[55vh] overflow-hidden',
                'bg-[#0d0d14]/98 rounded-b-2xl border-b border-white/10 backdrop-blur-xl',
                'shadow-2xl shadow-black/50'
              )}
              data-testid="dropdown-panel"
            >
              {/* Search & Filters */}
              <div className="border-b border-white/5 p-3">
                <div className="flex gap-2">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={cn(
                        'h-9 w-full rounded-lg pl-8 pr-3',
                        'border border-white/10 bg-white/5',
                        'text-sm text-white placeholder:text-white/30',
                        'focus:border-orange-500/50 focus:outline-none'
                      )}
                      data-testid="search-input"
                    />
                  </div>

                  {/* Segmented Filter */}
                  <div
                    className="flex rounded-lg bg-white/5 p-0.5"
                    role="group"
                    aria-label="Filter sessions"
                  >
                    {(
                      [
                        { key: 'all', symbol: '∞', count: sessions.length },
                        { key: 'active', symbol: '●', count: statusCounts.active },
                        { key: 'waiting', symbol: '⚡', count: statusCounts.waiting },
                        { key: 'done', symbol: '✓', count: statusCounts.done },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={cn(
                          'rounded-md px-2 py-1.5 text-xs font-medium transition-all',
                          filter === f.key
                            ? 'bg-white/10 text-white'
                            : 'text-white/40 hover:text-white/60'
                        )}
                        data-testid={`filter-${f.key}`}
                        aria-pressed={filter === f.key}
                        title={`${f.key} (${f.count})`}
                      >
                        {f.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sessions Grid */}
              <div
                className="scroll-touch max-h-[calc(55vh-120px)] overflow-y-auto overscroll-contain p-3"
                data-testid="sessions-grid"
              >
                <div className="grid grid-cols-2 gap-2">
                  {filteredSessions.map((session) => (
                    <SessionMiniCard
                      key={`${session.machineId}-${session.name}`}
                      session={session}
                      isActive={session.name === currentSession?.sessionName}
                      onClick={() =>
                        handleSessionSelect(session.machineId, session.name, session.project)
                      }
                    />
                  ))}
                </div>

                {filteredSessions.length === 0 && (
                  <div className="py-8 text-center text-sm text-white/30" data-testid="empty-state">
                    No sessions found
                  </div>
                )}
              </div>

              {/* New Session Button */}
              <div className="border-t border-white/5 p-3">
                <button
                  onClick={handleNewSession}
                  className={cn(
                    'h-11 w-full rounded-xl',
                    'bg-gradient-to-r from-orange-500 to-amber-500',
                    'text-sm font-medium text-white',
                    'flex items-center justify-center gap-2',
                    'transition-transform active:scale-[0.98]'
                  )}
                  data-testid="new-session-button"
                >
                  <Plus className="h-4 w-4" />
                  New Session
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for fixed header */}
      <div
        className="h-11 pt-[env(safe-area-inset-top)]"
        aria-hidden="true"
        data-testid="header-spacer"
      />
    </>
  );
}
