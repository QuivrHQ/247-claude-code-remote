'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Zap,
  Clock,
  Filter,
  Keyboard,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { SessionCard } from './SessionCard';
import { SessionPreviewPopover } from './SessionPreviewPopover';
import { type SessionInfo } from '@/lib/notifications';
import { type SessionStatus } from '@claude-remote/shared';
import { cn } from '@/lib/utils';

interface SessionSidebarProps {
  sessions: SessionInfo[];
  projects: string[];
  currentSessionName: string | null;
  currentProject: string;
  onSelectSession: (sessionName: string | null, project: string) => void;
  onNewSession: (project: string) => void;
  onSessionKilled?: () => void;
  agentUrl: string;
}

type FilterType = 'all' | 'active' | 'waiting' | 'done';

export function SessionSidebar({
  sessions,
  projects,
  currentSessionName,
  currentProject,
  onSelectSession,
  onNewSession,
  onSessionKilled,
  agentUrl,
}: SessionSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [hoveredSession, setHoveredSession] = useState<SessionInfo | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Kill session handler
  const handleKillSession = useCallback(
    async (sessionName: string) => {
      const protocol = agentUrl.includes('localhost') ? 'http' : 'https';

      try {
        const response = await fetch(
          `${protocol}://${agentUrl}/api/sessions/${encodeURIComponent(sessionName)}`,
          { method: 'DELETE' }
        );

        if (response.ok) {
          toast.success('Session terminated');
          // If we killed the current session, show empty state
          if (sessionName === currentSessionName) {
            onSessionKilled?.();
          }
        } else {
          toast.error('Failed to terminate session');
        }
      } catch (err) {
        console.error('Failed to kill session:', err);
        toast.error('Could not connect to agent');
      }
    },
    [agentUrl, currentSessionName, onSessionKilled]
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
          s.project.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filter !== 'all') {
      result = result.filter((s) => {
        if (filter === 'active') return s.status === 'working' || s.status === 'init';
        if (filter === 'waiting')
          return s.status === 'needs_attention' && s.attentionReason !== 'task_complete';
        if (filter === 'done')
          return s.status === 'idle' ||
            (s.status === 'needs_attention' && s.attentionReason === 'task_complete');
        return true;
      });
    }

    // Sort by createdAt only (newest first) - stable chronological order
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [sessions, searchQuery, filter]);

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
            onSelectSession(session.name, session.project);
          }
        }
      }

      // Cmd/Ctrl + N for new session
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        onNewSession(currentProject);
      }

      // Option + [ and ] to navigate sessions
      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.code === 'BracketLeft' || e.key === '[')) {
        e.preventDefault();
        const currentIndex = filteredSessions.findIndex(
          (s) => s.name === currentSessionName
        );
        if (currentIndex > 0) {
          const session = filteredSessions[currentIndex - 1];
          onSelectSession(session.name, session.project);
        }
      }

      if (e.altKey && !e.metaKey && !e.ctrlKey && (e.code === 'BracketRight' || e.key === ']')) {
        e.preventDefault();
        const currentIndex = filteredSessions.findIndex(
          (s) => s.name === currentSessionName
        );
        if (currentIndex < filteredSessions.length - 1) {
          const session = filteredSessions[currentIndex + 1];
          onSelectSession(session.name, session.project);
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
    [filteredSessions, currentSessionName, currentProject, onSelectSession, onNewSession]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [handleKeyboard]);

  const handleSessionHover = (session: SessionInfo | null, event?: React.MouseEvent) => {
    setHoveredSession(session);
    if (event && session) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setHoverPosition({ x: rect.right + 8, y: rect.top });
    }
  };

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: sessions.length },
    { key: 'active', label: 'Active', count: statusCounts.active },
    { key: 'waiting', label: 'Needs input', count: statusCounts.waiting },
    { key: 'done', label: 'Done', count: statusCounts.done },
  ];

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 64 : 320 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn(
          'h-full flex flex-col border-r border-white/5',
          'bg-gradient-to-b from-[#0d0d14] to-[#0a0a10]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/5">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-white/70">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </span>
            </motion.div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white/80 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Search & Filters */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 space-y-3 border-b border-white/5"
            >
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                />
              </div>

              {/* Filter pills */}
              <div className="flex gap-1.5 flex-wrap">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                      filter === f.key
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10 hover:text-white/70'
                    )}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className="ml-1.5 opacity-60">{f.count}</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Session Button */}
        <div className={cn('p-3', isCollapsed && 'px-2')}>
          <button
            onClick={() => onNewSession(currentProject)}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-medium text-sm transition-all',
              'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400',
              'text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30',
              'active:scale-[0.98]',
              isCollapsed && 'px-0'
            )}
            title={isCollapsed ? 'New Session (⌘N)' : undefined}
          >
            <Plus className="w-4 h-4" />
            {!isCollapsed && <span>New Session</span>}
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <AnimatePresence mode="popLayout">
            {filteredSessions.map((session, index) => (
              <motion.div
                key={session.name}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15, delay: index * 0.02 }}
              >
                <SessionCard
                  session={session}
                  isActive={session.name === currentSessionName}
                  isCollapsed={isCollapsed}
                  index={index}
                  onClick={() => onSelectSession(session.name, session.project)}
                  onKill={() => handleKillSession(session.name)}
                  onMouseEnter={(e) => handleSessionHover(session, e)}
                  onMouseLeave={() => handleSessionHover(null)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredSessions.length === 0 && !isCollapsed && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-sm text-white/40">No sessions found</p>
              <p className="text-xs text-white/20 mt-1">
                {searchQuery || filter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create a new session to get started'}
              </p>
            </div>
          )}
        </div>

        {/* Keyboard shortcut hint */}
        {!isCollapsed && (
          <div className="p-3 border-t border-white/5">
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Press ? for shortcuts</span>
            </button>
          </div>
        )}
      </motion.aside>

      {/* Session Preview Popover */}
      <SessionPreviewPopover
        session={hoveredSession}
        position={hoverPosition}
        agentUrl={agentUrl}
      />

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
              className="bg-[#12121a] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <ShortcutRow keys={['⌘', 'N']} description="Create new session" />
                <ShortcutRow keys={['⌥', '1-9']} description="Switch to session 1-9" />
                <ShortcutRow keys={['⌥', '[']} description="Previous session" />
                <ShortcutRow keys={['⌥', ']']} description="Next session" />
                <ShortcutRow keys={['⌥', 'T']} description="Terminal tab" />
                <ShortcutRow keys={['⌥', 'E']} description="Editor tab" />
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
            className="px-2 py-1 bg-white/10 rounded text-xs font-mono text-white/80 border border-white/10"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
