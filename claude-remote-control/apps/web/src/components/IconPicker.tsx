'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Globe,
  Bot,
  Brain,
  Cpu,
  Server,
  Cloud,
  Rocket,
  FlaskConical,
  Code,
  Bug,
  Wrench,
  Shield,
  Lock,
  Star,
  Sparkles,
  Flame,
  Moon,
  Sun,
  Leaf,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ENVIRONMENT_ICON_OPTIONS,
  DEFAULT_PROVIDER_ICONS,
  type EnvironmentIcon,
  type EnvironmentProvider,
} from '@claude-remote/shared';

// Map icon names to Lucide components
const iconMap: Record<EnvironmentIcon, LucideIcon> = {
  zap: Zap,
  globe: Globe,
  bot: Bot,
  brain: Brain,
  cpu: Cpu,
  server: Server,
  cloud: Cloud,
  rocket: Rocket,
  flask: FlaskConical,
  code: Code,
  bug: Bug,
  wrench: Wrench,
  shield: Shield,
  lock: Lock,
  star: Star,
  sparkles: Sparkles,
  flame: Flame,
  moon: Moon,
  sun: Sun,
  leaf: Leaf,
};

/**
 * Get the Lucide icon component for an icon name
 * Falls back to Zap if not found
 */
export function getIconComponent(iconName: string | null | undefined): LucideIcon {
  if (iconName && iconName in iconMap) {
    return iconMap[iconName as EnvironmentIcon];
  }
  return Zap;
}

/**
 * Get the effective icon for an environment (custom or provider default)
 */
export function getEffectiveIcon(
  icon: string | null | undefined,
  provider: EnvironmentProvider
): EnvironmentIcon {
  return (icon as EnvironmentIcon) ?? DEFAULT_PROVIDER_ICONS[provider];
}

interface IconPickerProps {
  value: EnvironmentIcon | null;
  onChange: (icon: EnvironmentIcon | null) => void;
  provider: EnvironmentProvider;
  className?: string;
}

export function IconPicker({ value, onChange, provider, className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveIcon = getEffectiveIcon(value, provider);
  const CurrentIcon = getIconComponent(effectiveIcon);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          'bg-white/5 border border-white/10',
          'hover:bg-white/10 hover:border-white/20 transition-all',
          'focus:outline-none focus:ring-2 focus:ring-orange-500/50'
        )}
      >
        <CurrentIcon className="w-5 h-5 text-orange-400" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full left-0 mt-2 z-50',
              'bg-[#12121a] border border-white/10 rounded-xl p-3',
              'shadow-xl shadow-black/50',
              'grid grid-cols-5 gap-2',
              'min-w-[220px]'
            )}
          >
            {ENVIRONMENT_ICON_OPTIONS.map((iconName) => {
              const Icon = iconMap[iconName];
              const isSelected = value === iconName || (!value && iconName === DEFAULT_PROVIDER_ICONS[provider]);
              const isProviderDefault = iconName === DEFAULT_PROVIDER_ICONS[provider];

              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    // If selecting provider default, store null
                    onChange(isProviderDefault ? null : iconName);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center flex-shrink-0',
                    'transition-all relative',
                    isSelected
                      ? 'bg-orange-500/20 border border-orange-500/50'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                  )}
                  title={iconName + (isProviderDefault ? ' (default)' : '')}
                >
                  <Icon
                    className={cn('w-4 h-4', isSelected ? 'text-orange-400' : 'text-white/60')}
                  />
                  {isProviderDefault && !value && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
