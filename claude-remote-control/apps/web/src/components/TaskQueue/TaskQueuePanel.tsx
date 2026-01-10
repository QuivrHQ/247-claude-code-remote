'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ListTodo, Plus, Play, Pause, Square, ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import type { UseTaskQueueReturn } from './hooks/useTaskQueue';

interface TaskQueuePanelProps {
  taskQueue: UseTaskQueueReturn;
  onOpenCreator: () => void;
  onViewSession?: (sessionName: string) => void;
  isCollapsed?: boolean;
}

export function TaskQueuePanel({
  taskQueue,
  onOpenCreator,
  onViewSession,
  isCollapsed = false,
}: TaskQueuePanelProps) {
  const {
    tasks,
    isPaused,
    awaitingDecision,
    isConnected,
    deleteTask,
    reorderTask,
    stopAll,
    pause,
    resume,
  } = taskQueue;

  const [isExpanded, setIsExpanded] = useState(true);

  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate progress
  const progress = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const skipped = tasks.filter((t) => t.status === 'skipped').length;
    const running = tasks.filter((t) => t.status === 'running').length;

    return {
      total,
      completed,
      failed,
      skipped,
      running,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [tasks]);

  // Sort tasks by position
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => a.position - b.position);
  }, [tasks]);

  const taskIds = useMemo(() => sortedTasks.map((t) => t.id), [sortedTasks]);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedTasks.findIndex((t) => t.id === active.id);
      const newIndex = sortedTasks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderTask(active.id as string, newIndex);
      }
    }
  };

  // Handle task deletion
  const handleDelete = async (taskId: string) => {
    await deleteTask(taskId);
  };

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center px-1 py-2">
        <div className="relative">
          <ListTodo className="h-5 w-5 text-white/40" />
          {tasks.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white">
              {tasks.length}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-white/5">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2.5 transition-colors hover:bg-white/5"
      >
        <ListTodo className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-medium text-white/70">Task Queue</span>
        {tasks.length > 0 && <span className="text-xs text-white/40">({tasks.length})</span>}

        {/* Status indicator */}
        {!isConnected && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-500" title="Disconnected" />
        )}
        {isPaused && (
          <span title="Queue paused">
            <Pause className="ml-1 h-3 w-3 text-amber-400" />
          </span>
        )}
        {progress.running > 0 && (
          <span className="ml-1 text-[10px] text-cyan-400">{progress.running} running</span>
        )}

        <ChevronDown
          className={cn(
            'ml-auto h-3 w-3 text-white/40 transition-transform',
            !isExpanded && '-rotate-90'
          )}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* Progress bar */}
            {tasks.length > 0 && (
              <div className="px-3 pb-2">
                <div className="mb-1 flex items-center gap-2 text-[10px] text-white/50">
                  <span>
                    {progress.completed}/{progress.total} completed
                  </span>
                  {progress.failed > 0 && (
                    <span className="text-red-400">{progress.failed} failed</span>
                  )}
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-1 px-3 pb-2">
              <button
                onClick={onOpenCreator}
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs',
                  'bg-cyan-500/20 text-cyan-400 transition-colors hover:bg-cyan-500/30'
                )}
              >
                <Plus className="h-3 w-3" />
                Add Task
              </button>

              {tasks.length > 0 && (
                <>
                  {isPaused ? (
                    <button
                      onClick={() => resume()}
                      className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/30"
                    >
                      <Play className="h-3 w-3" />
                      Resume
                    </button>
                  ) : (
                    <button
                      onClick={() => pause()}
                      className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-400 transition-colors hover:bg-amber-500/30"
                    >
                      <Pause className="h-3 w-3" />
                      Pause
                    </button>
                  )}

                  <button
                    onClick={() => stopAll()}
                    className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/30"
                  >
                    <Square className="h-3 w-3" />
                    Stop All
                  </button>
                </>
              )}
            </div>

            {/* Task list */}
            <div className="scrollbar-thin scrollbar-thumb-white/10 max-h-64 overflow-y-auto px-2 pb-2">
              {tasks.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-white/30">No tasks in queue</p>
                  <p className="mt-1 text-[10px] text-white/20">
                    Add tasks to execute them sequentially
                  </p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0.5">
                      {sortedTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onDelete={handleDelete}
                          onViewSession={onViewSession}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Failed task awaiting decision */}
            {awaitingDecision && (
              <div className="mx-3 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-red-300">Task Failed</p>
                    <p className="mt-0.5 text-[10px] text-white/50">
                      A task failed. Choose to retry, skip, or stop the queue.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TaskQueuePanel;
