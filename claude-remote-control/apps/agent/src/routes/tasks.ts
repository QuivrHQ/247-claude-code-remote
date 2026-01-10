/**
 * Task Queue API routes.
 * Handles task CRUD operations, queue control, and template management.
 */

import { Router, type Router as RouterType } from 'express';
import type {
  CreateTaskRequest,
  CreateTaskBatchRequest,
  InstantiateTemplateRequest,
  CreateTemplateRequest,
} from '247-shared';
import * as tasksDb from '../db/tasks.js';
import {
  retryTask,
  skipTask,
  stopAllTasks,
  resumeQueue,
  pauseQueue,
  unpauseQueue,
  isQueuePausedState,
  getFailedTaskAwaitingDecision,
  notifyTaskCreated,
  notifyTaskUpdated,
  notifyTaskRemoved,
} from '../services/task-queue.js';

const router: RouterType = Router();

// ============================================================================
// Task CRUD Operations
// ============================================================================

/**
 * GET /api/tasks
 * List all tasks in the queue
 */
router.get('/', (_req, res) => {
  try {
    const tasks = tasksDb.getAllTasks();
    res.json({
      tasks,
      isPaused: isQueuePausedState(),
      awaitingDecision: getFailedTaskAwaitingDecision(),
    });
  } catch (error) {
    console.error('[Tasks API] Failed to list tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

/**
 * GET /api/tasks/:id
 * Get a specific task
 */
router.get('/:id', (req, res) => {
  try {
    const task = tasksDb.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    console.error('[Tasks API] Failed to get task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', (req, res) => {
  try {
    const body: CreateTaskRequest = req.body;

    if (!body.name || !body.prompt || !body.project) {
      return res.status(400).json({ error: 'Missing required fields: name, prompt, project' });
    }

    const task = tasksDb.createTask({
      name: body.name,
      prompt: body.prompt,
      project: body.project,
      mode: body.mode || 'interactive',
      dependsOn: body.dependsOn || [],
      useWorktree: body.useWorktree || false,
      environmentId: body.environmentId,
      position: body.position,
    });

    notifyTaskCreated(task);
    res.status(201).json(task);
  } catch (error) {
    console.error('[Tasks API] Failed to create task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * POST /api/tasks/batch
 * Create multiple tasks at once
 */
router.post('/batch', (req, res) => {
  try {
    const body: CreateTaskBatchRequest = req.body;

    if (!body.tasks || !Array.isArray(body.tasks) || body.tasks.length === 0) {
      return res.status(400).json({ error: 'Missing or empty tasks array' });
    }

    // Validate all tasks before creating
    for (const taskReq of body.tasks) {
      if (!taskReq.name || !taskReq.prompt || !taskReq.project) {
        return res.status(400).json({
          error: 'Each task must have name, prompt, and project',
        });
      }
    }

    const tasks = tasksDb.createTaskBatch(
      body.tasks.map((t) => ({
        name: t.name,
        prompt: t.prompt,
        project: t.project,
        mode: t.mode || 'interactive',
        dependsOn: t.dependsOn || [],
        useWorktree: t.useWorktree || false,
        environmentId: t.environmentId,
        position: t.position,
      }))
    );

    // Notify for each created task
    for (const task of tasks) {
      notifyTaskCreated(task);
    }

    res.status(201).json({ tasks });
  } catch (error) {
    console.error('[Tasks API] Failed to create task batch:', error);
    res.status(500).json({ error: 'Failed to create task batch' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a pending task
 */
router.delete('/:id', (req, res) => {
  try {
    const task = tasksDb.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Only allow deleting pending/ready tasks
    if (!['pending', 'ready', 'paused'].includes(task.status)) {
      return res.status(400).json({
        error: `Cannot delete task with status '${task.status}'`,
      });
    }

    const success = tasksDb.deleteTask(req.params.id);
    if (success) {
      notifyTaskRemoved(req.params.id);
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete task' });
    }
  } catch (error) {
    console.error('[Tasks API] Failed to delete task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * PATCH /api/tasks/:id/reorder
 * Change task position in the queue
 */
router.patch('/:id/reorder', (req, res) => {
  try {
    const { position } = req.body;

    if (typeof position !== 'number') {
      return res.status(400).json({ error: 'Position must be a number' });
    }

    const success = tasksDb.reorderTask(req.params.id, position);
    if (success) {
      const task = tasksDb.getTask(req.params.id);
      if (task) {
        notifyTaskUpdated(task);
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    console.error('[Tasks API] Failed to reorder task:', error);
    res.status(500).json({ error: 'Failed to reorder task' });
  }
});

// ============================================================================
// Queue Control Operations
// ============================================================================

/**
 * POST /api/tasks/:id/retry
 * Retry a failed task
 */
router.post('/:id/retry', (req, res) => {
  try {
    const awaitingId = getFailedTaskAwaitingDecision();
    if (awaitingId !== req.params.id) {
      return res.status(400).json({
        error: awaitingId
          ? `Another task (${awaitingId}) is awaiting decision`
          : 'No task is awaiting retry decision',
      });
    }

    const task = retryTask(req.params.id);
    if (task) {
      res.json({ success: true, task });
    } else {
      res.status(500).json({ error: 'Failed to retry task' });
    }
  } catch (error) {
    console.error('[Tasks API] Failed to retry task:', error);
    res.status(500).json({ error: 'Failed to retry task' });
  }
});

/**
 * POST /api/tasks/:id/skip
 * Skip a failed task and propagate to dependents
 */
router.post('/:id/skip', (req, res) => {
  try {
    const awaitingId = getFailedTaskAwaitingDecision();
    if (awaitingId !== req.params.id) {
      return res.status(400).json({
        error: awaitingId
          ? `Another task (${awaitingId}) is awaiting decision`
          : 'No task is awaiting skip decision',
      });
    }

    const skippedIds = skipTask(req.params.id);
    res.json({ success: true, skippedIds });
  } catch (error) {
    console.error('[Tasks API] Failed to skip task:', error);
    res.status(500).json({ error: 'Failed to skip task' });
  }
});

/**
 * POST /api/tasks/stop
 * Stop all tasks and pause the queue
 */
router.post('/stop', (_req, res) => {
  try {
    stopAllTasks();
    res.json({ success: true });
  } catch (error) {
    console.error('[Tasks API] Failed to stop all tasks:', error);
    res.status(500).json({ error: 'Failed to stop all tasks' });
  }
});

/**
 * POST /api/tasks/pause
 * Pause the queue (don't start new tasks)
 */
router.post('/pause', (_req, res) => {
  try {
    pauseQueue();
    res.json({ success: true, isPaused: true });
  } catch (error) {
    console.error('[Tasks API] Failed to pause queue:', error);
    res.status(500).json({ error: 'Failed to pause queue' });
  }
});

/**
 * POST /api/tasks/resume
 * Resume the queue
 */
router.post('/resume', (_req, res) => {
  try {
    resumeQueue();
    res.json({ success: true, isPaused: false });
  } catch (error) {
    console.error('[Tasks API] Failed to resume queue:', error);
    res.status(500).json({ error: 'Failed to resume queue' });
  }
});

/**
 * POST /api/tasks/unpause
 * Unpause the queue (alias for resume)
 */
router.post('/unpause', (_req, res) => {
  try {
    unpauseQueue();
    res.json({ success: true, isPaused: false });
  } catch (error) {
    console.error('[Tasks API] Failed to unpause queue:', error);
    res.status(500).json({ error: 'Failed to unpause queue' });
  }
});

// ============================================================================
// Task History
// ============================================================================

/**
 * GET /api/tasks/:id/history
 * Get history for a specific task
 */
router.get('/:id/history', (req, res) => {
  try {
    const task = tasksDb.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const history = tasksDb.getTaskHistory(req.params.id);
    res.json({ history });
  } catch (error) {
    console.error('[Tasks API] Failed to get task history:', error);
    res.status(500).json({ error: 'Failed to get task history' });
  }
});

// ============================================================================
// Template Operations
// ============================================================================

/**
 * GET /api/task-templates
 * List all templates
 */
router.get('/templates', (_req, res) => {
  try {
    const templates = tasksDb.getAllTemplates();
    res.json({ templates });
  } catch (error) {
    console.error('[Tasks API] Failed to list templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/**
 * GET /api/task-templates/:id
 * Get a specific template
 */
router.get('/templates/:id', (req, res) => {
  try {
    const template = tasksDb.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('[Tasks API] Failed to get template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * POST /api/task-templates
 * Create a new template
 */
router.post('/templates', (req, res) => {
  try {
    const body: CreateTemplateRequest = req.body;

    if (!body.name || !body.steps || !Array.isArray(body.steps) || body.steps.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: name, steps' });
    }

    // Validate steps
    for (const step of body.steps) {
      if (!step.name || !step.prompt || !step.mode) {
        return res.status(400).json({
          error: 'Each step must have name, prompt, and mode',
        });
      }
    }

    const template = tasksDb.createTemplate({
      name: body.name,
      description: body.description,
      steps: body.steps,
      variables: body.variables,
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('[Tasks API] Failed to create template:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Template name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create template' });
    }
  }
});

/**
 * PUT /api/task-templates/:id
 * Update a template
 */
router.put('/templates/:id', (req, res) => {
  try {
    const body: Partial<CreateTemplateRequest> = req.body;

    const template = tasksDb.updateTemplate(req.params.id, {
      name: body.name,
      description: body.description,
      steps: body.steps,
      variables: body.variables,
    });

    if (template) {
      res.json(template);
    } else {
      res.status(404).json({ error: 'Template not found' });
    }
  } catch (error) {
    console.error('[Tasks API] Failed to update template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * DELETE /api/task-templates/:id
 * Delete a template
 */
router.delete('/templates/:id', (req, res) => {
  try {
    const success = tasksDb.deleteTemplate(req.params.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Template not found' });
    }
  } catch (error) {
    console.error('[Tasks API] Failed to delete template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * POST /api/task-templates/:id/instantiate
 * Create tasks from a template
 */
router.post('/templates/:id/instantiate', (req, res) => {
  try {
    const body: InstantiateTemplateRequest = req.body;

    if (!body.project) {
      return res.status(400).json({ error: 'Missing required field: project' });
    }

    const tasks = tasksDb.instantiateTemplate(req.params.id, body.project, body.variables || {});

    if (tasks.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Notify for each created task
    for (const task of tasks) {
      notifyTaskCreated(task);
    }

    res.status(201).json({ tasks });
  } catch (error) {
    console.error('[Tasks API] Failed to instantiate template:', error);
    res.status(500).json({ error: 'Failed to instantiate template' });
  }
});

export function createTaskRoutes(): RouterType {
  return router;
}

export default router;
