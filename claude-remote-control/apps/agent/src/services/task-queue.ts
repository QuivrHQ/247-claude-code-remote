/**
 * TaskQueueExecutor - Manages task queue execution.
 *
 * Handles:
 * - Polling for ready tasks
 * - Executing tasks in different modes (print, interactive, trust)
 * - Monitoring task completion via session status or process exit
 * - Handling failures and pausing queue for user decision
 * - Broadcasting task updates via WebSocket
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { WebSocket } from 'ws';
import type { Task, WSTaskQueueMessage } from '247-shared';
import * as tasksDb from '../db/tasks.js';
import { config } from '../config.js';
import { tmuxSessionStatus, generateSessionName, statusSubscribers } from '../status.js';
import { createTerminal, type Terminal } from '../terminal.js';
import { getEnvironmentVariables } from '../db/environments.js';
import { executionManager } from './execution.js';

// Polling interval for checking ready tasks
const POLL_INTERVAL_MS = 1000;

// Session status check interval for interactive/trust modes
const SESSION_CHECK_INTERVAL_MS = 500;

// Store running processes for print mode tasks
const runningProcesses = new Map<string, ChildProcess>();

// Store running terminals for interactive/trust mode tasks
const runningTerminals = new Map<string, Terminal>();

// Store session monitors for detecting completion
const sessionMonitors = new Map<string, NodeJS.Timeout>();

// Queue state
let isQueuePaused = false;
let pollIntervalId: NodeJS.Timeout | null = null;
let failedTaskAwaitingDecision: string | null = null;

/**
 * Broadcast task queue message to all status subscribers
 */
