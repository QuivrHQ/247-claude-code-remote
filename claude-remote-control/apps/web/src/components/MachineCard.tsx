'use client';

import { motion } from 'framer-motion';
import { Monitor, Zap, AlertTriangle, ArrowRight } from 'lucide-react';
import { CountBadge } from '@/components/ui/status-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import { cn } from '@/lib/utils';

interface Machine {
  id: string;
  name: string;
  status: string;
  config?: {
    projects: string[];
    agentUrl?: string;
  };
}

interface MachineCardProps {
  machine: Machine;
  onClick: () => void;
}

export function MachineCard({ machine, onClick }: MachineCardProps) {
  const { getSessionsForMachine } = useSessionPolling();

  const sessions = getSessionsForMachine(machine.id);
  const isOnline = machine.status === 'online';
  const agentUrl = machine.config?.agentUrl || 'localhost:4678';

  const runningCount = sessions.filter((s) => s.status === 'running').length;
  const waitingCount = sessions.filter((s) => s.status === 'waiting').length;
  const permissionCount = sessions.filter((s) => s.status === 'permission').length;
  const doneCount = sessions.filter((s) => s.status === 'stopped').length;
  const hooksActive = sessions.some((s) => s.statusSource === 'hook');

  return (
    <motion.button
      onClick={isOnline ? onClick : undefined}
      disabled={!isOnline}
      whileHover={isOnline ? { scale: 1.02 } : undefined}
      whileTap={isOnline ? { scale: 0.98 } : undefined}
      className={cn(
        'relative w-full p-5 rounded-2xl text-left transition-all group',
        'border',
        isOnline
          ? 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:shadow-xl hover:shadow-black/20 cursor-pointer'
          : 'bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed'
      )}
    >
      {/* Top row: Icon + Name + Status */}
      <div className="flex items-start gap-4">
        {/* Machine Icon */}
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            'border',
            isOnline
              ? 'bg-gradient-to-br from-white/10 to-white/5 border-white/10'
              : 'bg-white/5 border-white/5'
          )}
        >
          <Monitor
            className={cn(
              'w-6 h-6',
              isOnline ? 'text-white/70' : 'text-white/30'
            )}
          />
        </div>

        {/* Machine Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-semibold text-lg truncate',
              isOnline ? 'text-white' : 'text-white/40'
            )}>
              {machine.name}
            </span>
            <span
              className={cn(
                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                isOnline
                  ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                  : 'bg-red-400/50'
              )}
            />
          </div>
          <p className={cn(
            'text-sm truncate font-mono mt-0.5',
            isOnline ? 'text-white/40' : 'text-white/20'
          )}>
            {agentUrl}
          </p>
        </div>

        {/* Arrow indicator */}
        {isOnline && (
          <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white/40 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
        )}
      </div>

      {/* Session Badges */}
      {isOnline && (
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <CountBadge status="running" count={runningCount} />
          <CountBadge status="waiting" count={waitingCount} />
          <CountBadge status="permission" count={permissionCount} />
          <CountBadge status="stopped" count={doneCount} />

          {/* Hooks indicator */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                {hooksActive ? (
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-medium flex items-center gap-1 cursor-help">
                    <Zap className="w-3 h-3" />
                    hooks
                  </span>
                ) : sessions.length > 0 ? (
                  <span className="px-2 py-0.5 bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 rounded-full text-xs font-medium flex items-center gap-1 cursor-help">
                    <AlertTriangle className="w-3 h-3" />
                    no hooks
                  </span>
                ) : null}
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-[#1a1a24] border-white/10">
                <p className="font-medium text-white">
                  {hooksActive ? 'Hooks Active' : 'Hooks Not Configured'}
                </p>
                <p className="text-xs text-white/50">
                  {hooksActive
                    ? 'Real-time status updates enabled'
                    : 'Using tmux fallback - status may be delayed'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Total sessions count */}
          {sessions.length > 0 && (
            <span className="ml-auto text-xs text-white/30">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Offline overlay text */}
      {!isOnline && (
        <div className="mt-4 text-sm text-white/30">
          Machine offline
        </div>
      )}
    </motion.button>
  );
}
