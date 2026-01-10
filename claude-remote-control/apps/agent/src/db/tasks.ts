import { getDatabase } from './index.js';
import type { DbTask, DbTaskTemplate, DbTaskHistory } from './schema.js';
import type {
  Task,
  TaskTemplate,
  TaskTemplateStep,
  TaskStatus,
  TaskExecutionMode,
  CreateTaskRequest,
  CreateTemplateRequest,
} from '247-shared';
import { randomUUID } from 'crypto';

// ============================================================================
// Task CRUD Operations
// ============================================================================

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  return `task_${randomUUID().split('-')[0]}`;
}

/**
 * Generate a unique template ID
 */
function generateTemplateId(): string {
  return `tmpl_${randomUUID().split('-')[0]}`;
}

/**
 * Convert DbTask to Task
 */
function dbTaskToTask(row: DbTask): Task {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    project: row.project,
    mode: row.mode as TaskExecutionMode,
    status: row.status as TaskStatus,
    position: row.position,
    dependsOn: JSON.parse(row.depends_on) as string[],
    sessionName: row.session_name ?? undefined,
    useWorktree: row.use_worktree === 1,
    environmentId: row.environment_id ?? undefined,
    error: row.error ?? undefined,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

/**
 * Convert DbTaskTemplate to TaskTemplate
 */
function dbTemplateToTemplate(row: DbTaskTemplate): TaskTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    steps: JSON.parse(row.steps) as TaskTemplateStep[],
    variables: row.variables ? JSON.parse(row.variables) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get a task by ID
 */
export function getTask(id: string): Task | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as DbTask | undefined;
  return row ? dbTaskToTask(row) : null;
}

/**
 * Get all tasks ordered by position
 */
export function getAllTasks(): Task[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM tasks ORDER BY position ASC').all() as DbTask[];
  return rows.map(dbTaskToTask);
}

/**
 * Get tasks by status
 */
export function getTasksByStatus(status: TaskStatus): Task[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM tasks WHERE status = ? ORDER BY position ASC')
    .all(status) as DbTask[];
  return rows.map(dbTaskToTask);
}

/**
 * Get tasks by project
 */
export function getTasksByProject(project: string): Task[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM tasks WHERE project = ? ORDER BY position ASC')
    .all(project) as DbTask[];
  return rows.map(dbTaskToTask);
}

/**
 * Get the next task position
 */
function getNextPosition(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT MAX(position) as maxPos FROM tasks').get() as {
    maxPos: number | null;
  };
  return (row.maxPos ?? -1) + 1;
}

/**
 * Create a new task
 */
export function createTask(input: CreateTaskRequest): Task {
  const db = getDatabase();
  const now = Date.now();
  const id = generateTaskId();
  const position = input.position ?? getNextPosition();

  // Shift existing tasks if inserting at a specific position
  if (input.position !== undefined) {
    db.prepare('UPDATE tasks SET position = position + 1 WHERE position >= ?').run(position);
  }

  const stmt = db.prepare(`
    INSERT INTO tasks (
      id, name, prompt, project, mode, status, position,
      depends_on, use_worktree, environment_id, retry_count, created_at
    )
    VALUES (
      @id, @name, @prompt, @project, @mode, @status, @position,
      @dependsOn, @useWorktree, @environmentId, 0, @createdAt
    )
  `);

  stmt.run({
    id,
    name: input.name,
    prompt: input.prompt,
    project: input.project,
    mode: input.mode ?? 'interactive',
    status: 'pending',
    position,
    dependsOn: JSON.stringify(input.dependsOn ?? []),
    useWorktree: input.useWorktree ? 1 : 0,
    environmentId: input.environmentId ?? null,
    createdAt: now,
  });

  // Record history
  recordTaskHistory(id, 'pending', 'created');

  return getTask(id)!;
}

/**
 * Create multiple tasks in a batch
 */
