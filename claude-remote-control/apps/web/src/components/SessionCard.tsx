'use client';

import { forwardRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Clock,
  MessageSquare,
  Shield,
  Circle,
  Loader2,
  X,
  Activity,
  FileText,
  CheckCircle,
  Archive,
  DollarSign,
  Cpu,
  Code,
  GitBranch,
  GitPullRequest,
} from 'lucide-react';
import { type SessionInfo } from '@/lib/notifications';
import { type SessionStatus, type AttentionReason } from '247-shared';
import { ConfirmDialog } from './ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';

interface SessionCardProps {
  session: SessionInfo;
  isActive: boolean;
  isCollapsed: boolean;
  index: number;
  onClick: () => void;
  onKill?: () => Promise<void>;
  onArchive?: () => Promise<void>;
  onPushBranch?: () => Promise<void>;
  onCreatePR?: () => void;
  /** Session has a worktree with a branch */
  hasWorktree?: boolean;
  /** Branch name for display */
  branchName?: string;
  /** Mobile mode - larger touch targets */
  isMobile?: boolean;
}

const statusConfig: Record<
  SessionStatus,
  {
    icon: typeof Zap;
    color: string;
    bgColor: string;
    borderColor: string;
    glow: string;
    label: string;
  }
> = {
  init: {
    icon: Loader2,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    glow: 'shadow-purple-500/20',
    label: 'Starting',
  },
  working: {
    icon: Loader2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
    label: 'Working',
  },
  needs_attention: {
    icon: MessageSquare,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    glow: 'shadow-orange-500/20',
    label: 'Attention',
  },
  idle: {
    icon: Circle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    glow: 'shadow-gray-500/20',
    label: 'Idle',
  },
};

