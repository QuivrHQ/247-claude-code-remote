'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { SessionStatus } from '@vibecompany/247-shared';

export interface StatusRingProps {
  status: SessionStatus;
  size?: number;
  showPulse?: boolean;
}

const statusStyles: Record<
  SessionStatus,
  {
    ring: string;
    fill: string;
    glow: string;
    border: string;
    bg: string;
  }
> = {
  init: {
    ring: 'stroke-purple-400',
    fill: 'fill-purple-400',
    glow: 'drop-shadow-[0_0_4px_rgba(168,85,247,0.5)]',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
  },
  working: {
    ring: 'stroke-cyan-400',
    fill: 'fill-cyan-400',
    glow: 'drop-shadow-[0_0_4px_rgba(34,211,238,0.5)]',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/10',
  },
  needs_attention: {
    ring: 'stroke-amber-400',
    fill: 'fill-amber-400',
    glow: 'drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
  },
  idle: {
    ring: 'stroke-gray-500',
    fill: 'fill-gray-500',
    glow: '',
    border: 'border-gray-500/30',
    bg: 'bg-gray-500/10',
  },
};

export function StatusRing({ status, size = 20, showPulse = true }: StatusRingProps) {
  const styles = statusStyles[status];
  const isAnimating = status === 'working' || status === 'init';
  const needsAttention = status === 'needs_attention';

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      data-testid="status-ring"
      data-status={status}
    >
      {/* Pulse effect for attention */}
      {needsAttention && showPulse && (
        <motion.div
          className="absolute inset-0 rounded-full bg-amber-400/30"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          data-testid="status-ring-pulse"
        />
      )}

      <svg viewBox="0 0 20 20" className={cn('h-full w-full', styles.glow)}>
        {/* Background ring */}
        <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2" className="stroke-white/10" />

        {/* Animated progress ring */}
        <motion.circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className={styles.ring}
          strokeDasharray={isAnimating ? '20 30' : '50 0'}
          animate={isAnimating ? { rotate: 360 } : {}}
          transition={isAnimating ? { duration: 1.5, repeat: Infinity, ease: 'linear' } : {}}
          style={{ transformOrigin: 'center' }}
          data-testid="status-ring-circle"
        />

        {/* Center dot */}
        <circle cx="10" cy="10" r="3" className={styles.fill} data-testid="status-ring-dot" />
      </svg>
    </div>
  );
}

// Export status styles for use in other components
export { statusStyles };
