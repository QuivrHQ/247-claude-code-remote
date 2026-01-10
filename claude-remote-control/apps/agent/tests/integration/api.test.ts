import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { EventEmitter } from 'events';
import express from 'express';

// Mock config
const mockConfig = {
  machine: { id: 'test-machine', name: 'Test Machine' },
  projects: {
    basePath: '/tmp/test-projects',
    whitelist: ['allowed-project', 'another-project'],
  },
  editor: {
    enabled: false,
    portRange: { start: 4680, end: 4699 },
    idleTimeout: 60000,
  },
  dashboard: {
    apiUrl: 'http://localhost:3001/api',
    apiKey: 'test-key',
  },
};

vi.mock('../../src/config.js', () => ({
  config: mockConfig,
  loadConfig: () => mockConfig,
  default: mockConfig,
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([
    { name: 'allowed-project', isDirectory: () => true },
    { name: 'another-project', isDirectory: () => true },
    { name: 'unlisted-project', isDirectory: () => true },
    { name: '.hidden', isDirectory: () => true },
    { name: 'file.txt', isDirectory: () => false },
  ]),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    if (callback) callback(null, { stdout: '', stderr: '' });
  }),
  execSync: vi.fn(() => ''),
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    proc.pid = 12345;
    return proc;
  }),
}));

// Mock node-pty
vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as any;
    proc.write = vi.fn();
    proc.resize = vi.fn();
    proc.kill = vi.fn();
    proc.onData = (cb: any) => proc.on('data', cb);
    proc.onExit = (cb: any) => proc.on('exit', cb);
    return proc;
  }),
}));

// Mock git functions
vi.mock('../../src/git.js', () => ({
  cloneRepo: vi.fn().mockResolvedValue({
    success: true,
    projectName: 'test-repo',
    path: '/tmp/test-projects/test-repo',
  }),
  extractProjectName: vi.fn().mockReturnValue('test-repo'),
}));

// Mock terminal
vi.mock('../../src/terminal.js', () => ({
  createTerminal: vi.fn(() => ({
    write: vi.fn(),
    resize: vi.fn(),
    onData: vi.fn(),
    onExit: vi.fn(),
    kill: vi.fn(),
    detach: vi.fn(),
    captureHistory: vi.fn().mockResolvedValue(''),
    isExistingSession: vi.fn().mockReturnValue(false),
  })),
}));

// Mock editor
vi.mock('../../src/editor.js', () => ({
  initEditor: vi.fn(),
  getOrStartEditor: vi.fn(),
  stopEditor: vi.fn(),
  getEditorStatus: vi.fn().mockReturnValue({ running: false }),
  getAllEditors: vi.fn().mockReturnValue([]),
  updateEditorActivity: vi.fn(),
  shutdownAllEditors: vi.fn(),
}));

// Mock database modules
vi.mock('../../src/db/index.js', () => ({
  initDatabase: vi.fn().mockReturnValue({}),
  closeDatabase: vi.fn(),
  migrateEnvironmentsFromJson: vi.fn().mockReturnValue(false),
  getDatabaseStats: vi.fn().mockReturnValue({ sessions: 0, history: 0, environments: 0 }),
  RETENTION_CONFIG: {
    sessionMaxAge: 24 * 60 * 60 * 1000,
    historyMaxAge: 7 * 24 * 60 * 60 * 1000,
    cleanupInterval: 60 * 60 * 1000,
  },
}));

vi.mock('../../src/db/sessions.js', () => ({
  getAllSessions: vi.fn().mockReturnValue([]),
  getSession: vi.fn().mockReturnValue(null),
  upsertSession: vi.fn(),
  deleteSession: vi.fn().mockReturnValue(true),
  cleanupStaleSessions: vi.fn().mockReturnValue(0),
  reconcileWithTmux: vi.fn(),
  toHookStatus: vi.fn().mockReturnValue({}),
  clearSessionEnvironmentId: vi.fn(),
}));

vi.mock('../../src/db/history.js', () => ({
  recordStatusChange: vi.fn(),
  getSessionHistory: vi.fn().mockReturnValue([]),
  cleanupOldHistory: vi.fn().mockReturnValue(0),
}));

vi.mock('../../src/db/environments.js', () => ({
  getEnvironmentsMetadata: vi.fn().mockReturnValue([]),
  getEnvironmentMetadata: vi.fn().mockReturnValue(undefined),
  getEnvironment: vi.fn().mockReturnValue(undefined),
  createEnvironment: vi.fn().mockReturnValue({ id: 'test-env' }),
  updateEnvironment: vi.fn().mockReturnValue(null),
  deleteEnvironment: vi.fn().mockReturnValue(false),
  getEnvironmentVariables: vi.fn().mockReturnValue({}),
  setSessionEnvironment: vi.fn(),
  getSessionEnvironment: vi.fn().mockReturnValue(undefined),
  clearSessionEnvironment: vi.fn(),
  ensureDefaultEnvironment: vi.fn(),
}));

