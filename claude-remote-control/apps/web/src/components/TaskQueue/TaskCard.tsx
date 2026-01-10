'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Circle,
  CheckCircle,
  XCircle,
  Loader2,
  PauseCircle,
  SkipForward,
  GripVertical,
  ExternalLink,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus, TaskExecutionMode } from '247-shared';

interface TaskCardProps {
  task: Task;
  onDelete?: (taskId: string) => void;
  onViewSession?: (sessionName: string) => void;
  isDragging?: boolean;
}

// Status icon configuration (Linear-style circular icons)
const statusConfig: Record<TaskStatus, { icon: typeof Circle; color: string; spin?: boolean }> = {
  pending: { icon: Circle, color: 'text-gray-400' },
  ready: { icon: Circle, color: 'text-cyan-400' },
  running: { icon: Loader2, color: 'text-cyan-400', spin: true },
  completed: { icon: CheckCircle, color: 'text-emerald-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
  skipped: { icon: SkipForward, color: 'text-amber-400' },
  paused: { icon: PauseCircle, color: 'text-gray-400' },
};

// Mode badge configuration
const modeConfig: Record<TaskExecutionMode, { label: string; bg: string; text: string }> = {
  print: { label: '-p', bg: 'bg-gray-700', text: 'text-gray-300' },
  interactive: { label: 'Int', bg: 'bg-cyan-900/50', text: 'text-cyan-300' },
  trust: { label: 'Trust', bg: 'bg-amber-900/50', text: 'text-amber-300' },
};

function TaskStatusIcon({ status }: { status: TaskStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Icon className={cn('h-4 w-4 flex-shrink-0', config.color, config.spin && 'animate-spin')} />
  );
}

function TaskModeBadge({ mode }: { mode: TaskExecutionMode }) {
  const config = modeConfig[mode];

  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', config.bg, config.text)}>
      {config.label}
    </span>
  );
}

export function TaskCard({ task, onDelete, onViewSession, isDragging }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const canDelete = ['pending', 'ready', 'paused'].includes(task.status);
  const canViewSession = task.sessionName && ['running', 'completed'].includes(task.status);

  // Truncate prompt for display
  const displayPrompt =
    task.prompt.length > 50 ? task.prompt.substring(0, 50) + '...' : task.prompt;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex h-10 items-center rounded-lg px-2 transition-all',
        'border border-transparent',
        'hover:border-white/5 hover:bg-gray-800/50',
        (isDragging || isSortableDragging) && 'border-cyan-500/30 bg-gray-800/70 shadow-lg',
        task.status === 'failed' && 'border-red-500/30 bg-red-950/20'
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'cursor-grab touch-none active:cursor-grabbing',
          '-ml-1 rounded p-1 hover:bg-white/10',
          (task.status === 'running' || task.status === 'completed') &&
            'cursor-not-allowed opacity-30'
        )}
      >
        <GripVertical className="h-4 w-4 text-gray-500" />
      </div>

      {/* Status icon */}
      <div className="ml-1">
        <TaskStatusIcon status={task.status} />
      </div>

      {/* Task name/prompt */}
      <div className="ml-2 min-w-0 flex-1">
        <span className="block truncate text-sm text-white/80">{task.name || displayPrompt}</span>
        {task.error && (
          <span className="mt-0.5 block truncate text-[10px] text-red-400">
            {task.error.substring(0, 40)}...
          </span>
        )}
      </div>

      {/* Mode badge */}
      <div className="ml-2 flex-shrink-0">
        <TaskModeBadge mode={task.mode} />
      </div>

      {/* Actions */}
      <div className="ml-2 flex items-center gap-1">
        {canViewSession && onViewSession && (
          <button
            onClick={() => onViewSession(task.sessionName!)}
            className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
            title="View session"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}

        {canDelete && onDelete && (
          <button
            onClick={() => onDelete(task.id)}
            className="rounded p-1 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
            title="Delete task"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default TaskCard;
