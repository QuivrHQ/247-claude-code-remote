'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskExecutionMode } from '247-shared';
import type { CreateTaskInput } from './hooks/useTaskQueue';

interface TaskCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (task: CreateTaskInput) => Promise<unknown>;
  onCreateBatch: (tasks: CreateTaskInput[]) => Promise<unknown>;
  projects: string[];
  defaultProject?: string;
}

interface TaskDraft {
  id: string;
  name: string;
  prompt: string;
  mode: TaskExecutionMode;
}

const modeOptions: { value: TaskExecutionMode; label: string; description: string }[] = [
  { value: 'interactive', label: 'Interactive', description: 'Normal Claude session with prompts' },
  { value: 'print', label: 'Print (-p)', description: 'Background execution, no interaction' },
  { value: 'trust', label: 'Trust Mode', description: 'Auto-accept all permissions (dangerous)' },
];

export function TaskCreator({
  isOpen,
  onClose,
  onCreateTask,
  onCreateBatch,
  projects,
  defaultProject,
}: TaskCreatorProps) {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [project, setProject] = useState(defaultProject || projects[0] || '');

  // Single task state
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [taskMode, setTaskMode] = useState<TaskExecutionMode>('interactive');
  const [useWorktree, setUseWorktree] = useState(false);

  // Batch tasks state
  const [tasks, setTasks] = useState<TaskDraft[]>([
    { id: crypto.randomUUID(), name: '', prompt: '', mode: 'interactive' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName('');
    setPrompt('');
    setTaskMode('interactive');
    setUseWorktree(false);
    setTasks([{ id: crypto.randomUUID(), name: '', prompt: '', mode: 'interactive' }]);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const addTaskDraft = () => {
    setTasks([...tasks, { id: crypto.randomUUID(), name: '', prompt: '', mode: 'interactive' }]);
  };

  const removeTaskDraft = (id: string) => {
    if (tasks.length > 1) {
      setTasks(tasks.filter((t) => t.id !== id));
    }
  };

  const updateTaskDraft = (id: string, field: keyof TaskDraft, value: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleSubmit = async () => {
    setError(null);

    if (!project) {
      setError('Please select a project');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'single') {
        if (!prompt.trim()) {
          setError('Please enter a prompt');
          setIsSubmitting(false);
          return;
        }

        await onCreateTask({
          name: name.trim() || prompt.substring(0, 30),
          prompt: prompt.trim(),
          project,
          mode: taskMode,
          useWorktree,
        });
      } else {
        // Batch mode - create tasks with sequential dependencies
        const validTasks = tasks.filter((t) => t.prompt.trim());
        if (validTasks.length === 0) {
          setError('Please add at least one task with a prompt');
          setIsSubmitting(false);
          return;
        }

        // Build task inputs with dependency chain
        const taskInputs: CreateTaskInput[] = validTasks.map((t) => ({
          name: t.name.trim() || t.prompt.substring(0, 30),
          prompt: t.prompt.trim(),
          project,
          mode: t.mode,
          // Each task depends on the previous one (sequential chain)
          // We'll use position-based dependencies for now
          dependsOn: [], // Dependencies will be handled by position
          useWorktree,
        }));

        await onCreateBatch(taskInputs);
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task(s)');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="mx-4 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#0d0d14] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-medium text-white">Add Task</h2>
            <button
              onClick={handleClose}
              className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setMode('single')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                mode === 'single'
                  ? 'border-b-2 border-cyan-400 text-cyan-400'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              Single Task
            </button>
            <button
              onClick={() => setMode('batch')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                mode === 'batch'
                  ? 'border-b-2 border-cyan-400 text-cyan-400'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              Task Chain
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
            {/* Project selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">Project</label>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className={cn(
                  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white',
                  'focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20'
                )}
              >
                {projects.map((p) => (
                  <option key={p} value={p} className="bg-[#1a1a24]">
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {mode === 'single' ? (
              <>
                {/* Task name */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Task Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Fix authentication bug"
                    className={cn(
                      'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white',
                      'placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20'
                    )}
                  />
                </div>

                {/* Prompt */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter the task prompt for Claude..."
                    rows={4}
                    className={cn(
                      'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white',
                      'placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20',
                      'resize-none'
                    )}
                  />
                </div>

                {/* Mode selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">
                    Execution Mode
                  </label>
                  <div className="space-y-1.5">
                    {modeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTaskMode(option.value)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-lg border p-2 transition-colors',
                          taskMode === option.value
                            ? 'border-cyan-500/50 bg-cyan-500/10'
                            : 'border-white/10 hover:bg-white/5'
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2',
                            taskMode === option.value
                              ? 'border-cyan-400 bg-cyan-400'
                              : 'border-white/30'
                          )}
                        />
                        <div className="text-left">
                          <p className="text-sm text-white">{option.label}</p>
                          <p className="text-[10px] text-white/40">{option.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {taskMode === 'trust' && (
                    <div className="mt-2 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                      <p className="text-[10px] text-amber-300">
                        Trust mode will auto-accept all tool permissions. Use with caution!
                      </p>
                    </div>
                  )}
                </div>

                {/* Worktree option */}
                <div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useWorktree}
                      onChange={(e) => setUseWorktree(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/30"
                    />
                    <span className="text-sm text-white/70">
                      Use Git worktree (isolated branch)
                    </span>
                  </label>
                </div>
              </>
            ) : (
              <>
                {/* Batch task list */}
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-white/10 bg-white/[0.02] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-white/50">Task {index + 1}</span>
                        {tasks.length > 1 && (
                          <button
                            onClick={() => removeTaskDraft(task.id)}
                            className="rounded p-1 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={task.name}
                        onChange={(e) => updateTaskDraft(task.id, 'name', e.target.value)}
                        placeholder="Task name (optional)"
                        className={cn(
                          'mb-2 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white',
                          'placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none'
                        )}
                      />

                      <textarea
                        value={task.prompt}
                        onChange={(e) => updateTaskDraft(task.id, 'prompt', e.target.value)}
                        placeholder="Enter prompt..."
                        rows={2}
                        className={cn(
                          'mb-2 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white',
                          'resize-none placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none'
                        )}
                      />

                      <select
                        value={task.mode}
                        onChange={(e) => updateTaskDraft(task.id, 'mode', e.target.value)}
                        className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                      >
                        {modeOptions.map((option) => (
                          <option key={option.value} value={option.value} className="bg-[#1a1a24]">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addTaskDraft}
                  className="flex items-center gap-1 text-xs text-cyan-400 transition-colors hover:text-cyan-300"
                >
                  <Plus className="h-3 w-3" />
                  Add another task
                </button>

                <p className="text-[10px] text-white/40">
                  Tasks will execute sequentially (1 &rarr; 2 &rarr; 3...)
                </p>
              </>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 p-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-white/60 transition-colors hover:text-white/80"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
                'bg-cyan-500 text-white transition-colors hover:bg-cyan-600',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {isSubmitting
                ? 'Creating...'
                : mode === 'single'
                  ? 'Create Task'
                  : `Create ${tasks.filter((t) => t.prompt.trim()).length} Tasks`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TaskCreator;