export function createTaskBatch(inputs: CreateTaskRequest[]): Task[] {
  const db = getDatabase();
  const now = Date.now();
  let position = getNextPosition();
  const tasks: Task[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO tasks (
      id, name, prompt, project, mode, status, position,
      depends_on, use_worktree, environment_id, retry_count, created_at
    )
    VALUES (
      @id, @name, @prompt, @project, @mode, @status, @position,
      @dependsOn, @useWorktree, @environmentId, 0, @createdAt
    )
  `);

  const insertMany = db.transaction((items: CreateTaskRequest[]) => {
    for (const input of items) {
      const id = generateTaskId();

      insertStmt.run({
        id,
        name: input.name,
        prompt: input.prompt,
        project: input.project,
        mode: input.mode ?? 'interactive',
        status: 'pending',
        position: position++,
        dependsOn: JSON.stringify(input.dependsOn ?? []),
        useWorktree: input.useWorktree ? 1 : 0,
        environmentId: input.environmentId ?? null,
        createdAt: now,
      });

      recordTaskHistory(id, 'pending', 'created');
      tasks.push(getTask(id)!);
    }
  });

  insertMany(inputs);
  return tasks;
}

/**
 * Update task status
 */
export function updateTaskStatus(
  id: string,
  status: TaskStatus,
  error?: string | null
): Task | null {
  const db = getDatabase();
  const now = Date.now();

  const task = getTask(id);
  if (!task) return null;

  const updates: string[] = ['status = @status', 'error = @error'];
  const params: Record<string, unknown> = { id, status, error: error ?? null };

  if (status === 'running' && !task.startedAt) {
    updates.push('started_at = @startedAt');
    params.startedAt = now;
  }

  if (status === 'completed' || status === 'failed' || status === 'skipped') {
    updates.push('completed_at = @completedAt');
    params.completedAt = now;
  }

  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = @id`).run(params);

  // Record history
  recordTaskHistory(id, status, status === 'failed' ? 'failed' : status);

  return getTask(id);
}

/**
 * Link a task to a session
 */
export function linkTaskToSession(id: string, sessionName: string): boolean {
  const db = getDatabase();
  const result = db.prepare('UPDATE tasks SET session_name = ? WHERE id = ?').run(sessionName, id);
  return result.changes > 0;
}

/**
 * Increment retry count
 */
export function incrementTaskRetry(id: string): Task | null {
  const db = getDatabase();
  const result = db
    .prepare(
      `
    UPDATE tasks SET
      retry_count = retry_count + 1,
      status = 'ready',
      error = NULL,
      started_at = NULL,
      completed_at = NULL
    WHERE id = ?
  `
    )
    .run(id);

  if (result.changes === 0) return null;

  recordTaskHistory(id, 'ready', 'retried');
  return getTask(id);
}

/**
 * Reorder a task to a new position
 */
export function reorderTask(id: string, newPosition: number): boolean {
  const db = getDatabase();
  const task = getTask(id);
  if (!task) return false;

  const oldPosition = task.position;
  if (oldPosition === newPosition) return true;

  // Shift tasks between old and new position
  if (newPosition > oldPosition) {
    db.prepare('UPDATE tasks SET position = position - 1 WHERE position > ? AND position <= ?').run(
      oldPosition,
      newPosition
    );
  } else {
    db.prepare('UPDATE tasks SET position = position + 1 WHERE position >= ? AND position < ?').run(
      newPosition,
      oldPosition
    );
  }

  db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(newPosition, id);
  return true;
}

/**
 * Delete a task (only if pending or ready)
 */
export function deleteTask(id: string): boolean {
  const db = getDatabase();
  const task = getTask(id);
  if (!task || (task.status !== 'pending' && task.status !== 'ready')) {
    return false;
  }

  const position = task.position;
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

  if (result.changes > 0) {
    // Shift remaining tasks
    db.prepare('UPDATE tasks SET position = position - 1 WHERE position > ?').run(position);
    return true;
  }
  return false;
}