function broadcastTaskMessage(message: WSTaskQueueMessage): void {
  if (statusSubscribers.size === 0) return;

  const messageStr = JSON.stringify(message);
  for (const ws of statusSubscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
  console.log(`[TaskQueue] Broadcast: ${message.type}`);
}

/**
 * Check if a tmux session exists
 */
function tmuxSessionExists(sessionName: string): boolean {
  try {
    execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get project path from project name
 */
function getProjectPath(project: string): string {
  const basePath = (config.projects.basePath as string).replace('~', process.env.HOME || '');
  return `${basePath}/${project}`;
}

/**
 * Start the task queue executor
 */
export function startTaskQueueExecutor(): void {
  if (pollIntervalId) {
    console.warn('[TaskQueue] Executor already running');
    return;
  }

  pollIntervalId = setInterval(pollAndExecute, POLL_INTERVAL_MS);
  console.log('[TaskQueue] Executor started');
}

/**
 * Stop the task queue executor
 */
export function stopTaskQueueExecutor(): void {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }

  // Clear all session monitors
  for (const [, intervalId] of sessionMonitors) {
    clearInterval(intervalId);
  }
  sessionMonitors.clear();

  console.log('[TaskQueue] Executor stopped');
}

/**
 * Poll for ready tasks and execute them
 */
async function pollAndExecute(): Promise<void> {
  // Don't execute if queue is paused or awaiting decision
  if (isQueuePaused || failedTaskAwaitingDecision) {
    return;
  }

  // Check execution capacity
  const capacity = executionManager.getCapacity();
  if (capacity.available <= 0) {
    return;
  }

  // Update task statuses: pending -> ready if dependencies satisfied
  updateTaskReadiness();

  // Get next runnable task
  const task = tasksDb.getNextRunnableTask();
  if (!task) {
    return;
  }

  // Execute the task
  await executeTask(task);
}

/**
 * Update task readiness based on dependencies
 */
function updateTaskReadiness(): void {
  const pendingTasks = tasksDb.getTasksByStatus('pending');

  for (const task of pendingTasks) {
    // Check if all dependencies are completed
    const allDepsCompleted = task.dependsOn.every((depId) => {
      const depTask = tasksDb.getTask(depId);
      return depTask?.status === 'completed';
    });

    // Check if any dependency failed or was skipped
    const anyDepFailedOrSkipped = task.dependsOn.some((depId) => {
      const depTask = tasksDb.getTask(depId);
      return depTask?.status === 'failed' || depTask?.status === 'skipped';
    });

    if (anyDepFailedOrSkipped) {
      // Propagate skip to this task
      const skippedTasks = tasksDb.propagateSkip(task.id);
      for (const skippedId of skippedTasks) {
        const skippedTask = tasksDb.getTask(skippedId);
        if (skippedTask) {
          broadcastTaskMessage({
            type: 'task-skipped',
            task: skippedTask,
            propagatedSkips: skippedTasks.filter((id) => id !== skippedId),
          });
        }
      }
    } else if (allDepsCompleted || task.dependsOn.length === 0) {
      // Mark as ready
      tasksDb.updateTaskStatus(task.id, 'ready');
      const updatedTask = tasksDb.getTask(task.id);
      if (updatedTask) {
        broadcastTaskMessage({ type: 'task-updated', task: updatedTask });
      }
    }
  }
}

/**
 * Execute a single task
 */
async function executeTask(task: Task): Promise<void> {
  console.log(`[TaskQueue] Executing task ${task.id}: ${task.name} (mode: ${task.mode})`);

  // Update status to running
  tasksDb.updateTaskStatus(task.id, 'running');
  const runningTask = tasksDb.getTask(task.id);
  if (runningTask) {
    broadcastTaskMessage({ type: 'task-updated', task: runningTask });
  }

  const projectPath = getProjectPath(task.project);

  try {
    switch (task.mode) {
      case 'print':
        await executePrintMode(task, projectPath);
        break;
      case 'interactive':
      case 'trust':
        await executeInteractiveMode(task, projectPath, task.mode === 'trust');
        break;
    }
  } catch (error) {
    handleTaskFailure(task.id, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Execute task in print mode (background, non-interactive)
 */
async function executePrintMode(task: Task, projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const envVars = task.environmentId ? getEnvironmentVariables(task.environmentId) : {};

    // Spawn claude with -p flag for print mode
    const claudeProcess = spawn('claude', ['-p', task.prompt], {
      cwd: projectPath,
      env: {
        ...process.env,
        ...envVars,
        PATH: `/opt/homebrew/bin:${process.env.PATH}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    runningProcesses.set(task.id, claudeProcess);

    let stderr = '';

    claudeProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    claudeProcess.on('error', (error) => {
      runningProcesses.delete(task.id);
      reject(error);
    });

    claudeProcess.on('exit', (code, signal) => {
      runningProcesses.delete(task.id);

      if (code === 0) {
        // Task completed successfully
        tasksDb.updateTaskStatus(task.id, 'completed');
        const completedTask = tasksDb.getTask(task.id);
        if (completedTask) {
          broadcastTaskMessage({ type: 'task-updated', task: completedTask });
        }
        console.log(`[TaskQueue] Task ${task.id} completed (print mode)`);
        resolve();
      } else {
        // Task failed
        const errorMsg =
          stderr || `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`;
        handleTaskFailure(task.id, errorMsg);
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * Execute task in interactive or trust mode
 */
async function executeInteractiveMode(
  task: Task,
  projectPath: string,
  trustMode: boolean
): Promise<void> {
  // Generate session name for this task
  const sessionName = generateSessionName(task.project);

  // Link task to session
  tasksDb.linkTaskToSession(task.id, sessionName);

  // Get environment variables
  const envVars = task.environmentId ? getEnvironmentVariables(task.environmentId) : {};

  // Register with execution manager
  executionManager.register(sessionName, task.project, null);

  // Create terminal/tmux session
  const terminal = createTerminal(projectPath, sessionName, envVars);
  runningTerminals.set(task.id, terminal);

  // Wait for terminal to be ready, then send claude command
  terminal.onReady(() => {
    setTimeout(() => {
      // Build claude command
      const claudeFlags: string[] = [];
      if (trustMode) {
        claudeFlags.push('--dangerously-skip-permissions');
      }

      // Sanitize prompt for shell
      const promptSanitized = task.prompt
        .replace(/[&><;|`$!(){}[\]\\]/g, '') // Remove shell special chars
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/'/g, "'\\''"); // Escape single quotes

      const flagsStr = claudeFlags.length > 0 ? `${claudeFlags.join(' ')} ` : '';
      const fullCommand = `claude ${flagsStr}'${promptSanitized}'`;

      console.log(
        `[TaskQueue] Sending command to session ${sessionName}: ${fullCommand.substring(0, 100)}...`
      );
      terminal.write(`${fullCommand}\r`);
    }, 300); // Delay to let shell stabilize
  });

  // Start monitoring session status for completion
  startSessionMonitor(task.id, sessionName);

  // Update task with session name
  const updatedTask = tasksDb.getTask(task.id);
  if (updatedTask) {
    broadcastTaskMessage({ type: 'task-updated', task: updatedTask });
  }
}

/**
 * Start monitoring a session for completion
 */
function startSessionMonitor(taskId: string, sessionName: string): void {
  const checkInterval = setInterval(() => {
    const status = tmuxSessionStatus.get(sessionName);

    // Check if session exists
    if (!tmuxSessionExists(sessionName)) {
      // Session was killed or doesn't exist
      clearInterval(checkInterval);
      sessionMonitors.delete(taskId);
      runningTerminals.delete(taskId);
      executionManager.unregister(sessionName);

      const task = tasksDb.getTask(taskId);
      if (task && task.status === 'running') {
        handleTaskFailure(taskId, 'Session terminated unexpectedly');
      }
      return;
    }

    if (!status) return;

    if (status.status === 'idle') {
      // Claude finished - task completed
      clearInterval(checkInterval);
      sessionMonitors.delete(taskId);

      tasksDb.updateTaskStatus(taskId, 'completed');
      const completedTask = tasksDb.getTask(taskId);
      if (completedTask) {
        broadcastTaskMessage({ type: 'task-updated', task: completedTask });
      }
      console.log(`[TaskQueue] Task ${taskId} completed (session ${sessionName} idle)`);

      // Clean up terminal reference
      runningTerminals.delete(taskId);
    } else if (status.status === 'needs_attention') {
      // Claude needs user input - pause queue for interactive tasks
      const task = tasksDb.getTask(taskId);
      if (task?.mode === 'interactive') {
        // For interactive mode, this is expected - user needs to interact
        // We don't automatically fail, just wait
        console.log(
          `[TaskQueue] Task ${taskId} needs attention (reason: ${status.attentionReason})`
        );
      } else if (task?.mode === 'trust') {
        // Trust mode shouldn't need attention (permissions auto-approved)
        // If it does, something unexpected happened
        console.warn(`[TaskQueue] Trust mode task ${taskId} unexpectedly needs attention`);
      }
    }
  }, SESSION_CHECK_INTERVAL_MS);

  sessionMonitors.set(taskId, checkInterval);
}

/**
 * Handle task failure
 */
function handleTaskFailure(taskId: string, error: string): void {
  console.error(`[TaskQueue] Task ${taskId} failed: ${error}`);

  // Update task status
  tasksDb.incrementTaskRetry(taskId);
  tasksDb.updateTaskStatus(taskId, 'failed', error);

  // Clean up
  const terminal = runningTerminals.get(taskId);
  if (terminal) {
    terminal.kill();
    runningTerminals.delete(taskId);
  }

  const process = runningProcesses.get(taskId);
  if (process) {
    process.kill();
    runningProcesses.delete(taskId);
  }

  const monitor = sessionMonitors.get(taskId);
  if (monitor) {
    clearInterval(monitor);
    sessionMonitors.delete(taskId);
  }

  // Get task info for broadcast
  const failedTask = tasksDb.getTask(taskId);
  if (failedTask) {
    // Set awaiting decision flag
    failedTaskAwaitingDecision = taskId;

    // Get dependent tasks that would be affected
    const dependentTasks = tasksDb.getDependentTasks(taskId);

    // Broadcast failure
    broadcastTaskMessage({
      type: 'task-failed',
      task: failedTask,
      awaitingDecision: true,
    });

    console.log(
      `[TaskQueue] Awaiting user decision for failed task ${taskId} (${dependentTasks.length} dependent tasks)`
    );
  }
}

/**
 * Retry a failed task
 */
export function retryTask(taskId: string): Task | null {
  if (failedTaskAwaitingDecision !== taskId) {
    console.warn(`[TaskQueue] Cannot retry task ${taskId} - not awaiting decision`);
    return null;
  }

  failedTaskAwaitingDecision = null;

  // Reset task to ready status
  tasksDb.updateTaskStatus(taskId, 'ready', null); // Clear error

  const task = tasksDb.getTask(taskId);
  if (task) {
    broadcastTaskMessage({ type: 'task-updated', task });
  }

  console.log(`[TaskQueue] Task ${taskId} will be retried`);
  return task;
}

/**
 * Skip a failed task and propagate skip to dependents
 */
export function skipTask(taskId: string): string[] {
  if (failedTaskAwaitingDecision !== taskId) {
    console.warn(`[TaskQueue] Cannot skip task ${taskId} - not awaiting decision`);
    return [];
  }

  failedTaskAwaitingDecision = null;

  // Propagate skip to this task and all dependents
  const skippedIds = tasksDb.propagateSkip(taskId);

  // Broadcast updates for all skipped tasks
  for (const skippedId of skippedIds) {
    const task = tasksDb.getTask(skippedId);
    if (task) {
      broadcastTaskMessage({
        type: 'task-skipped',
        task,
        propagatedSkips: skippedIds.filter((id) => id !== skippedId),
      });
    }
  }

  console.log(`[TaskQueue] Skipped task ${taskId} and ${skippedIds.length - 1} dependent tasks`);
  return skippedIds;
}

/**
 * Stop all tasks in the queue
 */
export function stopAllTasks(): void {
  failedTaskAwaitingDecision = null;

  // Kill all running processes
  for (const [taskId, process] of runningProcesses) {
    process.kill();
    tasksDb.updateTaskStatus(taskId, 'paused');
  }
  runningProcesses.clear();

  // Kill all running terminals
  for (const [taskId, terminal] of runningTerminals) {
    terminal.kill();
    tasksDb.updateTaskStatus(taskId, 'paused');
  }
  runningTerminals.clear();

  // Clear all monitors
  for (const [, intervalId] of sessionMonitors) {
    clearInterval(intervalId);
  }
  sessionMonitors.clear();

  // Pause all pending/ready tasks
  tasksDb.pauseAllTasks();

  // Broadcast queue paused
  broadcastTaskMessage({ type: 'queue-paused' });

  console.log('[TaskQueue] All tasks stopped');
}

/**
 * Resume the queue after being paused
 */
export function resumeQueue(): void {
  failedTaskAwaitingDecision = null;

  // Resume all paused tasks
  tasksDb.resumeAllTasks();

  // Broadcast queue resumed
  broadcastTaskMessage({ type: 'queue-resumed' });

  // Also broadcast updated task list
  const allTasks = tasksDb.getAllTasks();
  broadcastTaskMessage({ type: 'tasks-list', tasks: allTasks });

  console.log('[TaskQueue] Queue resumed');
}

/**
 * Pause the queue (stop executing new tasks)
 */
export function pauseQueue(): void {
  isQueuePaused = true;
  broadcastTaskMessage({ type: 'queue-paused' });
  console.log('[TaskQueue] Queue paused');
}

/**
 * Unpause the queue
 */
export function unpauseQueue(): void {
  isQueuePaused = false;
  broadcastTaskMessage({ type: 'queue-resumed' });
  console.log('[TaskQueue] Queue unpaused');
}

/**
 * Check if queue is paused
 */
export function isQueuePausedState(): boolean {
  return isQueuePaused;
}

/**
 * Get the task ID currently awaiting decision
 */
export function getFailedTaskAwaitingDecision(): string | null {
  return failedTaskAwaitingDecision;
}

/**
 * Broadcast full task list to all subscribers
 */
export function broadcastTaskList(): void {
  const allTasks = tasksDb.getAllTasks();
  broadcastTaskMessage({ type: 'tasks-list', tasks: allTasks });
}

/**
 * Notify about a new task created
 */
export function notifyTaskCreated(task: Task): void {
  broadcastTaskMessage({ type: 'task-created', task });
}

/**
 * Notify about a task update
 */
export function notifyTaskUpdated(task: Task): void {
  broadcastTaskMessage({ type: 'task-updated', task });
}

/**
 * Notify about a task removed
 */
export function notifyTaskRemoved(taskId: string): void {
  broadcastTaskMessage({ type: 'task-removed', taskId });
}
