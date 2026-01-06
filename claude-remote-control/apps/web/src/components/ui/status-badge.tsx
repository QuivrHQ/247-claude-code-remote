'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SessionStatus, AttentionReason } from '@claude-remote/shared';

// Re-export types for convenience
export type { SessionStatus, AttentionReason };

const statusConfig: Record<
  SessionStatus,
  { label: string; description: string; className: string; dotClassName: string }
> = {
  init: {
    label: 'Starting',
    description: 'Session starting up',
    className: 'bg-purple-500/15 text-purple-300 border border-purple-500/40',
    dotClassName: 'bg-purple-400 animate-pulse',
  },
  working: {
    label: 'Working',
    description: 'Claude is actively processing',
    className: 'bg-blue-500/15 text-blue-300 border border-blue-500/40',
    dotClassName: 'bg-blue-400 animate-pulse',
  },
  needs_attention: {
    label: 'Attention',
    description: 'Claude needs your input',
    className: 'bg-orange-500/15 text-orange-300 border border-orange-500/40',
    dotClassName: 'bg-orange-400 animate-pulse',
  },
  idle: {
    label: 'Idle',
    description: 'No active Claude session',
    className: 'bg-gray-500/15 text-gray-400 border border-gray-500/40',
    dotClassName: 'bg-gray-400',
  },
};

// More specific descriptions based on attention reason
const attentionDescriptions: Record<AttentionReason, string> = {
  permission: 'Claude needs permission to use a tool',
  input: 'Claude is waiting for your input',
  plan_approval: 'Claude has a plan to approve',
  task_complete: 'Claude has finished the task',
};

const attentionLabels: Record<AttentionReason, string> = {
  permission: 'Permission',
  input: 'Waiting',
  plan_approval: 'Plan Ready',
  task_complete: 'Done',
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: SessionStatus;
  attentionReason?: AttentionReason;
  showDot?: boolean;
  showLabel?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
}

export function StatusBadge({
  status,
  attentionReason,
  showDot = true,
  showLabel = true,
  showTooltip = true,
  size = 'sm',
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  // Use attention-specific label if available
  const label = status === 'needs_attention' && attentionReason
    ? attentionLabels[attentionReason]
    : config.label;

  // Use attention-specific description if available
  const description = status === 'needs_attention' && attentionReason
    ? attentionDescriptions[attentionReason]
    : config.description;

  const badge = (
    <span
      role="status"
      aria-label={`Status: ${label}`}
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
      {showLabel && label}
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
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
    init: 'starting',
    working: 'working',
    needs_attention: 'need attention',
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