/**
 * Delete all completed/failed/skipped tasks
 */
export function cleanupCompletedTasks(): number {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM tasks WHERE status IN ('completed', 'failed', 'skipped')")
    .run();
  return result.changes;
}

/**
 * Pause all pending/ready tasks
 */
export function pauseAllTasks(): number {
  const db = getDatabase();
  const result = db
    .prepare("UPDATE tasks SET status = 'paused' WHERE status IN ('pending', 'ready')")
    .run();
  return result.changes;
}

/**
 * Resume all paused tasks
 */
export function resumeAllTasks(): number {
  const db = getDatabase();
  const result = db.prepare("UPDATE tasks SET status = 'pending' WHERE status = 'paused'").run();
  return result.changes;
}

/**
 * Get tasks that are ready to run (dependencies satisfied)
 */
export function getReadyTasks(): Task[] {
  const allTasks = getAllTasks();

  // Get IDs of completed and skipped tasks
  const completedIds = new Set(
    allTasks.filter((t) => t.status === 'completed' || t.status === 'skipped').map((t) => t.id)
  );

  // Find tasks that are pending with all dependencies satisfied
  const readyTasks: Task[] = [];
  for (const task of allTasks) {
    if (task.status !== 'pending') continue;

    const allDepsSatisfied = task.dependsOn.every((depId: string) => completedIds.has(depId));
    if (allDepsSatisfied) {
      readyTasks.push(task);
    }
  }

  return readyTasks;
}

/**
 * Get the next runnable task (first ready task)
 */
export function getNextRunnableTask(): Task | null {
  // First, promote pending tasks to ready if their dependencies are satisfied
  const readyTasks = getReadyTasks();

  for (const task of readyTasks) {
    // Update status to ready
    updateTaskStatus(task.id, 'ready');
  }

  // Return first ready task
  const tasks = getTasksByStatus('ready');
  return tasks.length > 0 ? tasks[0] : null;
}

/**
 * Check if there's a failed task awaiting decision
 */
export function getFailedTaskAwaitingDecision(): Task | null {
  const tasks = getTasksByStatus('failed');
  return tasks.length > 0 ? tasks[0] : null;
}

/**
 * Get dependent tasks (tasks that depend on the given task)
 */
export function getDependentTasks(taskId: string): Task[] {
  const allTasks = getAllTasks();
  return allTasks.filter((t) => t.dependsOn.includes(taskId));
}

/**
 * Propagate skip to dependent tasks
 */
export function propagateSkip(skippedTaskId: string): string[] {
  const skippedIds: string[] = [];

  // First skip the original task
  const originalTask = getTask(skippedTaskId);
  if (
    originalTask &&
    (originalTask.status === 'pending' ||
      originalTask.status === 'ready' ||
      originalTask.status === 'failed')
  ) {
    updateTaskStatus(skippedTaskId, 'skipped');
    skippedIds.push(skippedTaskId);
  }

  // Then recursively skip dependents
  const dependents = getDependentTasks(skippedTaskId);
  for (const task of dependents) {
    if (task.status === 'pending' || task.status === 'ready') {
      updateTaskStatus(task.id, 'skipped');
      skippedIds.push(task.id);

      // Recursively skip dependents (but don't include already skipped task)
      const nestedDependents = getDependentTasks(task.id);
      for (const nested of nestedDependents) {
        if (nested.status === 'pending' || nested.status === 'ready') {
          const nestedSkipped = propagateSkip(nested.id);
          // Avoid duplicates
          for (const id of nestedSkipped) {
            if (!skippedIds.includes(id)) {
              skippedIds.push(id);
            }
          }
        }
      }
    }
  }

  return skippedIds;
}

// ============================================================================
// Task History Operations
// ============================================================================

/**
 * Record task history event
 */
