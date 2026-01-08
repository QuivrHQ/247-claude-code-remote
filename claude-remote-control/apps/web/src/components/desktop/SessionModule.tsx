'use client';

import { forwardRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Archive,
  Activity,
  Clock,
  Zap,
  Shield,
  MessageSquare,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';
import { StatusRing, statusStyles } from '@/components/ui/StatusRing';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EnvironmentBadge } from '@/components/EnvironmentBadge';
import type { SessionInfo } from '@/lib/notifications';
import type { SessionStatus, AttentionReason } from '@vibecompany/247-shared';

export interface SessionModuleProps {
  session: SessionInfo;
  isActive: boolean;
  isCollapsed: boolean;
  index: number;
  onClick: () => void;
  onKill?: () => Promise<void>;
  onArchive?: () => Promise<void>;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

const statusLabels: Record<SessionStatus, string> = {
  init: 'INIT',
  working: 'WORKING',
  needs_attention: 'WAITING',
  idle: 'IDLE',
};

const _attentionIcons: Record<AttentionReason, typeof MessageSquare> = {
  permission: Shield,
  input: MessageSquare,
  plan_approval: FileText,
  task_complete: CheckCircle,
};

const attentionLabels: Record<AttentionReason, string> = {
  permission: 'PERMISSION',
  input: 'INPUT',
  plan_approval: 'PLAN',
  task_complete: 'DONE',
};

function formatStatusTime(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export const SessionModule = forwardRef<HTMLButtonElement, SessionModuleProps>(
  (
    {
      session,
      isActive,
      isCollapsed,
      index,
      onClick,
      onKill,
      onArchive,
      onMouseEnter,
      onMouseLeave,
    },
    ref
  ) => {
    const [showKillConfirm, setShowKillConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [isKilling, setIsKilling] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [, setTick] = useState(0);

    // Update time display every 10 seconds
    useEffect(() => {
      const interval = setInterval(() => setTick((t) => t + 1), 10000);
      return () => clearInterval(interval);
    }, []);

    const status = session.status as SessionStatus;
    const attentionReason = session.attentionReason as AttentionReason | undefined;
    const styles = statusStyles[status];
    const needsAttention = status === 'needs_attention';

    // Get label based on status/attention
    const statusLabel =
      status === 'needs_attention' && attentionReason
        ? attentionLabels[attentionReason]
        : statusLabels[status];

    // Extract readable session name
    const displayName = session.name.split('--')[1] || session.name;
    const shortcut = index < 9 ? index + 1 : null;
    const statusTime = formatStatusTime(session.lastStatusChange);

    const handleKillClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowKillConfirm(true);
    };

    const handleKillConfirm = async () => {
      if (!onKill) return;
      setIsKilling(true);
      try {
        await onKill();
        setShowKillConfirm(false);
      } finally {
        setIsKilling(false);
      }
    };

    const handleArchiveClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowArchiveConfirm(true);
    };

    const handleArchiveConfirm = async () => {
      if (!onArchive) return;
      setIsArchiving(true);
      try {
        await onArchive();
        setShowArchiveConfirm(false);
      } finally {
        setIsArchiving(false);
      }
    };

    const canArchive =
      onArchive &&
      (status === 'idle' || (status === 'needs_attention' && attentionReason === 'task_complete'));

    // Collapsed mode - Beacon Strip
    if (isCollapsed) {
      return (
        <>
          <button
            ref={ref}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            title={`${displayName} - ${statusLabel}`}
            className={cn(
              'group relative flex w-full items-center justify-center rounded-lg p-2',
              'transition-all',
              isActive
                ? cn('border bg-white/10', styles.border)
                : 'border border-transparent hover:bg-white/5',
              needsAttention && !isActive && 'animate-pulse'
            )}
            data-testid="session-module-collapsed"
          >
            <StatusRing status={status} size={28} showPulse={needsAttention && !isActive} />

            {/* Kill button on hover */}
            {onKill && (
              <button
                onClick={handleKillClick}
                className={cn(
                  'absolute -right-1 -top-1 rounded-full p-1',
                  'bg-red-500/80 text-white hover:bg-red-500',
                  'opacity-0 transition-opacity group-hover:opacity-100',
                  'shadow-lg'
                )}
                title="Kill session"
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="desktopActiveIndicator"
                className={cn(
                  'absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full',
                  'bg-gradient-to-b from-orange-400 to-orange-600'
                )}
              />
            )}
          </button>

          <ConfirmDialog
            open={showKillConfirm}
            onOpenChange={setShowKillConfirm}
            title="Terminate session?"
            description={`This will kill the session "${displayName}" (${session.project}). This action cannot be undone.`}
            confirmText="Terminate"
            variant="destructive"
            onConfirm={handleKillConfirm}
            isLoading={isKilling}
          />
        </>
      );
    }

    // Expanded mode - Full Module
    return (
      <>
        <div
          ref={ref as any}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            'group relative cursor-pointer rounded-lg border p-3',
            'transition-all duration-200',
            isActive
              ? cn(
                  'border-l-2 bg-white/[0.08]',
                  styles.border,
                  'shadow-lg',
                  status === 'working' && 'shadow-cyan-500/10',
                  status === 'needs_attention' && 'shadow-amber-500/10',
                  status === 'init' && 'shadow-purple-500/10'
                )
              : 'border-white/5 hover:border-white/10 hover:bg-white/[0.04]',
            needsAttention && !isActive && 'border-amber-500/20 bg-amber-500/5'
          )}
          data-testid="session-module"
        >
          {/* Action buttons */}
          <div
            className={cn(
              'absolute right-2 top-2 z-10 flex items-center gap-1',
              'opacity-0 transition-opacity group-hover:opacity-100'
            )}
          >
            {canArchive && (
              <button
                onClick={handleArchiveClick}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-500/20 hover:text-gray-300"
                title="Archive session"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            )}
            {onKill && (
              <button
                onClick={handleKillClick}
                className="rounded p-1 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
                title="Kill session"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Active indicator bar */}
          {isActive && (
            <motion.div
              layoutId="desktopActiveIndicator"
              className={cn(
                'absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full',
                'bg-gradient-to-b from-orange-400 to-amber-500'
              )}
            />
          )}

          <div className="flex items-start gap-3">
            {/* Status Ring */}
            <div className="flex-shrink-0 pt-0.5">
              <StatusRing status={status} size={28} showPulse={needsAttention && !isActive} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pr-6">
              {/* Title row */}
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm font-medium text-white">
                  {displayName}
                </span>
                {session.environment && (
                  <EnvironmentBadge
                    provider={session.environment.provider}
                    icon={session.environment.icon}
                    name={session.environment.name}
                    showLabel={false}
                    size="sm"
                  />
                )}
                {shortcut && (
                  <kbd className="hidden rounded border border-white/10 bg-white/10 px-1 py-0.5 font-mono text-[9px] text-white/30 group-hover:inline-flex">
                    ⌥{shortcut}
                  </kbd>
                )}
              </div>

              {/* Metadata row */}
              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-white/30">
                <span className="truncate">{session.project}</span>
                <span className="text-white/15">·</span>
                <Clock className="h-3 w-3" />
                <span>{formatRelativeTime(session.createdAt)}</span>
                {session.statusSource === 'hook' && (
                  <span title="Real-time">
                    <Zap className="h-3 w-3 text-emerald-400/60" />
                  </span>
                )}
              </div>

              {/* Status bar */}
              <div className="mt-2 flex items-center gap-2">
                {/* Status line indicator */}
                <div className="h-px flex-1 bg-white/5">
                  <motion.div
                    className={cn(
                      'h-full',
                      status === 'working' && 'bg-cyan-400/50',
                      status === 'init' && 'bg-purple-400/50',
                      status === 'needs_attention' && 'bg-amber-400/50',
                      status === 'idle' && 'bg-gray-500/30'
                    )}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>

                {/* Status label */}
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`${status}-${attentionReason}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={cn(
                      'flex items-center gap-1 rounded px-1.5 py-0.5',
                      'font-mono text-[9px] font-medium uppercase tracking-wider',
                      styles.bg,
                      status === 'working' && 'text-cyan-300',
                      status === 'init' && 'text-purple-300',
                      status === 'needs_attention' && 'text-amber-300',
                      status === 'idle' && 'text-gray-400'
                    )}
                  >
                    {statusLabel}
                    {statusTime && (
                      <span className="flex items-center gap-0.5 opacity-60">
                        <Activity className="h-2.5 w-2.5" />
                        {statusTime}
                      </span>
                    )}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={showKillConfirm}
          onOpenChange={setShowKillConfirm}
          title="Terminate session?"
          description={`This will kill the session "${displayName}" (${session.project}). This action cannot be undone.`}
          confirmText="Terminate"
          variant="destructive"
          onConfirm={handleKillConfirm}
          isLoading={isKilling}
        />

        <ConfirmDialog
          open={showArchiveConfirm}
          onOpenChange={setShowArchiveConfirm}
          title="Archive session?"
          description={`Archive "${displayName}" (${session.project})? The terminal will be closed but the session will be kept in history.`}
          confirmText="Archive"
          variant="default"
          onConfirm={handleArchiveConfirm}
          isLoading={isArchiving}
        />
      </>
    );
  }
);

SessionModule.displayName = 'SessionModule';
