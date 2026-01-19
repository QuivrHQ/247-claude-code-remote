'use client';

import { forwardRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Circle, X, Archive, DollarSign, AlertCircle } from 'lucide-react';
import { type SessionInfo } from '@/lib/types';
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
  /** Mobile mode - larger touch targets */
  isMobile?: boolean;
}

export const SessionCard = forwardRef<HTMLButtonElement, SessionCardProps>(
  (
    { session, isActive, isCollapsed, index, onClick, onKill, onArchive, isMobile = false },
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

    // Extract readable session name (part after --)
    const displayName = session.name.split('--')[1] || session.name;
    const shortcut = index < 9 ? index + 1 : null;

    // Check if session needs attention
    const needsAttention = session.status === 'needs_attention';
    const attentionLabel =
      session.attentionReason === 'permission'
        ? 'Permission requise'
        : session.attentionReason === 'input'
          ? 'Input attendu'
          : session.attentionReason === 'plan_approval'
            ? 'Approbation requise'
            : 'Attention requise';

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

    if (isCollapsed) {
      return (
        <>
          <button
            ref={ref}
            onClick={onClick}
            title={displayName}
            className={cn(
              'group relative w-full rounded-lg p-2 transition-all',
              'flex items-center justify-center',
              isActive
                ? 'border border-orange-500/30 bg-white/10'
                : 'border border-transparent hover:bg-white/5'
            )}
          >
            <div
              className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-lg',
                needsAttention ? 'bg-orange-500/20' : 'bg-white/5'
              )}
            >
              {needsAttention ? (
                <>
                  <AlertCircle className="h-4 w-4 text-orange-400" />
                  <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
                  </span>
                </>
              ) : (
                <Circle className="h-4 w-4 text-white/40" />
              )}
            </div>

            {/* Kill button - collapsed mode */}
            {onKill && (
              <button
                onClick={handleKillClick}
                className={cn(
                  'absolute -right-1 -top-1 rounded-full p-1',
                  'bg-red-500/80 text-white hover:bg-red-500',
                  'opacity-0 transition-opacity group-hover:opacity-100',
                  'shadow-lg',
                  'focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-white/50'
                )}
                aria-label="Kill session"
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
          aria-label={`Session ${displayName} - ${session.project}`}
          className={cn(
            'group relative w-full rounded-xl p-3 text-left transition-all',
            'touch-manipulation border',
            // Mobile: larger padding and minimum height for touch
            isMobile && 'min-h-[72px] p-4',
            isActive
              ? 'border-orange-500/30 bg-gradient-to-r from-white/10 to-white/5 shadow-lg shadow-orange-500/20'
              : needsAttention
                ? 'border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/10'
                : 'border-transparent hover:border-white/10 hover:bg-white/5',
            'focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d14]'
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
            {/* Archive button */}
            {onArchive && (
              <button
                onClick={handleArchiveClick}
                className={cn(
                  'rounded-lg',
                  'bg-transparent text-gray-400 hover:bg-gray-500/20 hover:text-gray-300',
                  'touch-manipulation transition-all',
                  'focus-visible:ring-1 focus-visible:ring-orange-500/50',
                  // Mobile: larger touch target
                  isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-1.5'
                )}
                aria-label="Archive session"
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
                  'focus-visible:ring-1 focus-visible:ring-orange-500/50',
                  // Mobile: larger touch target
                  isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-1.5'
                )}
                aria-label="Kill session"
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
            {/* Session Icon */}
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
                  needsAttention
                    ? 'border border-orange-500/30 bg-orange-500/20'
                    : 'border border-white/10 bg-white/5'
                )}
              >
                {needsAttention ? (
                  <>
                    <AlertCircle className="h-5 w-5 text-orange-400" />
                    <span className="absolute -right-1 -top-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500" />
                    </span>
                  </>
                ) : (
                  <Circle className="h-5 w-5 text-white/40" />
                )}
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

              {/* Session info */}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="truncate text-xs text-white/30">{session.project}</span>
                <span className="text-white/20">·</span>
                <div className="flex items-center gap-1 text-xs text-white/30">
                  <Clock className="h-3 w-3" />
                  <span>{formatRelativeTime(session.createdAt)}</span>
                </div>
              </div>

              {/* Attention indicator */}
              {needsAttention && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-400">
                    <AlertCircle className="h-3 w-3" />
                    {attentionLabel}
                  </span>
                </div>
              )}

              {/* StatusLine metrics */}
              {session.costUsd !== undefined && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {/* Cost */}
                  <span
                    className="flex items-center gap-1 text-emerald-400/70"
                    title="Session cost"
                  >
                    <DollarSign className="h-3 w-3" />
                    {session.costUsd < 0.01 ? '<$0.01' : `$${session.costUsd.toFixed(2)}`}
                  </span>
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