export function recordTaskHistory(
  taskId: string,
  status: TaskStatus,
  event: string,
  details?: Record<string, unknown>
): void {
  const db = getDatabase();
  db.prepare(
    `
    INSERT INTO task_history (task_id, status, event, details, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(taskId, status, event, details ? JSON.stringify(details) : null, Date.now());
}

/**
 * Get task history
 */
export function getTaskHistory(taskId: string): DbTaskHistory[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM task_history WHERE task_id = ? ORDER BY timestamp ASC')
    .all(taskId) as DbTaskHistory[];
}

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * Get a template by ID
 */
export function getTemplate(id: string): TaskTemplate | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id) as
    | DbTaskTemplate
    | undefined;
  return row ? dbTemplateToTemplate(row) : null;
}

/**
 * Get a template by name
 */
export function getTemplateByName(name: string): TaskTemplate | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM task_templates WHERE name = ?').get(name) as
    | DbTaskTemplate
    | undefined;
  return row ? dbTemplateToTemplate(row) : null;
}

/**
 * Get all templates
 */
export function getAllTemplates(): TaskTemplate[] {
  const db = getDatabase();
  const rows = db
    .prepare('SELECT * FROM task_templates ORDER BY updated_at DESC')
    .all() as DbTaskTemplate[];
  return rows.map(dbTemplateToTemplate);
}

/**
 * Create a new template
 */
export function createTemplate(input: CreateTemplateRequest): TaskTemplate {
  const db = getDatabase();
  const now = Date.now();
  const id = generateTemplateId();

  db.prepare(
    `
    INSERT INTO task_templates (id, name, description, steps, variables, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    input.name,
    input.description ?? null,
    JSON.stringify(input.steps),
    input.variables ? JSON.stringify(input.variables) : null,
    now,
    now
  );

  return getTemplate(id)!;
}

/**
 * Update a template
 */
export function updateTemplate(
  id: string,
  updates: Partial<CreateTemplateRequest>
): TaskTemplate | null {
  const db = getDatabase();
  const existing = getTemplate(id);
  if (!existing) return null;

  const now = Date.now();
  const updateParts: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (updates.name !== undefined) {
    updateParts.push('name = ?');
    params.push(updates.name);
  }
  if (updates.description !== undefined) {
    updateParts.push('description = ?');
    params.push(updates.description);
  }
  if (updates.steps !== undefined) {
    updateParts.push('steps = ?');
    params.push(JSON.stringify(updates.steps));
  }
  if (updates.variables !== undefined) {
    updateParts.push('variables = ?');
    params.push(JSON.stringify(updates.variables));
  }

  params.push(id);
  db.prepare(`UPDATE task_templates SET ${updateParts.join(', ')} WHERE id = ?`).run(...params);

  return getTemplate(id);
}

/**
 * Delete a template
 */
export function deleteTemplate(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM task_templates WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Instantiate a template (create tasks from template)
 */
export function instantiateTemplate(
  templateId: string,
  project: string,
  variables?: Record<string, string>
): Task[] {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const tasks: Task[] = [];
  const idMap = new Map<number, string>(); // stepIndex -> taskId

  // Create tasks for each step
  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i];

    // Substitute variables in prompt
    let prompt = step.prompt;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
    }

    // Determine dependencies
    const dependsOn: string[] = [];
    if (step.dependsOnStep !== undefined) {
      const depTaskId = idMap.get(step.dependsOnStep);
      if (depTaskId) {
        dependsOn.push(depTaskId);
      }
    } else if (i > 0) {
      // Default: depend on previous step
      const prevTaskId = idMap.get(i - 1);
      if (prevTaskId) {
        dependsOn.push(prevTaskId);
      }
    }

    const task = createTask({
      name: step.name,
      prompt,
      project,
      mode: step.mode,
      dependsOn,
      useWorktree: step.useWorktree,
    });

    tasks.push(task);
    idMap.set(i, task.id);
  }

  return tasks;
}
