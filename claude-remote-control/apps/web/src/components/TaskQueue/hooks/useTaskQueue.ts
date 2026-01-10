'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, WSTaskQueueMessage } from '247-shared';
import { buildApiUrl, buildWebSocketUrl } from '@/lib/utils';

export interface TaskQueueState {
  tasks: Task[];
  isPaused: boolean;
  awaitingDecision: string | null;
  isConnected: boolean;
  error: string | null;
}

export interface UseTaskQueueReturn extends TaskQueueState {
  // Task operations
  createTask: (task: CreateTaskInput) => Promise<Task | null>;
  createTaskBatch: (tasks: CreateTaskInput[]) => Promise<Task[]>;
  deleteTask: (taskId: string) => Promise<boolean>;
  reorderTask: (taskId: string, position: number) => Promise<boolean>;

  // Queue control
  retryTask: (taskId: string) => Promise<boolean>;
  skipTask: (taskId: string) => Promise<string[]>;
  stopAll: () => Promise<boolean>;
  pause: () => Promise<boolean>;
  resume: () => Promise<boolean>;

  // Refresh
  refresh: () => Promise<void>;
}

export interface CreateTaskInput {
  name: string;
  prompt: string;
  project: string;
  mode?: 'print' | 'interactive' | 'trust';
  dependsOn?: string[];
  useWorktree?: boolean;
  environmentId?: string;
  position?: number;
}

const WS_RECONNECT_BASE_DELAY = 1000;
const WS_RECONNECT_MAX_DELAY = 30000;

