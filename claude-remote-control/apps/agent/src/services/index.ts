// Services index - centralized exports for all services

export { WorktreeManager, worktreeManager } from './worktree.js';
export type { WorktreeInfo } from './worktree.js';

export { ExecutionManager, executionManager } from './execution.js';
export type { SessionInfo, CapacityInfo } from './execution.js';

export { CleanupService, initCleanupService, getCleanupService } from './cleanup.js';
export type { CleanupConfig, CleanupResult } from './cleanup.js';

// Task Queue Executor
export {
  startTaskQueueExecutor,
  stopTaskQueueExecutor,
  retryTask,
  skipTask,
  stopAllTasks,
  resumeQueue,
  pauseQueue,
  unpauseQueue,
  isQueuePausedState,
  getFailedTaskAwaitingDecision,
  broadcastTaskList,
  notifyTaskCreated,
  notifyTaskUpdated,
  notifyTaskRemoved,
} from './task-queue.js';
