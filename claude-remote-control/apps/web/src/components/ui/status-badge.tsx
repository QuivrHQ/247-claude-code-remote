'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type SessionStatus = 'running' | 'waiting' | 'permission' | 'stopped' | 'ended' | 'idle';

const statusConfig: Record<
  SessionStatus,
  { label: string; className: string; dotClassName: string }
> = {
  running: {
    label: 'Running',
    className: 'bg-blue-500/20 text-blue-400',
    dotClassName: 'bg-blue-400 animate-pulse',
  },
  waiting: {
    label: 'Waiting',
    className: 'bg-orange-500/20 text-orange-400',
    dotClassName: 'bg-orange-400',
  },
  permission: {
    label: 'Permission',
    className: 'bg-purple-500/20 text-purple-400',
    dotClassName: 'bg-purple-400 animate-pulse',
  },
  stopped: {
    label: 'Done',
    className: 'bg-green-500/20 text-green-400',
    dotClassName: 'bg-green-400',
  },
  ended: {
    label: 'Ended',
    className: 'bg-gray-600/20 text-gray-500',
    dotClassName: 'bg-gray-500',
  },
  idle: {
    label: 'Idle',
    className: 'bg-gray-500/20 text-gray-400',
    dotClassName: 'bg-gray-400',
  },
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: SessionStatus;
  showDot?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function StatusBadge({
  status,
  showDot = true,
  showLabel = true,
  size = 'sm',
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-medium',
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
}

export interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: SessionStatus;
  count: number;
}

export function CountBadge({ status, count, className, ...props }: CountBadgeProps) {
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

  return (
    <span
      role="status"
      aria-label={`${count} ${labels[status]}`}
      className={cn(
        'px-2 py-0.5 rounded text-xs font-medium',
        config.className,
        className
      )}
      {...props}
    >
      {count} {labels[status]}
    </span>
  );
}
