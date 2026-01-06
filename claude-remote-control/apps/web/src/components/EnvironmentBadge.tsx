'use client';

import { cn } from '@/lib/utils';
import type { EnvironmentProvider, EnvironmentIcon } from '@claude-remote/shared';
import { DEFAULT_PROVIDER_ICONS } from '@claude-remote/shared';
import { getIconComponent } from './IconPicker';

const providerColors: Record<EnvironmentProvider, { color: string; bg: string }> = {
  anthropic: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
  },
  openrouter: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
};

interface EnvironmentBadgeProps {
  provider: EnvironmentProvider;
  icon?: EnvironmentIcon | string | null;
  name?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function EnvironmentBadge({
  provider,
  icon,
  name,
  size = 'sm',
  showLabel = true,
  className,
}: EnvironmentBadgeProps) {
  const colors = providerColors[provider];
  // Use custom icon or fall back to provider default
  const effectiveIcon = icon ?? DEFAULT_PROVIDER_ICONS[provider];
  const Icon = getIconComponent(effectiveIcon);

  if (!showLabel) {
    // Icon only mode
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-md border',
          colors.bg,
          size === 'sm' ? 'w-5 h-5' : 'w-6 h-6',
          className
        )}
        title={name || provider}
      >
        <Icon className={cn(colors.color, size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border',
        colors.bg,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className
      )}
    >
      <Icon className={cn(colors.color, size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
      <span className={cn('font-medium', colors.color)}>{name || provider}</span>
    </div>
  );
}
