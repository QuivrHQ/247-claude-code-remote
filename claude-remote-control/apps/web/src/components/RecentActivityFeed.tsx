'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  MessageSquare,
  Shield,
  Circle,
  Clock,
  Zap,
  Activity,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import { type SessionInfo } from '@/lib/notifications';
import { type SessionStatus, type AttentionReason } from '@claude-remote/shared';
import { formatRelativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

interface ActivityItem {
  sessionName: string;
  displayName: string;
  machineId: string;
  machineName: string;
  project: string;
  status: SessionStatus;
  attentionReason?: AttentionReason;
  timestamp: number;
  statusSource?: 'hook' | 'tmux';
}

interface RecentActivityFeedProps {
  onSelectSession: (machineId: string, project: string, sessionName: string) => void;
  limit?: number;
}

const statusConfig: Record<
  SessionStatus,
  {
    icon: typeof Loader2;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  init: {
    icon: Loader2,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    label: 'Starting',
  },
  working: {
    icon: Loader2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    label: 'Working',
  },
  needs_attention: {
    icon: MessageSquare,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    label: 'Attention',
  },
  idle: {
    icon: Circle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    label: 'Idle',
  },
};

// Icons for specific attention reasons
const attentionIcons: Record<AttentionReason, typeof Loader2> = {
  permission: Shield,
  input: MessageSquare,
  plan_approval: FileText,
  task_complete: CheckCircle,
};

const attentionLabels: Record<AttentionReason, string> = {
  permission: 'Permission',
  input: 'Waiting',
  plan_approval: 'Plan Ready',
  task_complete: 'Done',
};

export function RecentActivityFeed({
  onSelectSession,
  limit = 15,
}: RecentActivityFeedProps) {
  const { sessionsByMachine } = useSessionPolling();

  // Aggregate all sessions from all online machines, sorted by activity
  const activityItems = useMemo(() => {
    const items: ActivityItem[] = [];

    sessionsByMachine.forEach((machineData) => {
      for (const session of machineData.sessions) {
        const displayName = session.name.split('--')[1] || session.name;
        items.push({
          sessionName: session.name,
          displayName,
          machineId: machineData.machineId,
          machineName: machineData.machineName,
          project: session.project,
          status: session.status as SessionStatus,
          attentionReason: session.attentionReason as AttentionReason | undefined,
          timestamp: session.lastStatusChange || session.createdAt,
          statusSource: session.statusSource,
        });
      }
    });

    // Sort by timestamp (most recent first)
    items.sort((a, b) => b.timestamp - a.timestamp);

    return items.slice(0, limit);
  }, [sessionsByMachine, limit]);

  // Count items needing attention
  const needsAttentionCount = activityItems.filter(
    (item) => item.status === 'needs_attention'
  ).length;

  if (activityItems.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-white/40" />
          <h3 className="text-sm font-medium text-white/60">Recent Activity</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-white/20" />
          </div>
          <p className="text-sm text-white/30">No recent activity</p>
          <p className="text-xs text-white/20 mt-1">Sessions will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-white/40" />
          <h3 className="text-sm font-medium text-white/60">Recent Activity</h3>
        </div>
        {needsAttentionCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
            {needsAttentionCount} need attention
          </span>
        )}
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <AnimatePresence mode="popLayout">
          {activityItems.map((item, index) => {
            const config = statusConfig[item.status] || statusConfig.idle;
            // Use attention-specific icon if available
            const Icon = item.status === 'needs_attention' && item.attentionReason
              ? attentionIcons[item.attentionReason]
              : config.icon;
            // Use attention-specific label if available
            const label = item.status === 'needs_attention' && item.attentionReason
              ? attentionLabels[item.attentionReason]
              : config.label;
            const needsAttention = item.status === 'needs_attention';

            return (
              <motion.button
                key={`${item.machineId}-${item.sessionName}`}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15, delay: index * 0.02 }}
                onClick={() => onSelectSession(item.machineId, item.project, item.sessionName)}
                className={cn(
                  'w-full p-3 rounded-xl text-left transition-all group',
                  'border',
                  needsAttention
                    ? 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10'
                    : 'bg-white/[0.02] border-transparent hover:bg-white/5 hover:border-white/10'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      config.bgColor
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4',
                        config.color,
                        item.status === 'working' && 'animate-spin'
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white truncate">
                        {item.displayName}
                      </span>
                      {item.statusSource === 'hook' && (
                        <Zap className="w-3 h-3 text-emerald-400/60 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/40 truncate">
                        {item.machineName}
                      </span>
                      <span className="text-white/20">·</span>
                      <span className="text-xs text-white/30 truncate">
                        {item.project}
                      </span>
                    </div>
                  </div>

                  {/* Time & Status */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-white/30">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        config.bgColor,
                        config.color
                      )}
                    >
                      {label}
                    </span>
                  </div>
                </div>

                {/* Attention pulse */}
                {needsAttention && (
                  <div className="absolute inset-0 rounded-xl border border-orange-500/30 animate-pulse pointer-events-none" />
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
