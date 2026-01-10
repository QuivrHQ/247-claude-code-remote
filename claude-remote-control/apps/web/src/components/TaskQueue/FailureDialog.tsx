'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, RefreshCw, SkipForward, Square, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '247-shared';

interface FailureDialogProps {
  isOpen: boolean;
  failedTask: Task | null;
  dependentTasks: Task[];
  onRetry: () => void;
  onSkip: () => void;
  onStopAll: () => void;
  isProcessing?: boolean;
}

export function FailureDialog({
  isOpen,
  failedTask,
  dependentTasks,
  onRetry,
  onSkip,
  onStopAll,
  isProcessing = false,
}: FailureDialogProps) {
  if (!isOpen || !failedTask) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="mx-4 w-full max-w-md overflow-hidden rounded-xl border border-red-500/30 bg-[#0d0d14] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-red-500/20 bg-red-500/10 px-4 py-3">
            <XCircle className="h-5 w-5 text-red-400" />
            <h2 className="text-sm font-medium text-red-300">Task Failed</h2>
          </div>

          {/* Content */}
          <div className="space-y-4 p-4">
            {/* Task info */}
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="truncate text-sm font-medium text-white">
                {failedTask.name || failedTask.prompt.substring(0, 50)}
              </p>
              {failedTask.name && (
                <p className="mt-1 truncate text-xs text-white/40">
                  {failedTask.prompt.substring(0, 80)}...
                </p>
              )}
            </div>

            {/* Error message */}
            {failedTask.error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="mb-1 text-xs font-medium text-red-400">Error:</p>
                <p className="break-all font-mono text-xs text-white/70">{failedTask.error}</p>
              </div>
            )}

            {/* Dependent tasks warning */}
            {dependentTasks.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                  <div>
                    <p className="text-xs font-medium text-amber-300">
                      {dependentTasks.length} dependent task{dependentTasks.length > 1 ? 's' : ''}{' '}
                      affected
                    </p>
                    <div className="mt-2 space-y-1">
                      {dependentTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-1 text-[10px] text-white/50"
                        >
                          <ChevronRight className="h-3 w-3" />
                          <span className="truncate">
                            {task.name || task.prompt.substring(0, 30)}
                          </span>
                        </div>
                      ))}
                      {dependentTasks.length > 3 && (
                        <p className="pl-4 text-[10px] text-white/40">
                          +{dependentTasks.length - 3} more
                        </p>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-amber-300/70">
                      Skipping will also skip all dependent tasks
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Retry count */}
            {failedTask.retryCount > 0 && (
              <p className="text-xs text-white/40">Retry attempts: {failedTask.retryCount}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-3">
            <button
              onClick={onRetry}
              disabled={isProcessing}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
                'bg-cyan-500 text-white transition-colors hover:bg-cyan-600',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <RefreshCw className="h-4 w-4" />
              Retry Task
            </button>

            <button
              onClick={onSkip}
              disabled={isProcessing}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
                'bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </button>

            <button
              onClick={onStopAll}
              disabled={isProcessing}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
                'bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <Square className="h-4 w-4" />
              Stop All
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default FailureDialog;
