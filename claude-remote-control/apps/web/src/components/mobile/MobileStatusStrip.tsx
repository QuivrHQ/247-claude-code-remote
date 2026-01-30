'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, Search, HelpCircle, Settings, Wifi, Monitor } from 'lucide-react';
import { PushNotificationButton } from '@/components/PushNotificationButton';
import { cn } from '@/lib/utils';
import { SessionMiniCard } from './SessionMiniCard';
import { type SessionWithMachine } from '@/contexts/SessionPollingContext';

/** Machine info for filtering */
export interface MobileMachine {
  id: string;
  name: string;
  color?: string;
}

export interface MobileStatusStripProps {
  sessions: SessionWithMachine[];
  currentSession: {
    machineId: string;
    sessionName: string;
    project: string;
  } | null;
  onSelectSession: (machineId: string, name: string, project: string) => void;
  onNewSession: () => void;
  onOpenGuide?: () => void;
  onOpenEnvironments?: () => void;
  /** Called to open connection settings modal */
  onConnectionSettingsClick?: () => void;
  /** Called when a session is killed or archived */
  onSessionKilled?: (machineId: string, sessionName: string) => void;
  /** Kill session callback (from useSessionActions hook) */
  onKillSession?: (machineId: string, sessionName: string) => Promise<boolean>;
  /** Archive session callback (from useSessionActions hook) */
  onArchiveSession?: (machineId: string, sessionName: string) => Promise<boolean>;
  /** Available machines for filtering */
  machines?: MobileMachine[];
  /** Currently selected machine filter */
  machineFilter?: string | null;
  /** Callback to select/deselect machine filter */
  onSelectMachine?: (machineId: string | null) => void;
  /** Unique projects extracted from sessions */
  projects?: string[];
  /** Currently selected project filter */
  projectFilter?: string | null;
  /** Callback to select/deselect project filter */
  onSelectProject?: (projectName: string | null) => void;
}

export function MobileStatusStrip({
  sessions,
  currentSession,
  onSelectSession,
  onNewSession,
  onOpenGuide,
  onOpenEnvironments,
  onConnectionSettingsClick,
  onSessionKilled,
  onKillSession,
  onArchiveSession,
  machines = [],
  machineFilter,
  onSelectMachine,
  projects = [],
  projectFilter,
  onSelectProject,
}: MobileStatusStripProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState('');

  // Kill session handler using shared hook
  const handleKillSession = useCallback(
    async (session: SessionWithMachine) => {
      if (!onKillSession) return;
      const success = await onKillSession(session.machineId, session.name);
      if (success && currentSession?.sessionName === session.name) {
        onSessionKilled?.(session.machineId, session.name);
      }
    },
    [onKillSession, currentSession, onSessionKilled]
  );

  // Archive session handler using shared hook
  const handleArchiveSession = useCallback(
    async (session: SessionWithMachine) => {
      if (!onArchiveSession) return;
      const success = await onArchiveSession(session.machineId, session.name);
      if (success && currentSession?.sessionName === session.name) {
        onSessionKilled?.(session.machineId, session.name);
      }
    },
    [onArchiveSession, currentSession, onSessionKilled]
  );

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

  // Session dots for quick glance (max 5)
  const sessionDots = useMemo(() => {
    return sessions.slice(0, 5).map((s) => ({
      id: s.name,
      isActive: s.name === currentSession?.sessionName,
    }));
  }, [sessions, currentSession]);

  // Filter sessions by search, machine, and project
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Apply machine filter
    if (machineFilter) {
      result = result.filter((s) => s.machineId === machineFilter);
    }

    // Apply project filter
    if (projectFilter) {
      result = result.filter((s) => s.project === projectFilter);
    }

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

    // Sort by createdAt (newest first)
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions, search, machineFilter, projectFilter]);

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
            {/* Session indicator */}
            <div
              className={cn(
                'h-5 w-5 flex-shrink-0 rounded-full',
                currentSession ? 'bg-orange-500/30' : 'bg-white/10'
              )}
            />

            {/* Session Name */}
            <span className="flex-1 truncate text-left font-mono text-sm text-white/90">
              {displayName}
            </span>

            {/* Chevron */}
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-white/40" />
            </motion.div>
          </button>

          {/* Mini Session Dots */}
          <div className="flex items-center gap-1 px-2" data-testid="status-dots">
            {sessionDots.map((dot, i) => (
              <motion.div
                key={dot.id}
                className={cn(
                  'h-2 w-2 rounded-full bg-white/30 transition-all',
                  dot.isActive &&
                    'bg-orange-400 ring-1 ring-white/30 ring-offset-1 ring-offset-[#0d0d14]'
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

          {/* Utility buttons - Guide & Environments */}
          <div className="flex items-center gap-0.5">
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
                aria-label="Guide"
                data-testid="guide-button"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            )}
            {onOpenEnvironments && (
              <button
                onClick={onOpenEnvironments}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
                aria-label="Environments"
                data-testid="environments-button"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
            {onConnectionSettingsClick && (
              <button
                onClick={onConnectionSettingsClick}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/5 hover:text-white/60"
                aria-label="Connection settings"
                data-testid="connection-settings-button"
              >
                <Wifi className="h-4 w-4" />
              </button>
            )}
            <PushNotificationButton isMobile={true} />
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
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
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
                'fixed left-0 right-0 z-50',
                'top-[calc(env(safe-area-inset-top)+44px)]',
                'max-h-[55vh] overflow-hidden',
                'bg-[#0d0d14]/98 rounded-b-2xl border-b border-white/10 backdrop-blur-xl',
                'shadow-2xl shadow-black/50'
              )}
              data-testid="dropdown-panel"
            >
              {/* Search */}
              <div className="border-b border-white/5 p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search sessions..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search sessions"
                    className={cn(
                      'h-9 w-full rounded-lg pl-8 pr-3',
                      'border border-white/10 bg-white/5',
                      'text-sm text-white placeholder:text-white/30',
                      'focus:border-orange-500/50 focus:outline-none'
                    )}
                    data-testid="search-input"
                  />
                </div>
              </div>

              {/* Filter Chips - Machines & Projects */}
              {(machines.length > 1 || projects.length > 1) && (
                <div className="border-b border-white/5 px-3 py-2" data-testid="filter-chips">
                  {/* Machine filters */}
                  {machines.length > 1 && onSelectMachine && (
                    <div className="mb-2">
                      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/30">
                        Machines
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {machines.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => onSelectMachine(machineFilter === m.id ? null : m.id)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all',
                              'touch-manipulation active:scale-95',
                              machineFilter === m.id
                                ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30'
                                : 'bg-white/5 text-white/50 hover:bg-white/10'
                            )}
                            data-testid={`machine-filter-${m.id}`}
                          >
                            {m.color ? (
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: m.color }}
                              />
                            ) : (
                              <Monitor className="h-3 w-3" />
                            )}
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project filters */}
                  {projects.length > 1 && onSelectProject && (
                    <div>
                      <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-white/30">
                        Projects
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {projects.map((p) => (
                          <button
                            key={p}
                            onClick={() => onSelectProject(projectFilter === p ? null : p)}
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs transition-all',
                              'touch-manipulation active:scale-95',
                              projectFilter === p
                                ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30'
                                : 'bg-white/5 text-white/50 hover:bg-white/10'
                            )}
                            data-testid={`project-filter-${p}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                      onKill={() => handleKillSession(session)}
                      onArchive={() => handleArchiveSession(session)}
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
