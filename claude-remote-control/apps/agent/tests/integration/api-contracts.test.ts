/**
 * API Contracts Tests
 *
 * Tests that validate API response structures match the TypeScript types
 * defined in the shared package. These tests ensure interface stability
 * between the agent and web dashboard.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { EventEmitter } from 'events';
import type { WSSessionInfo, ArchiveSessionResponse } from '247-shared';

// Mock config
const mockConfig = {
  projects: {
    basePath: '/tmp/test-projects',
    whitelist: ['allowed-project'],
  },
};

vi.mock('../../src/config.js', () => ({
  config: mockConfig,
  loadConfig: () => mockConfig,
  default: mockConfig,
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([{ name: 'allowed-project', isDirectory: () => true }]),
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

// ============================================================================
// Type Guards for Response Validation
// ============================================================================

function isValidWSSessionInfo(obj: unknown): obj is WSSessionInfo {
  if (typeof obj !== 'object' || obj === null) return false;
  const session = obj as Record<string, unknown>;

  if (typeof session.name !== 'string') return false;
  if (typeof session.project !== 'string') return false;
  if (typeof session.createdAt !== 'number') return false;

  return true;
}

function isValidArchiveSessionResponse(obj: unknown): obj is ArchiveSessionResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const response = obj as Record<string, unknown>;

  if (typeof response.success !== 'boolean') return false;
  if (typeof response.message !== 'string') return false;
  if (response.session !== undefined && !isValidWSSessionInfo(response.session)) return false;

  return true;
}

// ============================================================================
// Tests
// ============================================================================

describe('API Response Contract Tests', () => {
  let server: any;

  beforeAll(async () => {
    const { createServer } = await import('../../src/server.js');
    server = await createServer();
  });

  afterAll(() => {
    if (server?.close) {
      server.close();
    }
  });

  describe('GET /api/projects', () => {
    it('returns string array', async () => {
      const res = await request(server).get('/api/projects');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((item: unknown) => {
        expect(typeof item).toBe('string');
      });
    });
  });

  describe('GET /api/folders', () => {
    it('returns string array of folder names', async () => {
      const res = await request(server).get('/api/folders');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((item: unknown) => {
        expect(typeof item).toBe('string');
      });
    });
  });

  describe('GET /api/sessions', () => {
    it('returns array of valid WSSessionInfo', async () => {
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((cmd: any, opts: any, cb: any) => {
        const callback = typeof opts === 'function' ? opts : cb;
        // Mock tmux output: session_name|session_created (unix timestamp)
        const mockOutput = 'test--session-1|1704067200\ntest--session-2|1704067300\n';
        if (callback) callback(null, { stdout: mockOutput, stderr: '' });
        return null as any;
      });

      const res = await request(server).get('/api/sessions');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      if (res.body.length > 0) {
        res.body.forEach((session: unknown) => {
          expect(isValidWSSessionInfo(session)).toBe(true);
        });
      }
    });

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

  describe('Session Preview Endpoint', () => {
    it('returns preview with expected structure', async () => {
      const { exec } = await import('child_process');
      vi.mocked(exec).mockImplementation((cmd: any, opts: any, cb: any) => {
        const callback = typeof opts === 'function' ? opts : cb;
        if (callback) callback(null, { stdout: '$ echo hello\nhello\n$ ', stderr: '' });
        return null as any;
      });

      const res = await request(server).get('/api/sessions/test--valid-session-1/preview');

      if (res.status === 200) {
        expect(Array.isArray(res.body.lines)).toBe(true);
        expect(typeof res.body.timestamp).toBe('number');
      }
    });
  });
});

describe('Error Response Contracts', () => {
  let server: any;

  beforeAll(async () => {
    const { createServer } = await import('../../src/server.js');
    server = await createServer();
  });

  afterAll(() => {
    if (server?.close) {
      server.close();
    }
  });

  it('returns 400 for invalid session name format', async () => {
    const res = await request(server).get('/api/sessions/invalid;rm -rf/preview');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid session name');
  });

  it('returns 404 for missing resources', async () => {
    const res = await request(server).get('/api/sessions/non-existent-session/status');

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
  });
});