// Mock tasks database
vi.mock('../../src/db/tasks.js', () => ({
  createTask: vi.fn(),
  getTask: vi.fn().mockReturnValue(null),
  getAllTasks: vi.fn().mockReturnValue([]),
  getTasksByStatus: vi.fn().mockReturnValue([]),
  getNextRunnableTask: vi.fn().mockReturnValue(null),
  updateTaskStatus: vi.fn(),
  deleteTask: vi.fn().mockReturnValue(true),
  getDependentTasks: vi.fn().mockReturnValue([]),
  propagateSkip: vi.fn().mockReturnValue([]),
  incrementTaskRetry: vi.fn().mockReturnValue(1),
  linkTaskToSession: vi.fn(),
  pauseAllTasks: vi.fn().mockReturnValue(0),
  resumeAllTasks: vi.fn().mockReturnValue(0),
  createTaskBatch: vi.fn().mockReturnValue([]),
  createTemplate: vi.fn(),
  getTemplate: vi.fn().mockReturnValue(null),
  getAllTemplates: vi.fn().mockReturnValue([]),
  deleteTemplate: vi.fn().mockReturnValue(true),
  instantiateTemplate: vi.fn().mockReturnValue([]),
  getTaskHistory: vi.fn().mockReturnValue([]),
  getReadyTasks: vi.fn().mockReturnValue([]),
  reorderTask: vi.fn().mockReturnValue(true),
}));

// Mock task queue service
vi.mock('../../src/services/task-queue.js', () => ({
  startTaskQueueExecutor: vi.fn(),
  stopTaskQueueExecutor: vi.fn(),
  retryTask: vi.fn().mockReturnValue(null),
  skipTask: vi.fn().mockReturnValue([]),
  stopAllTasks: vi.fn(),
  resumeQueue: vi.fn(),
  pauseQueue: vi.fn(),
  unpauseQueue: vi.fn(),
  isQueuePausedState: vi.fn().mockReturnValue(false),
  getFailedTaskAwaitingDecision: vi.fn().mockReturnValue(null),
  broadcastTaskList: vi.fn(),
  notifyTaskCreated: vi.fn(),
  notifyTaskUpdated: vi.fn(),
  notifyTaskRemoved: vi.fn(),
}));

describe('Agent REST API', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    const { createServer } = await import('../../src/server.js');
    server = await createServer();
    app = server._events?.request || server;
  });

  afterAll(() => {
    if (server?.close) {
      server.close();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    it('returns the whitelist', async () => {
      const res = await request(server).get('/api/projects');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(['allowed-project', 'another-project']);
    });
  });

  describe('GET /api/folders', () => {
    it('returns non-hidden directories', async () => {
      const res = await request(server).get('/api/folders');

      expect(res.status).toBe(200);
      expect(res.body).toContain('allowed-project');
      expect(res.body).toContain('another-project');
      expect(res.body).toContain('unlisted-project');
      expect(res.body).not.toContain('.hidden');
      expect(res.body).not.toContain('file.txt');
    });

    it('sorts folders alphabetically', async () => {
      const res = await request(server).get('/api/folders');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([...res.body].sort());
    });
  });

  describe('GET /api/clone/preview', () => {
    it('extracts project name from URL', async () => {
      const { extractProjectName } = await import('../../src/git.js');
      vi.mocked(extractProjectName).mockReturnValue('my-project');

      const res = await request(server)
        .get('/api/clone/preview')
        .query({ url: 'https://github.com/user/my-project' });

      expect(res.status).toBe(200);
      expect(res.body.projectName).toBe('my-project');
    });

    it('returns error for missing URL', async () => {
      const res = await request(server).get('/api/clone/preview');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing url parameter');
    });
  });

  describe('POST /api/clone', () => {
    it('clones repository successfully', async () => {
      const { cloneRepo } = await import('../../src/git.js');
      vi.mocked(cloneRepo).mockResolvedValue({
        success: true,
        projectName: 'cloned-repo',
        path: '/tmp/test-projects/cloned-repo',
      });

      const res = await request(server)
        .post('/api/clone')
        .send({ repoUrl: 'https://github.com/user/repo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.projectName).toBe('cloned-repo');
    });

    it('returns error for missing repoUrl', async () => {
      const res = await request(server).post('/api/clone').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing repoUrl');
    });

    it('handles clone failure', async () => {
      const { cloneRepo } = await import('../../src/git.js');
      vi.mocked(cloneRepo).mockResolvedValue({
        success: false,
        projectName: 'repo',
        path: '',
        error: 'Repository not found',
      });

      const res = await request(server)
        .post('/api/clone')
        .send({ repoUrl: 'https://github.com/user/nonexistent' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Repository not found');
    });

    it('accepts custom project name', async () => {
      const { cloneRepo } = await import('../../src/git.js');
      vi.mocked(cloneRepo).mockResolvedValue({
        success: true,
        projectName: 'custom-name',
        path: '/tmp/test-projects/custom-name',
      });

      const res = await request(server).post('/api/clone').send({
        repoUrl: 'https://github.com/user/repo',
        projectName: 'custom-name',
      });

      expect(res.status).toBe(200);
      expect(res.body.projectName).toBe('custom-name');
    });
  });

  describe('GET /api/sessions', () => {
    it('returns empty array when no sessions', async () => {
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((cmd: any, opts: any, cb: any) => {
        const callback = typeof opts === 'function' ? opts : cb;
        if (callback) callback(new Error('no sessions'), null, null);
        return null as any;
      });

      const res = await request(server).get('/api/sessions');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/sessions/:sessionName/preview', () => {
    it('validates session name format', async () => {
      const res = await request(server).get('/api/sessions/invalid;rm -rf/preview');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid session name');
    });

    it('accepts valid session name', async () => {
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((cmd: any, opts: any, cb: any) => {
        const callback = typeof opts === 'function' ? opts : cb;
        if (callback) callback(null, { stdout: 'line1\nline2\n', stderr: '' });
        return null as any;
      });

      const res = await request(server).get('/api/sessions/project--valid-session-42/preview');

      // Should not be a 400 error
      expect(res.status).not.toBe(400);
    });
  });

  describe('DELETE /api/sessions/:sessionName', () => {
    it('validates session name format', async () => {
      const res = await request(server).delete('/api/sessions/invalid;rm -rf/');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid session name');
    });
  });
});
