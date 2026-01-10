import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { AddressInfo } from 'net';
import type { WSStatusMessageFromAgent } from '247-shared';

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

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '0.5.0' })),
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '0.5.0' })),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock database modules
vi.mock('../../src/db/index.js', () => ({
  initDatabase: vi.fn().mockReturnValue({}),
  closeDatabase: vi.fn(),
  migrateEnvironmentsFromJson: vi.fn().mockReturnValue(false),
  RETENTION_CONFIG: {
    sessionMaxAge: 24 * 60 * 60 * 1000,
    historyMaxAge: 7 * 24 * 60 * 60 * 1000,
    cleanupInterval: 60 * 60 * 1000,
    archivedMaxAge: 7 * 24 * 60 * 60 * 1000,
  },
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

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    // Return empty tmux session list
    if (callback) callback(null, { stdout: '', stderr: '' });
  }),
  execSync: vi.fn(() => ''),
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    proc.pid = 12345;
    proc.unref = vi.fn();
    return proc;
  }),
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

// Mock updater to prevent actual updates during tests
vi.mock('../../src/updater.js', () => ({
  triggerUpdate: vi.fn(),
  isUpdateInProgress: vi.fn().mockReturnValue(false),
}));

// Mock version module
vi.mock('../../src/version.js', () => ({
  getAgentVersion: vi.fn().mockReturnValue('0.5.0'),
  needsUpdate: vi.fn((agentVersion: string, webVersion: string) => {
    const [aMajor, aMinor, aPatch] = agentVersion.split('.').map(Number);
    const [bMajor, bMinor, bPatch] = webVersion.split('.').map(Number);
    if (bMajor > aMajor) return true;
    if (bMajor === aMajor && bMinor > aMinor) return true;
    if (bMajor === aMajor && bMinor === aMinor && bPatch > aPatch) return true;
    return false;
  }),
  compareSemver: vi.fn(),
}));

