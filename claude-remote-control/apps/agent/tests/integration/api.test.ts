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
  // Default: no symlinks — realpath is the identity, so targets stay in-root.
  realpath: vi.fn(async (p: string) => p),
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

    it('lists subfolders of a nested path', async () => {
      const fsPromises = await import('fs/promises');

      const res = await request(server).get('/api/folders').query({ path: 'allowed-project/src' });

      expect(res.status).toBe(200);
      expect(fsPromises.readdir).toHaveBeenLastCalledWith(
        '/tmp/test-projects/allowed-project/src',
        { withFileTypes: true }
      );
      // Only non-hidden child directories, sorted; files and dotfiles excluded.
      expect(res.body).toEqual(['allowed-project', 'another-project', 'unlisted-project']);
    });

    it.each(['../etc', 'allowed-project/../../etc', '/etc', '.hidden', 'a\\b'])(
      'rejects unsafe path %s',
      async (unsafePath) => {
        const res = await request(server).get('/api/folders').query({ path: unsafePath });

        expect(res.status).toBe(400);
      }
    );

    it('returns 404 when the folder does not exist', async () => {
      const fsPromises = await import('fs/promises');
      // realpath succeeds (default identity) so the readdir ENOENT path is what
      // produces the 404.
      vi.mocked(fsPromises.readdir).mockRejectedValueOnce(
        Object.assign(new Error('missing'), { code: 'ENOENT' })
      );

      const res = await request(server).get('/api/folders').query({ path: 'gone' });

      expect(res.status).toBe(404);
    });

    it('rejects a path whose symlink target escapes the base path', async () => {
      const fsPromises = await import('fs/promises');
      // basePath realpath is the identity; the nested target resolves outside it.
      vi.mocked(fsPromises.realpath).mockImplementation(async (p) =>
        String(p).endsWith('/link') ? '/etc/secret' : String(p)
      );

      const res = await request(server).get('/api/folders').query({ path: 'allowed-project/link' });

      expect(res.status).toBe(400);
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
