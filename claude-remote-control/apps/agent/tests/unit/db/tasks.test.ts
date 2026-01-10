import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initTestDatabase, closeDatabase } from '../../../src/db/index.js';
import * as tasksDb from '../../../src/db/tasks.js';
import type { Task, TaskTemplate } from '247-shared';

describe('Tasks Database', () => {
  beforeEach(() => {
    initTestDatabase();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('Task CRUD', () => {
    it('should create a task', () => {
      const task = tasksDb.createTask({
        name: 'Test Task',
        prompt: 'Do something',
        project: 'test-project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.name).toBe('Test Task');
      expect(task.prompt).toBe('Do something');
      expect(task.project).toBe('test-project');
      expect(task.mode).toBe('interactive');
      expect(task.status).toBe('pending');
      expect(task.position).toBe(0);
    });

    it('should get a task by id', () => {
      const created = tasksDb.createTask({
        name: 'Test Task',
        prompt: 'Do something',
        project: 'test-project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      const fetched = tasksDb.getTask(created.id);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(created.id);
    });

    it('should list all tasks', () => {
      tasksDb.createTask({
        name: 'Task 1',
        prompt: 'Prompt 1',
        project: 'project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });
      tasksDb.createTask({
        name: 'Task 2',
        prompt: 'Prompt 2',
        project: 'project',
        mode: 'print',
        dependsOn: [],
        useWorktree: false,
      });

      const tasks = tasksDb.getAllTasks();
      expect(tasks).toHaveLength(2);
    });

    it('should update task status', () => {
      const task = tasksDb.createTask({
        name: 'Test Task',
        prompt: 'Do something',
        project: 'test-project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      const updated = tasksDb.updateTaskStatus(task.id, 'running');
      expect(updated).toBeDefined();
      expect(updated?.status).toBe('running');
      expect(updated?.startedAt).toBeDefined();
    });

    it('should delete a task', () => {
      const task = tasksDb.createTask({
        name: 'Test Task',
        prompt: 'Do something',
        project: 'test-project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      const success = tasksDb.deleteTask(task.id);
      expect(success).toBe(true);

      const deleted = tasksDb.getTask(task.id);
      expect(deleted).toBeNull();
    });
  });

  describe('Task Dependencies', () => {
    it('should create tasks with dependencies', () => {
      const task1 = tasksDb.createTask({
        name: 'Task 1',
        prompt: 'Step 1',
        project: 'project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      const task2 = tasksDb.createTask({
        name: 'Task 2',
        prompt: 'Step 2',
        project: 'project',
        mode: 'interactive',
        dependsOn: [task1.id],
        useWorktree: false,
      });

      expect(task2.dependsOn).toContain(task1.id);
    });

    it('should get dependent tasks', () => {
      const task1 = tasksDb.createTask({
        name: 'Task 1',
        prompt: 'Step 1',
        project: 'project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      const task2 = tasksDb.createTask({
        name: 'Task 2',
        prompt: 'Step 2',
        project: 'project',
        mode: 'interactive',
        dependsOn: [task1.id],
        useWorktree: false,
      });

      const dependents = tasksDb.getDependentTasks(task1.id);
      expect(dependents).toHaveLength(1);
      expect(dependents[0].id).toBe(task2.id);
    });

    it('should propagate skip to dependent tasks', () => {
      const task1 = tasksDb.createTask({
        name: 'Task 1',
        prompt: 'Step 1',
        project: 'project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      const task2 = tasksDb.createTask({
        name: 'Task 2',
        prompt: 'Step 2',
        project: 'project',
        mode: 'interactive',
        dependsOn: [task1.id],
        useWorktree: false,
      });

      const task3 = tasksDb.createTask({
        name: 'Task 3',
        prompt: 'Step 3',
        project: 'project',
        mode: 'interactive',
        dependsOn: [task2.id],
        useWorktree: false,
      });

      // Skip task1 - should cascade to task2 and task3
      const skipped = tasksDb.propagateSkip(task1.id);
      expect(skipped).toContain(task1.id);
      expect(skipped).toContain(task2.id);
      expect(skipped).toContain(task3.id);

      const t1 = tasksDb.getTask(task1.id);
      const t2 = tasksDb.getTask(task2.id);
      const t3 = tasksDb.getTask(task3.id);

      expect(t1?.status).toBe('skipped');
      expect(t2?.status).toBe('skipped');
      expect(t3?.status).toBe('skipped');
    });
  });

  describe('Task Batch Operations', () => {
    it('should create multiple tasks in batch', () => {
      const tasks = tasksDb.createTaskBatch([
        {
          name: 'Task 1',
          prompt: 'Prompt 1',
          project: 'project',
          mode: 'interactive',
          dependsOn: [],
          useWorktree: false,
        },
        {
          name: 'Task 2',
          prompt: 'Prompt 2',
          project: 'project',
          mode: 'print',
          dependsOn: [],
          useWorktree: false,
        },
        {
          name: 'Task 3',
          prompt: 'Prompt 3',
          project: 'project',
          mode: 'trust',
          dependsOn: [],
          useWorktree: false,
        },
      ]);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].position).toBe(0);
      expect(tasks[1].position).toBe(1);
      expect(tasks[2].position).toBe(2);
    });

    it('should pause and resume all tasks', () => {
      tasksDb.createTask({
        name: 'Task 1',
        prompt: 'Prompt 1',
        project: 'project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });
      tasksDb.createTask({
        name: 'Task 2',
        prompt: 'Prompt 2',
        project: 'project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      // Pause all
      const paused = tasksDb.pauseAllTasks();
      expect(paused).toBe(2);

      const tasks = tasksDb.getAllTasks();
      expect(tasks.every((t) => t.status === 'paused')).toBe(true);

      // Resume all
      const resumed = tasksDb.resumeAllTasks();
      expect(resumed).toBe(2);

      const resumedTasks = tasksDb.getAllTasks();
      expect(resumedTasks.every((t) => t.status === 'pending')).toBe(true);
    });
  });

  describe('Task Templates', () => {
    it('should create a template', () => {
      const template = tasksDb.createTemplate({
        name: 'Feature Template',
        description: 'Template for new features',
        steps: [
          { name: 'Setup', prompt: 'Create files', mode: 'interactive' },
          { name: 'Implement', prompt: 'Write code', mode: 'trust' },
          { name: 'Test', prompt: 'Run tests', mode: 'print' },
        ],
      });

      expect(template).toBeDefined();
      expect(template.name).toBe('Feature Template');
      expect(template.steps).toHaveLength(3);
    });

    it('should list all templates', () => {
      tasksDb.createTemplate({
        name: 'Template 1',
        steps: [{ name: 'Step', prompt: 'Do', mode: 'interactive' }],
      });
      tasksDb.createTemplate({
        name: 'Template 2',
        steps: [{ name: 'Step', prompt: 'Do', mode: 'interactive' }],
      });

      const templates = tasksDb.getAllTemplates();
      expect(templates).toHaveLength(2);
    });

    it('should instantiate a template', () => {
      const template = tasksDb.createTemplate({
        name: 'Build Template',
        steps: [
          { name: 'Step 1', prompt: 'First step', mode: 'interactive' },
          { name: 'Step 2', prompt: 'Second step', mode: 'print', dependsOnStep: 0 },
          { name: 'Step 3', prompt: 'Third step', mode: 'trust', dependsOnStep: 1 },
        ],
      });

      const tasks = tasksDb.instantiateTemplate(template.id, 'test-project', {});

      expect(tasks).toHaveLength(3);
      expect(tasks[0].name).toBe('Step 1');
      expect(tasks[0].dependsOn).toHaveLength(0);

      // Task 2 depends on Task 1
      expect(tasks[1].dependsOn).toContain(tasks[0].id);

      // Task 3 depends on Task 2
      expect(tasks[2].dependsOn).toContain(tasks[1].id);
    });

    it('should delete a template', () => {
      const template = tasksDb.createTemplate({
        name: 'To Delete',
        steps: [{ name: 'Step', prompt: 'Do', mode: 'interactive' }],
      });

      const success = tasksDb.deleteTemplate(template.id);
      expect(success).toBe(true);

      const deleted = tasksDb.getTemplate(template.id);
      expect(deleted).toBeNull();
    });
  });

  describe('Task History', () => {
    it('should record task history', () => {
      const task = tasksDb.createTask({
        name: 'Test Task',
        prompt: 'Do something',
        project: 'test-project',
        mode: 'interactive',
        dependsOn: [],
        useWorktree: false,
      });

      // Update status a few times
      tasksDb.updateTaskStatus(task.id, 'running');
      tasksDb.updateTaskStatus(task.id, 'completed');

      const history = tasksDb.getTaskHistory(task.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });
});
