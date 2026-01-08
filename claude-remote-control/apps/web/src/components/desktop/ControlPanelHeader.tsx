'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusRing, statusStyles } from '@/components/ui/StatusRing';
import type { SessionStatus } from '@vibecompany/247-shared';

export interface ControlPanelHeaderProps {
  activeSessions: number;
  waitingSessions: number;
  idleSessions: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface StatusGaugeProps {
  label: string;
  count: number;
  status: SessionStatus;
}

function StatusGauge({ label, count, status }: StatusGaugeProps) {
  const styles = statusStyles[status];

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg p-2',
        'border border-white/5 bg-white/[0.02]',
        'transition-all hover:border-white/10 hover:bg-white/5',
        count > 0 && styles.border,
        count > 0 && 'bg-white/5'
      )}
      data-testid={`gauge-${status}`}
    >
      <div className="relative">
        <StatusRing
          status={count > 0 ? status : 'idle'}
          size={24}
          showPulse={status === 'needs_attention' && count > 0}
        />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center',
              'rounded-full text-[10px] font-bold',
              styles.bg,
              status === 'working' && 'text-cyan-300',
              status === 'needs_attention' && 'text-amber-300',
              status === 'idle' && 'text-gray-400'
            )}
          >
            {count}
          </motion.span>
        )}
      </div>
      <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">{label}</span>
    </div>
  );
}

export function ControlPanelHeader({
  activeSessions,
  waitingSessions,
  idleSessions,
  isCollapsed,
  onToggleCollapse,
}: ControlPanelHeaderProps) {
  const totalActive = activeSessions + waitingSessions;

  return (
    <div className="border-b border-white/5">
      {/* Header Row */}
      <div className="flex items-center justify-between px-3 py-2">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-white/5">
                <span className="font-mono text-[10px] text-white/60">▣</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                System Status
              </span>
              {totalActive > 0 && (
                <span className="flex h-4 items-center rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-medium text-emerald-400">
                  {totalActive} active
                </span>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded bg-white/5">
                <span className="font-mono text-[10px] text-white/60">▣</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={onToggleCollapse}
          className={cn(
            'rounded-lg p-1.5 transition-colors',
            'text-white/40 hover:bg-white/5 hover:text-white/60'
          )}
          data-testid="collapse-toggle"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Status Gauges - only when expanded */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 pb-3"
          >
            <div className="grid grid-cols-3 gap-2" data-testid="status-gauges">
              <StatusGauge label="ACT" count={activeSessions} status="working" />
              <StatusGauge label="WAIT" count={waitingSessions} status="needs_attention" />
              <StatusGauge label="IDLE" count={idleSessions} status="idle" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed Status Indicator */}
      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-1 pb-3"
          >
            {totalActive > 0 && (
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  'bg-emerald-500/20 text-[10px] font-bold text-emerald-400'
                )}
              >
                {totalActive}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