export function useTaskQueue(agentUrl: string | null): UseTaskQueueReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [awaitingDecision, setAwaitingDecision] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_BASE_DELAY);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial task list
  const refresh = useCallback(async () => {
    if (!agentUrl) return;

    try {
      const response = await fetch(buildApiUrl(agentUrl, '/api/tasks'));
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
        setIsPaused(data.isPaused || false);
        setAwaitingDecision(data.awaitingDecision || null);
        setError(null);
      } else {
        setError('Failed to fetch tasks');
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Could not connect to agent');
    }
  }, [agentUrl]);

  // Handle WebSocket messages
  const handleWsMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WSTaskQueueMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'tasks-list':
          setTasks(message.tasks);
          break;

        case 'task-created':
          setTasks((prev) => [...prev, message.task].sort((a, b) => a.position - b.position));
          break;

        case 'task-updated':
          setTasks((prev) =>
            prev
              .map((t) => (t.id === message.task.id ? message.task : t))
              .sort((a, b) => a.position - b.position)
          );
          break;

        case 'task-removed':
          setTasks((prev) => prev.filter((t) => t.id !== message.taskId));
          break;

        case 'task-failed':
          setTasks((prev) => prev.map((t) => (t.id === message.task.id ? message.task : t)));
          if (message.awaitingDecision) {
            setAwaitingDecision(message.task.id);
          }
          break;

        case 'task-skipped':
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id === message.task.id) return message.task;
              if (message.propagatedSkips.includes(t.id)) {
                return { ...t, status: 'skipped' as const };
              }
              return t;
            })
          );
          break;

        case 'queue-paused':
          setIsPaused(true);
          break;

        case 'queue-resumed':
          setIsPaused(false);
          setAwaitingDecision(null);
          break;
      }
    } catch (err) {
      console.error('Failed to parse task queue message:', err);
    }
  }, []);

  // Setup WebSocket connection
  useEffect(() => {
    if (!agentUrl) return;

    const connectWs = () => {
      // Tasks use the same /status WebSocket as sessions
      const ws = new WebSocket(buildWebSocketUrl(agentUrl, '/status'));
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[TaskQueue] WebSocket connected');
        setIsConnected(true);
        reconnectDelayRef.current = WS_RECONNECT_BASE_DELAY;
        // Fetch initial data
        refresh();
      };

      ws.onmessage = handleWsMessage;

      ws.onclose = () => {
        console.log('[TaskQueue] WebSocket closed');
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect with backoff
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, WS_RECONNECT_MAX_DELAY);

        reconnectTimeoutRef.current = setTimeout(connectWs, delay);
      };

      ws.onerror = (err) => {
        console.error('[TaskQueue] WebSocket error:', err);
      };
    };

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [agentUrl, handleWsMessage, refresh]);

  // Task operations
  const createTask = useCallback(
    async (task: CreateTaskInput): Promise<Task | null> => {
      if (!agentUrl) return null;

      try {
        const response = await fetch(buildApiUrl(agentUrl, '/api/tasks'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });

        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch (err) {
        console.error('Failed to create task:', err);
        return null;
      }
    },
    [agentUrl]
  );

  const createTaskBatch = useCallback(
    async (taskInputs: CreateTaskInput[]): Promise<Task[]> => {
      if (!agentUrl) return [];

      try {
        const response = await fetch(buildApiUrl(agentUrl, '/api/tasks/batch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: taskInputs }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.tasks || [];
        }
        return [];
      } catch (err) {
        console.error('Failed to create task batch:', err);
        return [];
      }
    },
    [agentUrl]
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      if (!agentUrl) return false;

      try {
        const response = await fetch(buildApiUrl(agentUrl, `/api/tasks/${taskId}`), {
          method: 'DELETE',
        });
        return response.ok;
      } catch (err) {
        console.error('Failed to delete task:', err);
        return false;
      }
    },
    [agentUrl]
  );

  const reorderTask = useCallback(
    async (taskId: string, position: number): Promise<boolean> => {
      if (!agentUrl) return false;

      try {
        const response = await fetch(buildApiUrl(agentUrl, `/api/tasks/${taskId}/reorder`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position }),
        });
        return response.ok;
      } catch (err) {
        console.error('Failed to reorder task:', err);
        return false;
      }
    },
    [agentUrl]
  );

  // Queue control
  const retryTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      if (!agentUrl) return false;

      try {
        const response = await fetch(buildApiUrl(agentUrl, `/api/tasks/${taskId}/retry`), {
          method: 'POST',
        });
        if (response.ok) {
          setAwaitingDecision(null);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to retry task:', err);
        return false;
      }
    },
    [agentUrl]
  );

  const skipTask = useCallback(
    async (taskId: string): Promise<string[]> => {
      if (!agentUrl) return [];

      try {
        const response = await fetch(buildApiUrl(agentUrl, `/api/tasks/${taskId}/skip`), {
          method: 'POST',
        });
        if (response.ok) {
          const data = await response.json();
          setAwaitingDecision(null);
          return data.skippedIds || [];
        }
        return [];
      } catch (err) {
        console.error('Failed to skip task:', err);
        return [];
      }
    },
    [agentUrl]
  );

  const stopAll = useCallback(async (): Promise<boolean> => {
    if (!agentUrl) return false;

    try {
      const response = await fetch(buildApiUrl(agentUrl, '/api/tasks/stop'), {
        method: 'POST',
      });
      return response.ok;
    } catch (err) {
      console.error('Failed to stop all tasks:', err);
      return false;
    }
  }, [agentUrl]);

  const pause = useCallback(async (): Promise<boolean> => {
    if (!agentUrl) return false;

    try {
      const response = await fetch(buildApiUrl(agentUrl, '/api/tasks/pause'), {
        method: 'POST',
      });
      return response.ok;
    } catch (err) {
      console.error('Failed to pause queue:', err);
      return false;
    }
  }, [agentUrl]);

  const resume = useCallback(async (): Promise<boolean> => {
    if (!agentUrl) return false;

    try {
      const response = await fetch(buildApiUrl(agentUrl, '/api/tasks/resume'), {
        method: 'POST',
      });
      return response.ok;
    } catch (err) {
      console.error('Failed to resume queue:', err);
      return false;
    }
  }, [agentUrl]);

  return {
    tasks,
    isPaused,
    awaitingDecision,
    isConnected,
    error,
    createTask,
    createTaskBatch,
    deleteTask,
    reorderTask,
    retryTask,
    skipTask,
    stopAll,
    pause,
    resume,
    refresh,
  };
}
