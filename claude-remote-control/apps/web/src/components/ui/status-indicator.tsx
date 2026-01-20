'use client';

import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type SessionStatus =
  | 'working'
  | 'needs_attention'
  | 'permission'
  | 'idle'
  | 'success'
  | 'error'
  | 'init';

export type ConnectionStatus = 'online' | 'offline' | 'connecting';

interface StatusConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  pulse: boolean;
  label: string;
  glow?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const sessionStatusConfig: Record<SessionStatus, StatusConfig> = {
  working: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
    pulse: true,
    label: 'Working',
    glow: 'shadow-[0_0_8px_rgba(59,130,246,0.5)]',
  },
  needs_attention: {
    color: 'bg-orange-500',
    bgColor: 'bg-orange-500/15',
    borderColor: 'border-orange-500/30',
    pulse: true,
    label: 'Needs input',
    glow: 'shadow-[0_0_8px_rgba(249,115,22,0.5)]',
  },
  permission: {
    color: 'bg-purple-500',
    bgColor: 'bg-purple-500/15',
    borderColor: 'border-purple-500/30',
    pulse: true,
    label: 'Permission',
    glow: 'shadow-[0_0_8px_rgba(168,85,247,0.5)]',
  },
  idle: {
    color: 'bg-gray-500',
    bgColor: 'bg-gray-500/15',
    borderColor: 'border-gray-500/30',
    pulse: false,
    label: 'Idle',
  },
  success: {
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/30',
    pulse: false,
    label: 'Done',
    glow: 'shadow-[0_0_8px_rgba(52,211,153,0.5)]',
  },
  error: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    pulse: false,
    label: 'Error',
  },
  init: {
    color: 'bg-gray-400',
    bgColor: 'bg-gray-400/15',
    borderColor: 'border-gray-400/30',
    pulse: false,
    label: 'Starting',
  },
};

const connectionStatusConfig: Record<ConnectionStatus, StatusConfig> = {
  online: {
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/30',
    pulse: false,
    label: 'Online',
    glow: 'shadow-[0_0_6px_rgba(52,211,153,0.4)]',
  },
  offline: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    pulse: false,
    label: 'Offline',
  },
  connecting: {
    color: 'bg-amber-500',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30',
    pulse: true,
    label: 'Connecting',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// StatusDot Component
// ═══════════════════════════════════════════════════════════════════════════

interface StatusDotProps {
  status: SessionStatus | ConnectionStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showGlow?: boolean;
}

const sizeClasses = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export function StatusDot({ status, size = 'md', className, showGlow = true }: StatusDotProps) {
  const config =
    status in sessionStatusConfig
      ? sessionStatusConfig[status as SessionStatus]
      : connectionStatusConfig[status as ConnectionStatus];

  return (
    <span className={cn('relative inline-flex', className)}>
      {/* Main dot */}
      <span
        className={cn(sizeClasses[size], 'rounded-full', config.color, showGlow && config.glow)}
      />
      {/* Pulse ring */}
      {config.pulse && (
        <span
          className={cn('absolute inset-0 animate-ping rounded-full', config.color, 'opacity-75')}
          style={{ animationDuration: '1.5s' }}
        />
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// StatusBadge Component
// ═══════════════════════════════════════════════════════════════════════════

interface StatusBadgeProps {
  status: SessionStatus | ConnectionStatus;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'md', showDot = true, className }: StatusBadgeProps) {
  const config =
    status in sessionStatusConfig
      ? sessionStatusConfig[status as SessionStatus]
      : connectionStatusConfig[status as ConnectionStatus];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium',
        config.bgColor,
        config.borderColor,
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        className
      )}
    >
      {showDot && <StatusDot status={status} size="xs" showGlow={false} />}
      <span
        style={{
          color: `var(--status-${status === 'needs_attention' ? 'attention' : status})`,
        }}
      >
        {config.label}
      </span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper to get status config
// ═══════════════════════════════════════════════════════════════════════════