// Icons for specific attention reasons
const attentionIcons: Record<AttentionReason, typeof Zap> = {
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

// Format time since status change
function formatStatusTime(timestamp: number | undefined): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export const SessionCard = forwardRef<HTMLButtonElement, SessionCardProps>(
  (
    {
      session,
      isActive,
      isCollapsed,
      index,
      onClick,
      onKill,
      onArchive,
      onPushBranch,
      onCreatePR,
      hasWorktree,
      branchName,
      isMobile = false,
    },
    ref
  ) => {
    const [showKillConfirm, setShowKillConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [isKilling, setIsKilling] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [isPushing, setIsPushing] = useState(false);
    const [, setTick] = useState(0);

    // Update time display every 10 seconds
    useEffect(() => {
      const interval = setInterval(() => setTick((t) => t + 1), 10000);
      return () => clearInterval(interval);
    }, []);

    const status = session.status as SessionStatus;
    const attentionReason = session.attentionReason as AttentionReason | undefined;
    const config = statusConfig[status] || statusConfig.idle;

    // Use attention-specific icon if available
    const Icon =
      status === 'needs_attention' && attentionReason
        ? attentionIcons[attentionReason]
        : config.icon;

    // Use attention-specific label if available
    const label =
      status === 'needs_attention' && attentionReason
        ? attentionLabels[attentionReason]
        : config.label;

    // Extract readable session name (part after --)
    const displayName = session.name.split('--')[1] || session.name;
    const shortcut = index < 9 ? index + 1 : null;

    // Check if needs attention
    const needsAttention = status === 'needs_attention';
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

    const handlePushClick = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onPushBranch || isPushing) return;
      setIsPushing(true);
      try {
        await onPushBranch();
      } finally {
        setIsPushing(false);
      }
    };

    const handleCreatePRClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onCreatePR?.();
    };

    // Show archive button for "done" sessions (idle or task_complete)
    const canArchive =
      onArchive &&
      (status === 'idle' || (status === 'needs_attention' && attentionReason === 'task_complete'));

    if (isCollapsed) {
      return (
        <>
          <button
            ref={ref}
            onClick={onClick}
            title={`${displayName} - ${config.label}`}
            className={cn(
              'group relative w-full rounded-lg p-2 transition-all',
              'flex items-center justify-center',
              isActive
                ? cn('border bg-white/10', config.borderColor)
                : 'border border-transparent hover:bg-white/5',
              needsAttention && !isActive && 'animate-pulse'
            )}
          >
            <div
              className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bgColor)}
            >
              <Icon
                className={cn('h-4 w-4', config.color, status === 'working' && 'animate-spin')}
              />
            </div>

            {/* Kill button - collapsed mode */}
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

            {/* Active indicator line */}
            {isActive && (
              <motion.div
                layoutId="activeSidebarIndicator"
                className={cn(
                  'absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full',
                  'bg-gradient-to-b from-orange-400 to-orange-600'
                )}
              />
            )}

            {/* Attention pulse ring */}
            {needsAttention && (
              <span className="pointer-events-none absolute inset-0 animate-ping rounded-lg bg-orange-500/20" />
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

    return (
      <>
        <div
          ref={ref as any}
          onClick={onClick}
          className={cn(
            'group relative w-full cursor-pointer rounded-xl p-3 text-left transition-all',
            'touch-manipulation border',
            // Mobile: larger padding and minimum height for touch
            isMobile && 'min-h-[72px] p-4',
            isActive
              ? cn(
                  'bg-gradient-to-r from-white/10 to-white/5',
                  config.borderColor,
                  'shadow-lg',
                  config.glow
                )
              : 'border-transparent hover:border-white/10 hover:bg-white/5',
            needsAttention && !isActive && 'border-orange-500/30 bg-orange-500/5'
          )}
        >
          {/* Action buttons - expanded mode (always visible on mobile) */}
          <div
            className={cn(
              'absolute right-2 top-2 z-10 flex items-center gap-1 transition-opacity',
              // Mobile: always visible; Desktop: show on hover
              isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {/* Git buttons - only show for worktree sessions */}
            {hasWorktree && (
              <>
                {/* Push branch button */}
                {onPushBranch && (
                  <button
                    onClick={handlePushClick}
                    disabled={isPushing}
                    className={cn(
                      'rounded-lg',
                      'bg-transparent text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300',
                      'touch-manipulation transition-all',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-1.5'
                    )}
                    title={branchName ? `Push ${branchName}` : 'Push branch'}
                  >
                    {isPushing ? (
                      <Loader2 className={cn('animate-spin', isMobile ? 'h-5 w-5' : 'h-4 w-4')} />
                    ) : (
                      <GitBranch className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                    )}
                  </button>
                )}
                {/* Create PR button */}
                {onCreatePR && (
                  <button
                    onClick={handleCreatePRClick}
                    className={cn(
                      'rounded-lg',
                      'bg-transparent text-purple-400 hover:bg-purple-500/20 hover:text-purple-300',
                      'touch-manipulation transition-all',
                      isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-1.5'
                    )}
                    title="Create Pull Request"
                  >
                    <GitPullRequest className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
                  </button>
                )}
              </>
            )}
            {/* Archive button */}
            {canArchive && (
              <button
                onClick={handleArchiveClick}
                className={cn(
                  'rounded-lg',
                  'bg-transparent text-gray-400 hover:bg-gray-500/20 hover:text-gray-300',
                  'touch-manipulation transition-all',
                  // Mobile: larger touch target
                  isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-1.5'
                )}
                title="Archive session"
              >
                <Archive className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </button>
            )}
            {/* Kill button */}
            {onKill && (
              <button
                onClick={handleKillClick}
                className={cn(
                  'rounded-lg',
                  'bg-transparent text-red-400 hover:bg-red-500/20 hover:text-red-300',
                  'touch-manipulation transition-all',
                  // Mobile: larger touch target
                  isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-1.5'
                )}
                title="Kill session"
              >
                <X className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
              </button>
            )}
          </div>

          {/* Active indicator line */}
          {isActive && (
            <motion.div
              layoutId="activeSidebarIndicator"
              className={cn(
                'absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full',
                'bg-gradient-to-b from-orange-400 to-orange-600'
              )}
            />
          )}

          <div className="flex items-start gap-3">
            {/* Status Icon with transition animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${status}-${attentionReason}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                  config.bgColor,
                  'border',
                  config.borderColor,
                  needsAttention && 'ring-2 ring-orange-500/40 ring-offset-1 ring-offset-zinc-900'
                )}
              >
                <Icon
                  className={cn('h-5 w-5', config.color, status === 'working' && 'animate-spin')}
                />
              </motion.div>
            </AnimatePresence>

            {/* Content */}
            <div className="min-w-0 flex-1 pr-6">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-white">{displayName}</span>
                {shortcut && (
                  <kbd className="hidden rounded border border-white/10 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/40 group-hover:inline-flex">
                    ⌥{shortcut}
                  </kbd>
                )}
              </div>

              <div className="mt-1 flex items-center gap-2">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`${status}-${attentionReason}`}
                    initial={{ y: -5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 5, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs font-medium',
                      config.bgColor,
                      config.color
                    )}
                  >
                    {label}
                  </motion.span>
                </AnimatePresence>
                {statusTime && (
                  <span className="flex items-center gap-1 text-xs text-white/40">
                    <Activity className="h-3 w-3" />
                    {statusTime}
                  </span>
                )}
              </div>

              {/* Session info */}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="truncate text-xs text-white/30">{session.project}</span>
                <span className="text-white/20">·</span>
                <div className="flex items-center gap-1 text-xs text-white/30">
                  <Clock className="h-3 w-3" />
                  <span>{formatRelativeTime(session.createdAt)}</span>
                </div>
                {branchName && (
                  <span
                    className="flex items-center gap-1 text-cyan-400/60"
                    title={`Branch: ${branchName}`}
                  >
                    <GitBranch className="h-3 w-3" />
                    <span className="max-w-[100px] truncate text-xs">{branchName}</span>
                  </span>
                )}
                {session.statusSource === 'hook' && (
                  <span
                    className="flex items-center gap-0.5 text-emerald-400/60"
                    title="Real-time via WebSocket"
                  >
                    <Zap className="h-3 w-3" />
                  </span>
                )}
              </div>

              {/* StatusLine metrics */}
              {(session.costUsd !== undefined ||
                session.contextUsage !== undefined ||
                session.linesAdded !== undefined ||
                session.linesRemoved !== undefined) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {/* Cost */}
                  {session.costUsd !== undefined && (
                    <span
                      className="flex items-center gap-1 text-emerald-400/70"
                      title="Session cost"
                    >
                      <DollarSign className="h-3 w-3" />
                      {session.costUsd < 0.01 ? '<$0.01' : `$${session.costUsd.toFixed(2)}`}
                    </span>
                  )}
                  {/* Context usage */}
                  {session.contextUsage !== undefined && (
                    <span
                      className={cn(
                        'flex items-center gap-1',
                        session.contextUsage > 80
                          ? 'text-red-400/70'
                          : session.contextUsage > 60
                            ? 'text-yellow-400/70'
                            : 'text-blue-400/70'
                      )}
                      title="Context window usage"
                    >
                      <Cpu className="h-3 w-3" />
                      {session.contextUsage}%
                    </span>
                  )}
                  {/* Lines changed */}
                  {(session.linesAdded !== undefined || session.linesRemoved !== undefined) && (
                    <span
                      className="flex items-center gap-1 text-white/40"
                      title="Lines of code changed"
                    >
                      <Code className="h-3 w-3" />
                      <span className="text-green-400/70">+{session.linesAdded || 0}</span>
                      <span className="text-red-400/70">-{session.linesRemoved || 0}</span>
                    </span>
                  )}
                  {/* Model name */}
                  {session.model && (
                    <span className="text-white/30" title="Model">
                      {session.model}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Attention pulse overlay */}
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

SessionCard.displayName = 'SessionCard';
