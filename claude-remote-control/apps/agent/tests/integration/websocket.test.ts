import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { AddressInfo } from 'net';

// Mock config
vi.mock('../../config.json', () => ({
  default: {
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
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  default: {
    existsSync: vi.fn().mockReturnValue(true),
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

// Create shared mock terminal
let mockTerminal: any;
const createMockTerminal = () => {
  const terminal = {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    detach: vi.fn(),
    captureHistory: vi.fn().mockResolvedValue('$ echo hello\nhello\n$ '),
    isExistingSession: vi.fn().mockReturnValue(false),
    _dataCallbacks: [] as ((data: string) => void)[],
    _exitCallbacks: [] as ((info: { exitCode: number }) => void)[],
    onData: vi.fn((cb) => terminal._dataCallbacks.push(cb)),
    onExit: vi.fn((cb) => terminal._exitCallbacks.push(cb)),
    emitData: (data: string) => terminal._dataCallbacks.forEach((cb) => cb(data)),
    emitExit: (info: { exitCode: number }) => terminal._exitCallbacks.forEach((cb) => cb(info)),
  };
  return terminal;
};

vi.mock('../../src/terminal.js', () => ({
  createTerminal: vi.fn(() => {
    mockTerminal = createMockTerminal();
    return mockTerminal;
  }),
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

describe('WebSocket Terminal', () => {
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
    mockTerminal = null;
  });

  const connectWS = (project: string, session?: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const url = `ws://localhost:${port}/terminal?project=${project}${session ? `&session=${session}` : ''}`;
      const ws = new WebSocket(url);

      ws.on('open', () => resolve(ws));
      ws.on('error', reject);

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  };

  describe('Connection', () => {
    it('connects successfully with allowed project', async () => {
      const ws = await connectWS('allowed-project');
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it('rejects connection for non-whitelisted project', async () => {
      const closeCode = await new Promise<number>((resolve, reject) => {
        const ws = new WebSocket(
          `ws://localhost:${port}/terminal?project=not-allowed`
        );
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        ws.on('close', (code) => {
          clearTimeout(timeout);
          resolve(code);
        });
        ws.on('error', () => {
          // Ignore errors, wait for close
        });
      });

      expect(closeCode).toBe(1008); // Policy Violation
    });

    it('rejects connection without project', async () => {
      const closeCode = await new Promise<number>((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${port}/terminal`);
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        ws.on('close', (code) => {
          clearTimeout(timeout);
          resolve(code);
        });
        ws.on('error', () => {
          // Ignore errors, wait for close
        });
      });

      expect(closeCode).toBe(1008); // Policy Violation
    });

    it('accepts custom session name', async () => {
      const ws = await connectWS('allowed-project', 'custom-session-42');
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });

  describe('Message handling', () => {
    it('responds to ping with pong', async () => {
      const ws = await connectWS('allowed-project');

      const response = await new Promise<any>((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'pong') {
            resolve(msg);
          }
        });
        ws.send(JSON.stringify({ type: 'ping' }));
      });

      expect(response.type).toBe('pong');
      ws.close();
    });

    it('forwards input to terminal', async () => {
      const ws = await connectWS('allowed-project');

      // Wait for terminal to be created
      await new Promise((r) => setTimeout(r, 100));

      ws.send(JSON.stringify({ type: 'input', data: 'ls -la\n' }));

      // Wait for message processing
      await new Promise((r) => setTimeout(r, 100));

      expect(mockTerminal.write).toHaveBeenCalledWith('ls -la\n');
      ws.close();
    });

    it('forwards resize to terminal', async () => {
      const ws = await connectWS('allowed-project');

      // Wait for terminal to be created
      await new Promise((r) => setTimeout(r, 100));

      ws.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }));

      // Wait for message processing
      await new Promise((r) => setTimeout(r, 100));

      expect(mockTerminal.resize).toHaveBeenCalledWith(120, 40);
      ws.close();
    });

    it('handles start-claude message', async () => {
      const ws = await connectWS('allowed-project');

      // Wait for terminal to be created
      await new Promise((r) => setTimeout(r, 100));

      ws.send(JSON.stringify({ type: 'start-claude' }));

      // Wait for message processing
      await new Promise((r) => setTimeout(r, 100));

      // Should write claude command to terminal
      expect(mockTerminal.write).toHaveBeenCalled();
      ws.close();
    });

    it('handles request-history message', async () => {
      const ws = await connectWS('allowed-project');

      // Wait for terminal to be created
      await new Promise((r) => setTimeout(r, 100));

      const historyResponse = await new Promise<any>((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'history') {
            resolve(msg);
          }
        });
        ws.send(JSON.stringify({ type: 'request-history', lines: 100 }));
      });

      expect(historyResponse.type).toBe('history');
      expect(historyResponse.data).toBeDefined();
      ws.close();
    });

    it('ignores invalid JSON messages', async () => {
      const ws = await connectWS('allowed-project');

      // This should not crash the server
      ws.send('not json');
      ws.send('{invalid}');

      // Wait for error handling
      await new Promise((r) => setTimeout(r, 100));

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it('ignores unknown message types', async () => {
      const ws = await connectWS('allowed-project');

      ws.send(JSON.stringify({ type: 'unknown-type' }));

      // Wait for message processing
      await new Promise((r) => setTimeout(r, 100));

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });

  describe('Terminal output', () => {
    it('forwards terminal output to client', async () => {
      const ws = await connectWS('allowed-project');

      // Wait for terminal to be created
      await new Promise((r) => setTimeout(r, 100));

      const output = await new Promise<Buffer>((resolve) => {
        ws.on('message', (data) => {
          // Skip JSON messages (like history)
          if (data instanceof Buffer && !data.toString().startsWith('{')) {
            resolve(data);
          }
        });

        // Simulate terminal output
        mockTerminal.emitData('Hello, World!');
      });

      expect(output.toString()).toBe('Hello, World!');
      ws.close();
    });
  });

  describe('Connection cleanup', () => {
    it('detaches terminal on close', async () => {
      const ws = await connectWS('allowed-project');

      // Wait for terminal to be created
      await new Promise((r) => setTimeout(r, 100));

      ws.close();

      // Wait for close handling
      await new Promise((r) => setTimeout(r, 100));

      expect(mockTerminal.detach).toHaveBeenCalled();
    });
  });
});
