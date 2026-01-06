'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Zap } from 'lucide-react';
import { GlobalSessionCard } from './GlobalSessionCard';
import { type SessionWithMachine } from '@/contexts/SessionPollingContext';
import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'active' | 'waiting' | 'done';

interface SessionListViewProps {
  sessions: SessionWithMachine[];
  onSelectSession: (machineId: string, sessionName: string) => void;
}

export function SessionListView({ sessions, onSelectSession }: SessionListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [machineFilter, setMachineFilter] = useState<string>('');

  // Get unique projects and machines for filter dropdowns
  const { projects, machines } = useMemo(() => {
    const projectSet = new Set<string>();
    const machineSet = new Set<string>();
    sessions.forEach((s) => {
      projectSet.add(s.project);
      machineSet.add(s.machineName);
    });
    return {
      projects: Array.from(projectSet).sort(),
      machines: Array.from(machineSet).sort(),
    };
  }, [sessions]);

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

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((s) => {
        if (statusFilter === 'active') return s.status === 'working' || s.status === 'init';
        if (statusFilter === 'waiting')
          return s.status === 'needs_attention' && s.attentionReason !== 'task_complete';
        if (statusFilter === 'done')
          return s.status === 'idle' ||
            (s.status === 'needs_attention' && s.attentionReason === 'task_complete');
        return true;
      });
    }

    // Apply project filter
    if (projectFilter) {
      result = result.filter((s) => s.project === projectFilter);
    }

    // Apply machine filter
    if (machineFilter) {
      result = result.filter((s) => s.machineName === machineFilter);
    }

    // Sort by createdAt only (newest first) - stable chronological order
    return result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [sessions, searchQuery, statusFilter, projectFilter, machineFilter]);

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

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: sessions.length },
    { key: 'active', label: 'Active', count: statusCounts.active },
    { key: 'waiting', label: 'Needs input', count: statusCounts.waiting },
    { key: 'done', label: 'Done', count: statusCounts.done },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2.5 rounded-xl',
              'bg-white/5 border border-white/10',
              'text-white placeholder:text-white/30',
              'focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20',
              'transition-all'
            )}
          />
        </div>

        {/* Project Filter */}
        {projects.length > 1 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className={cn(
              'px-4 py-2.5 rounded-xl appearance-none cursor-pointer',
              'bg-white/5 border border-white/10',
              'text-white text-sm',
              'focus:outline-none focus:border-orange-500/50',
              'transition-all'
            )}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}

        {/* Machine Filter */}
        {machines.length > 1 && (
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className={cn(
              'px-4 py-2.5 rounded-xl appearance-none cursor-pointer',
              'bg-white/5 border border-white/10',
              'text-white text-sm',
              'focus:outline-none focus:border-orange-500/50',
              'transition-all'
            )}
          >
            <option value="">All machines</option>
            {machines.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Status Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              statusFilter === f.key
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10 hover:text-white/70'
            )}
          >
            {f.label}
            {f.count > 0 && <span className="ml-1.5 opacity-60">{f.count}</span>}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredSessions.map((session, index) => (
            <motion.div
              key={`${session.machineId}-${session.name}`}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15, delay: index * 0.02 }}
            >
              <GlobalSessionCard
                session={session}
                onClick={() => onSelectSession(session.machineId, session.name)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredSessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-lg font-medium text-white/80 mb-2">No sessions found</h3>
            <p className="text-sm text-white/40">
              {searchQuery || statusFilter !== 'all' || projectFilter || machineFilter
                ? 'Try adjusting your filters'
                : 'Start a new session to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
