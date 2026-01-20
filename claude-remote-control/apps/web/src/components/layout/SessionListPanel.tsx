'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Archive, Trash2, Clock, X } from 'lucide-react';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { variants, stagger, interactive } from '@/lib/animations';
import { StatusDot, StatusBadge, type SessionStatus } from '@/components/ui/status-indicator';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionListItem {
  id: string;
  name: string;
  project: string;
  status: SessionStatus;
  updatedAt: Date;
  createdAt: Date;
  model?: string;
  cost?: number;
  machineId?: string;
}

interface DateGroup {
  label: string;
  date: Date;
  sessions: SessionListItem[];
}

interface SessionListPanelProps {
  sessions?: SessionListItem[];
  selectedSessionId?: string | null;
  onSelectSession?: (session: SessionListItem) => void;
  onNewSession?: () => void;
  onKillSession?: (session: SessionListItem) => void;
  onArchiveSession?: (session: SessionListItem) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

function groupSessionsByDate(sessions: SessionListItem[]): DateGroup[] {
  const groups = new Map<string, SessionListItem[]>();

  sessions.forEach((session) => {
    const date = startOfDay(session.updatedAt);
    let label: string;

    if (isToday(date)) {
      label = 'Today';
    } else if (isYesterday(date)) {
      label = 'Yesterday';
    } else {
      label = format(date, 'MMM d');
    }

    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(session);
  });

  return Array.from(groups.entries())
    .map(([label, sessions]) => ({
      label,
      date: sessions[0].updatedAt,
      sessions: sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function formatTime(date: Date): string {
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  return format(date, 'MMM d, h:mm a');
}

// ═══════════════════════════════════════════════════════════════════════════
// Search Input Component
// ═══════════════════════════════════════════════════════════════════════════

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function SearchInput({ value, onChange, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg py-2 pl-9 pr-8 text-sm',
          'border border-white/10 bg-white/5',
          'text-white placeholder:text-white/30',
          'focus:border-primary/50 focus:ring-primary/20 focus:outline-none focus:ring-2',
          'transition-all duration-150'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 hover:bg-white/10"
          aria-label="Clear search"
        >
          <X className="h-3 w-3 text-white/40" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Card Component
// ═══════════════════════════════════════════════════════════════════════════

interface SessionCardProps {
  session: SessionListItem;
  selected?: boolean;
  onClick?: () => void;
  onKill?: () => void;
  onArchive?: () => void;
}

function SessionCard({ session, selected, onClick, onKill, onArchive }: SessionCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.button
      variants={variants.fadeInUp}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={cn(
        'w-full rounded-lg p-3 text-left',
        'transition-all duration-150',
        'hover:bg-surface-1/50 hover:shadow-thin active:scale-[0.99]',
        'group relative',
        selected && 'ring-primary/30 bg-surface-1/50 shadow-thin ring-1'
      )}
      {...interactive.subtle}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className="pt-1">
          <StatusDot status={session.status} />
          <span className="sr-only">Status: {session.status.replace('_', ' ')}</span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Name and badge */}
          <div className="mb-0.5 flex items-center gap-2">
            <span className="truncate font-medium text-white/90">{session.name}</span>
            {session.status === 'needs_attention' && (
              <StatusBadge status={session.status} size="sm" showDot={false} />
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className="truncate">{session.project}</span>
            <span className="text-white/20">•</span>
            <Clock className="h-3 w-3" />
            <span>{formatTime(session.updatedAt)}</span>
          </div>

          {/* Cost (if available) */}
          {session.cost !== undefined && (
            <div className="mt-1.5 flex items-center gap-2 text-xs">
              <span className="text-white/30">{session.model}</span>
              <span className="text-emerald-400/70">${session.cost.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Actions on hover */}
        <AnimatePresence>
          {showActions && (onKill || onArchive) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.1 }}
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {onArchive && (
                <button
                  onClick={onArchive}
                  className="rounded-md p-2 text-white/40 hover:bg-white/10 hover:text-white/70"
                  title="Archive session"
                  aria-label={`Archive session ${session.name}`}
                >
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              {onKill && (
                <button
                  onClick={onKill}
                  className="rounded-md p-2 text-white/40 hover:bg-red-500/20 hover:text-red-400"
                  title="Kill session"
                  aria-label={`Kill session ${session.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Date Group Component
// ═══════════════════════════════════════════════════════════════════════════

interface DateGroupProps {
  group: DateGroup;
  selectedId?: string | null;
  onSelect?: (session: SessionListItem) => void;
  onKill?: (session: SessionListItem) => void;
  onArchive?: (session: SessionListItem) => void;
}

function DateGroupSection({ group, selectedId, onSelect, onKill, onArchive }: DateGroupProps) {
  return (
    <div className="mb-2">
      {/* Date header */}
      <div className="date-group-header sticky top-0 z-10">{group.label}</div>

      {/* Sessions */}
      <motion.div
        variants={stagger.fast}
        initial="initial"
        animate="animate"
        className="space-y-1 px-2"
      >
        {group.sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            selected={selectedId === session.id}
            onClick={() => onSelect?.(session)}
            onKill={onKill ? () => onKill(session) : undefined}
            onArchive={onArchive ? () => onArchive(session) : undefined}
          />
        ))}
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SessionListPanel Component
// ═══════════════════════════════════════════════════════════════════════════

export function SessionListPanel({
  sessions = [],
  selectedSessionId,
  onSelectSession,
  onNewSession,
  onKillSession,
  onArchiveSession,
}: SessionListPanelProps) {
  const [search, setSearch] = useState('');

  // Filter sessions by search
  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const query = search.toLowerCase();
    return sessions.filter(
      (s) => s.name.toLowerCase().includes(query) || s.project.toLowerCase().includes(query)
    );
  }, [search, sessions]);

  // Group by date
  const groupedSessions = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions]);

  return (
    <div className="panel flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white/90">Sessions</h2>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-white/50">
            {sessions.length}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-white/5 p-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search sessions..." />
      </div>

      {/* Sessions List */}
      <div className="scrollbar-hide flex-1 overflow-y-auto py-2">
        {groupedSessions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-white/30">
            <Search className="mb-2 h-8 w-8" />
            <p className="text-sm">
              {sessions.length === 0 ? 'No sessions yet' : 'No sessions found'}
            </p>
          </div>
        ) : (
          groupedSessions.map((group) => (
            <DateGroupSection
              key={group.label}
              group={group}
              selectedId={selectedSessionId}
              onSelect={onSelectSession}
              onKill={onKillSession}
              onArchive={onArchiveSession}
            />
          ))
        )}
      </div>

      {/* New Session Button */}
      {onNewSession && (
        <div className="border-t border-white/5 p-3">
          <button
            onClick={onNewSession}
            className={cn(
              'flex w-full items-center justify-center gap-2',
              'rounded-lg px-4 py-2.5 text-sm font-medium',
              'bg-primary text-white',
              'hover:bg-primary/90 active:scale-[0.98]',
              'transition-all duration-150',
              'shadow-primary/20 shadow-lg'
            )}
          >
            <Plus className="h-4 w-4" />
            New Session
          </button>
        </div>
      )}
    </div>
  );
}
