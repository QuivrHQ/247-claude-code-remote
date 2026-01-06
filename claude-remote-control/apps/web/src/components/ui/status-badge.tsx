'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type SessionStatus = 'running' | 'waiting' | 'permission' | 'stopped' | 'ended' | 'idle';

const statusConfig: Record<
  SessionStatus,
  { label: string; description: string; className: string; dotClassName: string }
> = {
  running: {
    label: 'Running',
    description: 'Claude is actively working on the task',
    className: 'bg-blue-500/15 text-blue-300 border border-blue-500/40',
    dotClassName: 'bg-blue-400 animate-pulse',
  },
  waiting: {
    label: 'Waiting',
    description: 'Claude is waiting for your input',
    className: 'bg-orange-500/15 text-orange-300 border border-orange-500/40',
    dotClassName: 'bg-orange-400',
  },
  permission: {
    label: 'Permission',
    description: 'Claude needs your authorization to proceed',
    className: 'bg-purple-500/15 text-purple-300 border border-purple-500/40',
    dotClassName: 'bg-purple-400 animate-pulse',
  },
  stopped: {
    label: 'Done',
    description: 'Task completed successfully',
    className: 'bg-green-500/15 text-green-300 border border-green-500/40',
    dotClassName: 'bg-green-400',
  },
  ended: {
    label: 'Ended',
    description: 'Session has ended',
    className: 'bg-gray-500/15 text-gray-400 border border-gray-500/40',
    dotClassName: 'bg-gray-500',
  },
  idle: {
    label: 'Idle',
    description: 'Session is idle, no active task',
    className: 'bg-gray-500/15 text-gray-400 border border-gray-500/40',
    dotClassName: 'bg-gray-400',
  },
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: SessionStatus;
  showDot?: boolean;
  showLabel?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
}

export function StatusBadge({
  status,
  showDot = true,
  showLabel = true,
  showTooltip = true,
  size = 'sm',
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  const badge = (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-medium transition-colors',
        'hover:brightness-110',
        sizeClasses,
        config.className,
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn('w-2 h-2 rounded-full', config.dotClassName)}
          aria-hidden="true"
        />
      )}
      {showLabel && config.label}
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: SessionStatus;
  count: number;
  showTooltip?: boolean;
}

export function CountBadge({ status, count, showTooltip = true, className, ...props }: CountBadgeProps) {
  if (count === 0) return null;

  const config = statusConfig[status];
  const labels: Record<SessionStatus, string> = {
    running: 'running',
    waiting: 'waiting',
    permission: 'permission',
    stopped: 'done',
    ended: 'ended',
    idle: 'idle',
  };

  const badge = (
    <span
      role="status"
      aria-label={`${count} ${labels[status]}`}
      className={cn(
        'px-2 py-0.5 rounded text-xs font-medium transition-colors',
        'hover:brightness-110',
        config.className,
        className
      )}
      {...props}
    >
      {count} {labels[status]}
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{count} session{count > 1 ? 's' : ''} {labels[status]}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
