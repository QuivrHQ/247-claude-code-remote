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
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    if (callback) callback(null, { stdout: '', stderr: '' });
  }),
  execSync: vi.fn(() => ''),
  // tmux is spawned via argv (no shell); tests configure results per case
  execFile: vi.fn((_file, _args, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    if (callback) callback(null, '', '');
  }),
  execFileSync: vi.fn(() => Buffer.from('')),
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

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

/**
 * Make the mocked execFile resolve for every tmux call.
 * `failFor` lists tmux subcommands (e.g. 'has-session') that should exit non-zero instead.
 */
async function mockTmux(stdout = '', failFor: string[] = []) {
  const { execFile } = await import('child_process');
  vi.mocked(execFile).mockImplementation(((
    _file: string,
    args: string[],
    opts: unknown,
    cb: unknown
  ) => {
    const callback = (typeof opts === 'function' ? opts : cb) as ExecFileCallback;
    if (failFor.includes(args[0])) callback(new Error(`tmux ${args[0]} failed`), '', '');
    else callback(null, stdout, '');
  }) as never);
  return execFile;
}

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
      await mockTmux('line1\nline2\n');

      const res = await request(server).get('/api/sessions/project--valid-session-42/preview');

      // Should not be a 400 error
      expect(res.status).not.toBe(400);
    });

    it('captures the pane via execFile with the session name as one argument', async () => {
      const execFile = await mockTmux('line1\nline2\n');
      const { exec } = await import('child_process');

      const res = await request(server).get('/api/sessions/project--abc/preview');

      expect(res.status).toBe(200);
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['capture-pane', '-t', 'project--abc', '-p', '-S', '-20'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/sessions/:sessionName/output', () => {
    it('captures the pane and checks the session via execFile (no shell)', async () => {
      const execFile = await mockTmux('hello\n');
      const { exec } = await import('child_process');

      const res = await request(server).get('/api/sessions/project--abc/output?lines=50');

      expect(res.status).toBe(200);
      expect(res.body.isRunning).toBe(true);
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['capture-pane', '-t', 'project--abc', '-p', '-S', '-50', '-J'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['has-session', '-t', 'project--abc'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(exec).not.toHaveBeenCalled();
    });

    it('rejects shell metacharacters in the session name', async () => {
      const res = await request(server).get(
        '/api/sessions/' + encodeURIComponent('a";id;"') + '/output'
      );

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/sessions/:sessionName/input', () => {
    it('sends text to tmux as one argv element after -- without a shell', async () => {
      const execFile = await mockTmux();
      const { exec } = await import('child_process');
      // Would be command execution if this text ever reached a shell
      const text = 'echo "$(touch /tmp/pwned)" `id` \\n; rm -rf ~';

      const res = await request(server).post('/api/sessions/project--abc/input').send({ text });

      expect(res.status).toBe(200);
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['has-session', '-t', 'project--abc'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['send-keys', '-t', 'project--abc', '--', text, 'Enter'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(exec).not.toHaveBeenCalled();
    });

    it('does not press Enter when sendEnter is false', async () => {
      const execFile = await mockTmux();

      const res = await request(server)
        .post('/api/sessions/project--abc/input')
        .send({ text: 'ls', sendEnter: false });

      expect(res.status).toBe(200);
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['send-keys', '-t', 'project--abc', '--', 'ls'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('escapes a trailing semicolon so tmux does not treat it as a command separator', async () => {
      const execFile = await mockTmux();

      await request(server).post('/api/sessions/project--abc/input').send({ text: 'ls;' });

      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['send-keys', '-t', 'project--abc', '--', 'ls\\;', 'Enter'],
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('returns 404 when the session does not exist', async () => {
      await mockTmux('', ['has-session']);

      const res = await request(server)
        .post('/api/sessions/project--gone/input')
        .send({ text: 'ls' });

      expect(res.status).toBe(404);
    });

    it('rejects shell metacharacters in the session name', async () => {
      const res = await request(server)
        .post('/api/sessions/' + encodeURIComponent('a";id;"') + '/input')
        .send({ text: 'ls' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/sessions/:sessionName', () => {
    it('validates session name format', async () => {
      const res = await request(server).delete('/api/sessions/invalid;rm -rf/');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid session name');
    });

    it('kills the session via execFile with the name as one argument', async () => {
      const execFile = await mockTmux();
      const { exec } = await import('child_process');

      const res = await request(server).delete('/api/sessions/project--abc');

      expect(res.status).toBe(200);
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['kill-session', '-t', 'project--abc'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/sessions/:sessionName/archive', () => {
    it('kills the tmux session via execFile with the name as one argument', async () => {
      const execFile = await mockTmux();
      const { exec } = await import('child_process');
      const sessionsDb = await import('../../src/db/sessions.js');
      sessionsDb.upsertSession('project--archive-me', { project: 'project' });

      const res = await request(server).post('/api/sessions/project--archive-me/archive');

      expect(res.status).toBe(200);
      expect(execFile).toHaveBeenCalledWith(
        'tmux',
        ['kill-session', '-t', 'project--archive-me'],
        expect.any(Object),
        expect.any(Function)
      );
      expect(exec).not.toHaveBeenCalled();
    });
  });
});
