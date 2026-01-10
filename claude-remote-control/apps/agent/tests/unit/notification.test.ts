/**
 * Notification route tests
 * Tests for Claude Code Notification hook handling and status updates
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { EventEmitter } from 'events';

// Track execSync mock behavior
let tmuxSessionExists = true;

// Mock config
const mockConfig = {
  machine: { id: 'test-machine', name: 'Test Machine' },
  projects: {
    basePath: '/tmp/test-projects',
    whitelist: ['allowed-project'],
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
  readdir: vi.fn().mockResolvedValue([]),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process - key mock for tmux session existence
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    if (callback) callback(null, { stdout: '', stderr: '' });
  }),
  execSync: vi.fn((cmd: string) => {
    // Check for tmux has-session command
    if (cmd.includes('tmux has-session')) {
      if (!tmuxSessionExists) {
        throw new Error('session not found');
      }
      return '';
    }
    return '';
  }),
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

// Mock git functions
vi.mock('../../src/git.js', () => ({
  cloneRepo: vi.fn(),
  extractProjectName: vi.fn(),
  listFiles: vi.fn().mockResolvedValue([]),
  getFileContent: vi.fn().mockResolvedValue({ content: '', type: 'text' }),
  openFileInEditor: vi.fn().mockResolvedValue({ success: true }),
  getChangesSummary: vi.fn().mockResolvedValue({ staged: [], unstaged: [], untracked: [] }),
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

// Import status module to access in-memory status map
import { tmuxSessionStatus } from '../../src/status.js';

describe('Notification Route - Permission Status Updates', () => {
  let server: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    tmuxSessionExists = true; // Reset to default

    const { createServer } = await import('../../src/server.js');
    server = await createServer();
  });

  afterEach(() => {
    if (server?.close) {
      server.close();
    }
  });

  describe('POST /api/notification', () => {
    it('accepts notification when tmux session exists', async () => {
      tmuxSessionExists = true;

      const res = await request(server).post('/api/notification').send({
        tmux_session: 'project--existing-session-42',
        hook_event_name: 'Notification',
        tool_name: 'Write',
        cwd: '/Users/test/projects/project',
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('rejects notification when tmux session does not exist', async () => {
      tmuxSessionExists = false;

      const res = await request(server).post('/api/notification').send({
        tmux_session: 'project--ghost-session-99',
        hook_event_name: 'Notification',
        tool_name: 'Write',
      });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });

    it('rejects notification without tmux_session field', async () => {
      const res = await request(server).post('/api/notification').send({
        hook_event_name: 'Notification',
        tool_name: 'Write',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing tmux_session');
    });

    it('sets attention reason to permission when tool_name is provided', async () => {
      tmuxSessionExists = true;
      const sessionName = 'project--test-session-1';

      // Send notification to set needs_attention
      const res = await request(server).post('/api/notification').send({
        tmux_session: sessionName,
        hook_event_name: 'Notification',
        tool_name: 'Edit',
        cwd: '/Users/test/projects/project',
      });

      expect(res.status).toBe(200);

      // Verify the status was set in the in-memory map
      const status = tmuxSessionStatus.get(sessionName);
      expect(status).toBeDefined();
      expect(status?.status).toBe('needs_attention');
      expect(status?.attentionReason).toBe('permission');
    });

    it('defaults attention reason to input when tool_name is not provided', async () => {
      tmuxSessionExists = true;
      const sessionName = 'project--test-session-2';

      const res = await request(server).post('/api/notification').send({
        tmux_session: sessionName,
        hook_event_name: 'Notification',
        cwd: '/Users/test/projects/project',
      });

      expect(res.status).toBe(200);

      // Verify the status was set in the in-memory map
      const status = tmuxSessionStatus.get(sessionName);
      expect(status).toBeDefined();
      expect(status?.status).toBe('needs_attention');
      expect(status?.attentionReason).toBe('input');
    });

    it('includes tool name in lastEvent when permission is requested', async () => {
      tmuxSessionExists = true;
      const sessionName = 'project--test-session-3';

      await request(server).post('/api/notification').send({
        tmux_session: sessionName,
        hook_event_name: 'Notification',
        tool_name: 'Write',
        cwd: '/Users/test/projects/project',
      });

      // Verify lastEvent in the in-memory map
      const status = tmuxSessionStatus.get(sessionName);
      expect(status?.lastEvent).toBe('Permission: Write');
    });

    it('extracts project from cwd path', async () => {
      tmuxSessionExists = true;
      const sessionName = 'myproject--test-session-4';

      await request(server).post('/api/notification').send({
        tmux_session: sessionName,
        hook_event_name: 'Notification',
        tool_name: 'Bash',
        cwd: '/Users/test/Dev/myproject',
      });

      // Verify project in the in-memory map
      const status = tmuxSessionStatus.get(sessionName);
      expect(status?.project).toBe('myproject');
    });

    it('transitions back to working when heartbeat is received after notification', async () => {
      tmuxSessionExists = true;
      const sessionName = 'project--test-session-5';

      // First send notification to set needs_attention
      await request(server).post('/api/notification').send({
        tmux_session: sessionName,
        hook_event_name: 'Notification',
        tool_name: 'Write',
        cwd: '/Users/test/projects/project',
      });

      // Verify status is needs_attention
      let status = tmuxSessionStatus.get(sessionName);
      expect(status?.status).toBe('needs_attention');

      // Then send heartbeat to transition back to working
      await request(server).post('/api/heartbeat').send({
        tmux_session: sessionName,
        cwd: '/Users/test/projects/project',
      });

      // Verify status is back to working
      status = tmuxSessionStatus.get(sessionName);
      expect(status?.status).toBe('working');
    });
  });
});
