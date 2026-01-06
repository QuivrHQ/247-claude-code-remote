'use client';

import { forwardRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clock, MessageSquare, Shield, CheckCircle, Circle, Loader2, X, Activity } from 'lucide-react';
import { type SessionInfo } from '@/lib/notifications';
import { type SessionStatus } from './ui/status-badge';
import { ConfirmDialog } from './ui/confirm-dialog';
import { EnvironmentBadge } from './EnvironmentBadge';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';

interface SessionCardProps {
  session: SessionInfo;
  isActive: boolean;
  isCollapsed: boolean;
  index: number;
  onClick: () => void;
  onKill?: () => Promise<void>;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
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
  running: {
    icon: Loader2,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    glow: 'shadow-blue-500/20',
    label: 'Running',
  },
  waiting: {
    icon: MessageSquare,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    glow: 'shadow-orange-500/20',
    label: 'Waiting',
  },
  permission: {
    icon: Shield,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    glow: 'shadow-purple-500/20',
    label: 'Permission',
  },
  stopped: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20',
    label: 'Done',
  },
  ended: {
    icon: Circle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    glow: 'shadow-gray-500/20',
    label: 'Ended',
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
  ({ session, isActive, isCollapsed, index, onClick, onKill, onMouseEnter, onMouseLeave }, ref) => {
    const [showKillConfirm, setShowKillConfirm] = useState(false);
    const [isKilling, setIsKilling] = useState(false);
    const [, setTick] = useState(0);

    // Update time display every 10 seconds
    useEffect(() => {
      const interval = setInterval(() => setTick((t) => t + 1), 10000);
      return () => clearInterval(interval);
    }, []);

    const status = session.status as SessionStatus;
    const config = statusConfig[status] || statusConfig.idle;
    const Icon = config.icon;

    // Extract readable session name (part after --)
    const displayName = session.name.split('--')[1] || session.name;
    const shortcut = index < 9 ? index + 1 : null;

    // Check if needs attention
    const needsAttention = ['waiting', 'permission'].includes(status);
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

    if (isCollapsed) {
      return (
        <>
          <button
            ref={ref}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            title={`${displayName} - ${config.label}`}
            className={cn(
              'relative w-full p-2 rounded-lg transition-all group',
              'flex items-center justify-center',
              isActive
                ? cn('bg-white/10 border', config.borderColor)
                : 'hover:bg-white/5 border border-transparent',
              needsAttention && !isActive && 'animate-pulse'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                config.bgColor
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4',
                  config.color,
                  status === 'running' && 'animate-spin'
                )}
              />
            </div>

            {/* Kill button - collapsed mode */}
            {onKill && (
              <button
                onClick={handleKillClick}
                className={cn(
                  'absolute -top-1 -right-1 p-1 rounded-full',
                  'bg-red-500/80 hover:bg-red-500 text-white',
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  'shadow-lg'
                )}
                title="Kill session"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Active indicator line */}
            {isActive && (
              <motion.div
                layoutId="activeSidebarIndicator"
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full',
                  'bg-gradient-to-b from-orange-400 to-orange-600'
                )}
              />
            )}

            {/* Attention pulse ring */}
            {needsAttention && (
              <span className="absolute inset-0 rounded-lg animate-ping bg-orange-500/20 pointer-events-none" />
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
        <button
          ref={ref}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            'relative w-full p-3 rounded-xl transition-all group text-left',
            'border',
            isActive
              ? cn(
                  'bg-gradient-to-r from-white/10 to-white/5',
                  config.borderColor,
                  'shadow-lg',
                  config.glow
                )
              : 'border-transparent hover:bg-white/5 hover:border-white/10',
            needsAttention && !isActive && 'border-orange-500/30 bg-orange-500/5'
          )}
        >
          {/* Kill button - expanded mode */}
          {onKill && (
            <button
              onClick={handleKillClick}
              className={cn(
                'absolute top-2 right-2 p-1.5 rounded-lg',
                'bg-red-500/0 hover:bg-red-500/20 text-red-400/0 hover:text-red-400',
                'opacity-0 group-hover:opacity-100 transition-all',
                'z-10'
              )}
              title="Kill session"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Active indicator line */}
          {isActive && (
            <motion.div
              layoutId="activeSidebarIndicator"
              className={cn(
                'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full',
                'bg-gradient-to-b from-orange-400 to-orange-600'
              )}
            />
          )}

          <div className="flex items-start gap-3">
            {/* Status Icon with transition animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={status}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  config.bgColor,
                  'border',
                  config.borderColor,
                  needsAttention && 'ring-2 ring-orange-500/40 ring-offset-1 ring-offset-zinc-900'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5',
                    config.color,
                    status === 'running' && 'animate-spin'
                  )}
                />
              </motion.div>
            </AnimatePresence>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-white truncate">
                  {displayName}
                </span>
                {session.environment && (
                  <EnvironmentBadge
                    provider={session.environment.provider}
                    showLabel={false}
                    size="sm"
                  />
                )}
                {shortcut && (
                  <kbd className="hidden group-hover:inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded text-white/40 border border-white/10">
                    ⌘{shortcut}
                  </kbd>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={status}
                    initial={{ y: -5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 5, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded font-medium',
                      config.bgColor,
                      config.color
                    )}
                  >
                    {config.label}
                  </motion.span>
                </AnimatePresence>
                {statusTime && (
                  <span className="text-xs text-white/40 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {statusTime}
                  </span>
                )}
              </div>

              {/* Session info */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-white/30 truncate">
                  {session.project}
                </span>
                <span className="text-white/20">·</span>
                <div className="flex items-center gap-1 text-xs text-white/30">
                  <Clock className="w-3 h-3" />
                  <span>{formatRelativeTime(session.createdAt)}</span>
                </div>
                {session.statusSource === 'hook' && (
                  <span className="flex items-center gap-0.5 text-emerald-400/60" title="Real-time via WebSocket">
                    <Zap className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Attention pulse overlay */}
          {needsAttention && !isActive && (
            <div className="absolute inset-0 rounded-xl border border-orange-500/40 animate-pulse pointer-events-none" />
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
);

SessionCard.displayName = 'SessionCard';
