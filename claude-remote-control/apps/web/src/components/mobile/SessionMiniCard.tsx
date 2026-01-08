'use client';

import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/time';
import { StatusRing } from '@/components/ui/StatusRing';
import type { SessionStatus } from '@vibecompany/247-shared';

export interface SessionMiniCardProps {
  session: {
    name: string;
    project: string;
    status: SessionStatus;
    machineId: string;
    createdAt: number;
  };
  isActive: boolean;
  onClick: () => void;
}

export function SessionMiniCard({ session, isActive, onClick }: SessionMiniCardProps) {
  const displayName = session.name.split('--')[1] || session.name;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      data-testid="session-mini-card"
      data-active={isActive}
      className={cn(
        'relative w-full rounded-xl p-3 text-left transition-all',
        'min-h-[72px] touch-manipulation border',
        isActive
          ? 'border-orange-500/30 bg-white/10 shadow-lg shadow-orange-500/10'
          : 'border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10'
      )}
    >
      <div className="flex items-start gap-2.5">
        <StatusRing status={session.status} size={24} showPulse={!isActive} />

        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm text-white" data-testid="session-name">
            {displayName}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-white/40" data-testid="session-project">
            {session.project}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-white/30">
            <Clock className="h-3 w-3" />
            <span data-testid="session-time">{formatRelativeTime(session.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="mobileActiveSessionIndicator"
          className="absolute bottom-3 left-0 top-3 w-0.5 rounded-r-full bg-gradient-to-b from-orange-400 to-amber-500"
          data-testid="active-indicator"
        />
      )}
    </motion.button>
  );
}
