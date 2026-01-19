'use client';

import { forwardRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Archive, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { SessionInfo } from '@/lib/types';

export interface SessionModuleProps {
  session: SessionInfo;
  isActive: boolean;
  isCollapsed: boolean;
  index: number;
  onClick: () => void;
  onKill?: () => Promise<void>;
  onArchive?: () => Promise<void>;
}

export const SessionModule = forwardRef<HTMLButtonElement, SessionModuleProps>(
  ({ session, isActive, isCollapsed, index, onClick, onKill, onArchive }, ref) => {
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

    // Extract readable session name
    const displayName = session.name.split('--')[1] || session.name;
    const shortcut = index < 9 ? index + 1 : null;

    // Check if session needs attention
    const needsAttention = session.status === 'needs_attention';

    // Map attention reason to display label (front-end decides how to display)
    const getAttentionLabel = (reason?: string): string => {
      if (!reason) return 'Attention requise';

      const labels: Record<string, string> = {
        // Claude Code notification_type values
        permission_prompt: 'Permission requise',
        input_request: 'Input attendu',
        plan_mode: 'Approbation du plan',
        task_complete: 'Tâche terminée',
        // Stop hook value
        input: 'Input attendu',
        // Legacy values (for backwards compat)
        permission: 'Permission requise',
        plan_approval: 'Approbation requise',
      };

      return labels[reason] || `Attention: ${reason}`;
    };

    const attentionLabel = getAttentionLabel(session.attentionReason);

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

    // Collapsed mode - Beacon Strip
    if (isCollapsed) {
      return (
        <>
          <button
            ref={ref}
            onClick={onClick}
            title={displayName}
            className={cn(
              'group relative flex w-full items-center justify-center rounded-lg p-2',
              'transition-all',
              isActive
                ? 'border border-orange-500/30 bg-white/10'
                : needsAttention
                  ? 'border border-orange-500/50 bg-orange-500/10'
                  : 'border border-transparent hover:bg-white/5'
            )}
            data-testid="session-module-collapsed"
          >
            {/* Session indicator - shows alert when needs attention */}
            {needsAttention ? (
              <div className="relative flex h-7 w-7 items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-400" />
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  'h-7 w-7 rounded-full',
                  isActive ? 'bg-orange-500/30' : 'bg-white/10'
                )}
              />
            )}

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
          className={cn(
            'group relative cursor-pointer rounded-lg border p-3',
            'transition-all duration-200',
            isActive
              ? 'border-l-2 border-orange-500/30 bg-white/[0.08] shadow-lg'
              : needsAttention
                ? 'border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/10'
                : 'border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
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
            {onArchive && (
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
            {/* Session indicator - shows alert when needs attention */}
            <div className="flex-shrink-0 pt-0.5">
              {needsAttention ? (
                <div className="relative flex h-7 w-7 items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-orange-400" />
                  <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
                  </span>
                </div>
              ) : (
                <div
                  className={cn(
                    'h-7 w-7 rounded-full',
                    isActive ? 'bg-orange-500/30' : 'bg-white/10'
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pr-6">
              {/* Title row */}
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm font-medium text-white">
                  {displayName}
                </span>
                {shortcut && (
                  <kbd className="hidden rounded border border-white/10 bg-white/10 px-1 py-0.5 font-mono text-[9px] text-white/30 group-hover:inline-flex">
                    {shortcut}
                  </kbd>
                )}
              </div>

              {/* Metadata row */}
              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-white/30">
                <span className="truncate">{session.project}</span>
                <span className="text-white/15">·</span>
                <Clock className="h-3 w-3" />
                <span>{formatRelativeTime(session.createdAt)}</span>
              </div>

              {/* Attention indicator */}
              {needsAttention && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                    <AlertCircle className="h-3 w-3" />
                    {attentionLabel}
                  </span>
                </div>
              )}
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