describe('WebSocket Status - Version Check', () => {
  let server: any;
  let port: number;

  beforeAll(async () => {
    const { createServer } = await import('../../src/server.js');
    server = await createServer();

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    if (server?.close) {
      server.close();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Buffer to store messages received before test handlers are attached
  const messageBuffers = new Map<WebSocket, WSStatusMessageFromAgent[]>();

  const connectStatusWS = (version?: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const versionParam = version ? `?v=${encodeURIComponent(version)}` : '';
      const url = `ws://localhost:${port}/status${versionParam}`;
      const ws = new WebSocket(url);

      // Start buffering messages immediately to avoid race conditions
      const buffer: WSStatusMessageFromAgent[] = [];
      messageBuffers.set(ws, buffer);

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString()) as WSStatusMessageFromAgent;
          buffer.push(msg);
        } catch {
          // Ignore parse errors
        }
      });

      ws.on('open', () => resolve(ws));
      ws.on('error', reject);

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  };

  const waitForMessage = (
    ws: WebSocket,
    type: string,
    timeoutMs = 2000
  ): Promise<WSStatusMessageFromAgent> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeoutMs);

      const handler = (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString()) as WSStatusMessageFromAgent;
          if (msg.type === type) {
            clearTimeout(timeout);
            ws.off('message', handler);
            resolve(msg);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.on('message', handler);
    });
  };

  const collectMessages = (
    ws: WebSocket,
    count: number,
    timeoutMs = 2000
  ): Promise<WSStatusMessageFromAgent[]> => {
    return new Promise((resolve) => {
      // Get buffered messages first
      const buffer = messageBuffers.get(ws) || [];

      // If we already have enough messages, resolve immediately
      if (buffer.length >= count) {
        resolve(buffer.slice(0, count));
        return;
      }

      // Wait for more messages if needed
      const timeout = setTimeout(() => resolve([...buffer]), timeoutMs);

      const checkBuffer = () => {
        if (buffer.length >= count) {
          clearTimeout(timeout);
          resolve(buffer.slice(0, count));
        }
      };

      // Check periodically since messages are being added to buffer by connectStatusWS handler
      const interval = setInterval(() => {
        checkBuffer();
        if (buffer.length >= count) {
          clearInterval(interval);
        }
      }, 50);

      // Also clear interval on timeout
      setTimeout(() => clearInterval(interval), timeoutMs);
    });
  };

  describe('Version info message', () => {
    it('sends version-info message on connection', async () => {
      const ws = await connectStatusWS('1.0.0');

      // Collect first 2 messages (version-info and sessions-list)
      const messages = await collectMessages(ws, 2);

      // Find version-info message
      const versionMsg = messages.find((m) => m.type === 'version-info');
      expect(versionMsg).toBeDefined();
      expect((versionMsg as any).agentVersion).toBeDefined();
      expect(typeof (versionMsg as any).agentVersion).toBe('string');

      ws.close();
    });

    it('sends version-info even without version parameter', async () => {
      const ws = await connectStatusWS();

      const messages = await collectMessages(ws, 2);

      const versionMsg = messages.find((m) => m.type === 'version-info');
      expect(versionMsg).toBeDefined();
      expect((versionMsg as any).agentVersion).toBeDefined();

      ws.close();
    });

    it('sends both version-info and sessions-list', async () => {
      const ws = await connectStatusWS('1.0.0');

      // Collect messages
      const messages = await collectMessages(ws, 2);

      // Should have both messages
      const hasVersionInfo = messages.some((m) => m.type === 'version-info');
      const hasSessionsList = messages.some((m) => m.type === 'sessions-list');

      expect(hasVersionInfo).toBe(true);
      expect(hasSessionsList).toBe(true);

      ws.close();
    });
  });

  describe('Update trigger', () => {
    it('triggers update when web version > agent version', async () => {
      const { triggerUpdate } = await import('../../src/updater.js');

      // Agent version is mocked to 0.5.0, connect with higher version
      const ws = await connectStatusWS('1.0.0');

      // Wait a bit for the update check to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      ws.close();

      // Wait for the delayed update trigger (2 seconds in the code)
      await new Promise((resolve) => setTimeout(resolve, 2100));

      expect(triggerUpdate).toHaveBeenCalledWith('1.0.0');
    });

    it('does not trigger update when versions are equal', async () => {
      const { triggerUpdate } = await import('../../src/updater.js');

      // Agent version is mocked to 0.5.0
      const ws = await connectStatusWS('0.5.0');

      await new Promise((resolve) => setTimeout(resolve, 100));

      ws.close();

      expect(triggerUpdate).not.toHaveBeenCalled();
    });

    it('does not trigger update when agent version > web version (no downgrade)', async () => {
      const { triggerUpdate } = await import('../../src/updater.js');

      // Agent version is mocked to 0.5.0, connect with lower version
      const ws = await connectStatusWS('0.1.0');

      await new Promise((resolve) => setTimeout(resolve, 100));

      ws.close();

      expect(triggerUpdate).not.toHaveBeenCalled();
    });

    it('does not trigger update when no version parameter', async () => {
      const { triggerUpdate } = await import('../../src/updater.js');

      const ws = await connectStatusWS();

      await new Promise((resolve) => setTimeout(resolve, 100));

      ws.close();

      expect(triggerUpdate).not.toHaveBeenCalled();
    });

    it('skips update if update already in progress', async () => {
      const updater = await import('../../src/updater.js');
      vi.mocked(updater.isUpdateInProgress).mockReturnValue(true);

      const ws = await connectStatusWS('2.0.0');

      await new Promise((resolve) => setTimeout(resolve, 100));

      ws.close();

      expect(updater.triggerUpdate).not.toHaveBeenCalled();

      // Reset mock
      vi.mocked(updater.isUpdateInProgress).mockReturnValue(false);
    });
  });

  describe('Multiple connections', () => {
    it('sends version-info to each connection', async () => {
      const ws1 = await connectStatusWS('1.0.0');
      const messages1 = await collectMessages(ws1, 2);

      const ws2 = await connectStatusWS('1.0.0');
      const messages2 = await collectMessages(ws2, 2);

      const hasVersionInfo1 = messages1.some((m) => m.type === 'version-info');
      const hasVersionInfo2 = messages2.some((m) => m.type === 'version-info');

      expect(hasVersionInfo1).toBe(true);
      expect(hasVersionInfo2).toBe(true);

      ws1.close();
      ws2.close();
    });
  });
});
