'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, Zap, Keyboard, X, Archive, Download, Share } from 'lucide-react';
import { toast } from 'sonner';
import { ControlPanelHeader, SessionModule } from './desktop';
import { type SessionWithMachine } from '@/contexts/SessionPollingContext';
import { type SessionInfo } from '@/lib/types';
import { cn, buildApiUrl } from '@/lib/utils';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

interface SelectedSession {
  machineId: string;
  sessionName: string;
  project: string;
}

interface HomeSidebarProps {
  sessions: SessionWithMachine[];
  archivedSessions: SessionWithMachine[];
  selectedSession: SelectedSession | null;
  onSelectSession: (machineId: string, sessionName: string, project: string) => void;
  onDeselectSession?: () => void;
  onSessionKilled?: (machineId: string, sessionName: string) => void;
  onSessionArchived?: (machineId: string, sessionName: string) => void;
  /** Whether this is rendered in mobile drawer mode */
  isMobileDrawer?: boolean;
  /** Callback when a session is selected in mobile mode (to close drawer) */
  onMobileSessionSelect?: () => void;
}

export function HomeSidebar({
  sessions,
  archivedSessions,
  selectedSession,
  onSelectSession,
  onDeselectSession: _onDeselectSession,
  onSessionKilled,
  onSessionArchived,
  isMobileDrawer = false,
  onMobileSessionSelect,
}: HomeSidebarProps) {
  // Don't allow collapse in mobile drawer mode
  const [isCollapsed, setIsCollapsed] = useState(false);
  const effectiveCollapsed = isMobileDrawer ? false : isCollapsed;

  // PWA install prompt
  const { isInstallable, isInstalled, isIOS, promptInstall } = useInstallPrompt();
  const [searchQuery, setSearchQuery] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(true);

  // Kill session handler
  const handleKillSession = useCallback(
    async (session: SessionWithMachine) => {
      try {
        const response = await fetch(
          buildApiUrl(session.agentUrl, `/api/sessions/${encodeURIComponent(session.name)}`),
          { method: 'DELETE' }
        );

        if (response.ok) {
          toast.success('Session terminated');
          // If we killed the selected session, notify parent
          if (selectedSession?.sessionName === session.name) {
            onSessionKilled?.(session.machineId, session.name);
          }
        } else {
          toast.error('Failed to terminate session');
        }
      } catch (err) {
        console.error('Failed to kill session:', err);
        toast.error('Could not connect to agent');
      }
    },
    [selectedSession, onSessionKilled]
  );

  // Archive session handler
  const handleArchiveSession = useCallback(
    async (session: SessionWithMachine) => {
      try {
        const response = await fetch(
          buildApiUrl(
            session.agentUrl,
            `/api/sessions/${encodeURIComponent(session.name)}/archive`
          ),
          { method: 'POST' }
        );

        if (response.ok) {
          toast.success('Session archived');
          // If we archived the selected session, notify parent
          if (selectedSession?.sessionName === session.name) {
            onSessionArchived?.(session.machineId, session.name);
          }
        } else {
          toast.error('Failed to archive session');
        }
      } catch (err) {
        console.error('Failed to archive session:', err);
        toast.error('Could not connect to agent');
      }
    },
    [selectedSession, onSessionArchived]
  );

  // Filter and sort sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.project.toLowerCase().includes(query) ||
          s.machineName.toLowerCase().includes(query)
      );
    }

    // Sort by createdAt only (newest first) - stable chronological order
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions, searchQuery]);

  // Keyboard navigation
  const handleKeyboard = useCallback(
    (e: KeyboardEvent) => {
      // Option + number to switch sessions (avoids Chrome tab conflict)
      // Use e.code because Option+number produces special chars on Mac
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const digitMatch = e.code.match(/^Digit([1-9])$/);
        if (digitMatch) {
          e.preventDefault();
          const index = parseInt(digitMatch[1]) - 1;
          if (index < filteredSessions.length) {
            const session = filteredSessions[index];
            onSelectSession(session.machineId, session.name, session.project);
          }
        }
      }

      // Option + [ and ] to navigate sessions
      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.code === 'BracketLeft' || e.key === '[')) {
        e.preventDefault();
        const currentIndex = filteredSessions.findIndex(
          (s) => s.name === selectedSession?.sessionName
        );
        if (currentIndex > 0) {
          const session = filteredSessions[currentIndex - 1];
          onSelectSession(session.machineId, session.name, session.project);
        }
      }

      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.code === 'BracketRight' || e.key === ']')) {
        e.preventDefault();
        const currentIndex = filteredSessions.findIndex(
          (s) => s.name === selectedSession?.sessionName
        );
        if (currentIndex < filteredSessions.length - 1) {
          const session = filteredSessions[currentIndex + 1];
          onSelectSession(session.machineId, session.name, session.project);
        }
      }

      // ? for shortcuts help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShowShortcuts((prev) => !prev);
        }
      }
    },
    [filteredSessions, selectedSession, onSelectSession]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [handleKeyboard]);

  // Wrapper for session selection that closes drawer on mobile
  // Also resets needs_attention status when selecting a session
  const handleSessionSelect = useCallback(
    (machineId: string, sessionName: string, project: string) => {
      // Reset needs_attention status when selecting
      const session = sessions.find((s) => s.name === sessionName);
      if (session?.status === 'needs_attention') {
        fetch(buildApiUrl(session.agentUrl, `/api/sessions/${sessionName}/acknowledge`), {
          method: 'POST',
        }).catch(console.error);
      }

      onSelectSession(machineId, sessionName, project);
      if (isMobileDrawer) {
        onMobileSessionSelect?.();
      }
    },
    [sessions, onSelectSession, isMobileDrawer, onMobileSessionSelect]
  );

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isMobileDrawer ? '100%' : effectiveCollapsed ? 64 : 320 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn(
          'flex h-full flex-col',
          !isMobileDrawer && 'border-r border-white/5',
          !isMobileDrawer && 'bg-gradient-to-b from-[#0d0d14] to-[#0a0a10]'
        )}
      >
        {/* Control Panel Header - hidden in mobile drawer mode */}
        {!isMobileDrawer && (
          <ControlPanelHeader
            totalSessions={sessions.length}
            isCollapsed={effectiveCollapsed}
            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          />
        )}

        {/* Search */}
        <AnimatePresence>
          {!effectiveCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-white/5 p-3"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  aria-label="Search sessions"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white',
                    'placeholder:text-white/30 focus:border-orange-500/50 focus:outline-none',
                    'transition-all focus:ring-1 focus:ring-orange-500/20',
                    // Mobile: larger touch target
                    isMobileDrawer && 'min-h-[44px]'
                  )}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sessions List */}
        <div
          className={cn(
            'flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-1',
            'scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent',
            // Mobile: add spacing for touch and prevent scroll chaining
            isMobileDrawer && 'scroll-touch space-y-2 overscroll-contain px-3'
          )}
        >
          <AnimatePresence mode="popLayout">
            {filteredSessions.map((session, index) => (
              <motion.div
                key={`${session.machineId}-${session.name}`}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15, delay: index * 0.02 }}
              >
                <SessionModule
                  session={session as SessionInfo}
                  isActive={session.name === selectedSession?.sessionName}
                  isCollapsed={effectiveCollapsed}
                  index={index}
                  onClick={() =>
                    handleSessionSelect(session.machineId, session.name, session.project)
                  }
                  onKill={() => handleKillSession(session)}
                  onArchive={() => handleArchiveSession(session)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredSessions.length === 0 && !effectiveCollapsed && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <Zap className="h-5 w-5 text-white/20" />
              </div>
              <p className="text-sm text-white/40">No sessions found</p>
              <p className="mt-1 text-xs text-white/20">
                {searchQuery ? 'Try adjusting your search' : 'Create a new session to get started'}
              </p>
            </div>
          )}

          {/* History Section */}
          {archivedSessions.length > 0 && !effectiveCollapsed && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <button
                onClick={() => setHistoryCollapsed(!historyCollapsed)}
                aria-expanded={!historyCollapsed}
                aria-controls="history-section"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-orange-500/50"
              >
                <Archive className="h-4 w-4 text-white/40" aria-hidden="true" />
                <span className="text-xs font-medium text-white/50">Historique</span>
                <span className="ml-1 text-xs text-white/30">({archivedSessions.length})</span>
                <ChevronDown
                  className={cn(
                    'ml-auto h-3 w-3 text-white/40 transition-transform',
                    historyCollapsed && '-rotate-90'
                  )}
                  aria-hidden="true"
                />
              </button>

              <AnimatePresence>
                {!historyCollapsed && (
                  <motion.div
                    id="history-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 space-y-1"
                  >
                    {archivedSessions.map((session) => {
                      const displayName = session.name.split('--')[1] || session.name;
                      const archivedTime = session.archivedAt
                        ? new Date(session.archivedAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '';

                      return (
                        <div
                          key={`archived-${session.machineId}-${session.name}`}
                          className="rounded-lg bg-white/[0.02] px-2 py-2 opacity-60 transition-colors hover:bg-white/5 hover:opacity-80"
                        >
                          <div className="flex items-center gap-2">
                            <Archive className="h-3.5 w-3.5 flex-shrink-0 text-white/30" />
                            <span className="truncate text-xs font-medium text-white/60">
                              {displayName}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 pl-5">
                            <span className="truncate text-[10px] text-white/30">
                              {session.project}
                            </span>
                            <span className="text-white/20">·</span>
                            <span className="text-[10px] text-white/30">{archivedTime}</span>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Install App Button - shown only on mobile when installable */}
        {isMobileDrawer && isInstallable && !isInstalled && (
          <div className="border-t border-white/5 p-3">
            {isIOS ? (
              // iOS: Show instructions
              <div className="rounded-lg bg-orange-500/10 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/20">
                    <Download className="h-4 w-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-orange-300">Installer l&apos;app</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/50">
                      Appuyez sur{' '}
                      <span className="inline-flex items-center rounded bg-white/10 px-1">
                        <Share className="h-3 w-3" />
                      </span>{' '}
                      puis &quot;Sur l&apos;ecran d&apos;accueil&quot;
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Android/Desktop: Show install button
              <button
                onClick={promptInstall}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg py-3',
                  'bg-orange-500/10 text-sm font-medium text-orange-400',
                  'hover:bg-orange-500/20 active:scale-[0.98]',
                  'touch-manipulation transition-all',
                  'border border-orange-500/20'
                )}
              >
                <Download className="h-4 w-4" />
                <span>Installer l&apos;application</span>
              </button>
            )}
          </div>
        )}

        {/* Keyboard shortcut hint + version - hidden on mobile */}
        {!effectiveCollapsed && !isMobileDrawer && (
          <div className="border-t border-white/5 p-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowShortcuts(true)}
                className="flex items-center gap-2 text-xs text-white/30 transition-colors hover:text-white/50"
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>Press ? for shortcuts</span>
              </button>
              <span className="text-[10px] text-white/20">
                v{process.env.NEXT_PUBLIC_APP_VERSION}
              </span>
            </div>
          </div>
        )}
      </motion.aside>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl border border-white/10 bg-[#12121a] p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  aria-label="Close shortcuts"
                  className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-1 focus-visible:ring-orange-500/50"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-4">
                <ShortcutRow keys={['Cmd', 'K']} description="New session" />
                <ShortcutRow keys={['Alt', '1-9']} description="Switch to session 1-9" />
                <ShortcutRow keys={['Alt', '[']} description="Previous session" />
                <ShortcutRow keys={['Alt', ']']} description="Next session" />
                <ShortcutRow keys={['?']} description="Show this help" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/60">{description}</span>
      <div className="flex gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="rounded border border-white/10 bg-white/10 px-2 py-1 font-mono text-xs text-white/80"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
