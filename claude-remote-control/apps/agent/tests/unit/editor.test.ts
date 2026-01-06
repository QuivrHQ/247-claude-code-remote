import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Create mock child process
const createMockProcess = () => {
  const process = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter | null;
    stderr: EventEmitter | null;
    kill: ReturnType<typeof vi.fn>;
    pid: number;
  };
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  process.kill = vi.fn();
  process.pid = 12345;
  return process;
};

let mockProcess: ReturnType<typeof createMockProcess>;

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockProcess),
  execSync: vi.fn(() => ''),
}));

// Mock net.createConnection to avoid real socket operations with fake timers
vi.mock('net', () => ({
  createConnection: vi.fn(() => {
    const socket = new EventEmitter() as EventEmitter & {
      setTimeout: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    socket.setTimeout = vi.fn();
    socket.destroy = vi.fn();
    // Simulate port is not in use (error event)
    setTimeout(() => socket.emit('error', new Error('ECONNREFUSED')), 0);
    return socket;
  }),
}));

describe('Editor', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockProcess = createMockProcess();

    // Reset modules to get fresh state
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initEditor', () => {
    it('initializes with provided config', async () => {
      const { initEditor, getEditorStatus } = await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 5000, end: 5010 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const status = getEditorStatus('any-project');
      expect(status.running).toBe(false);
    });

    it('uses default config when not provided', async () => {
      const { initEditor, getEditorStatus } = await import('../../src/editor.js');

      initEditor(undefined, '/tmp/projects');

      const status = getEditorStatus('test');
      expect(status.running).toBe(false);
    });
  });

  describe('getOrStartEditor', () => {
    it('starts code-server for new project', async () => {
      const { spawn } = await import('child_process');
      const { initEditor, getOrStartEditor } = await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4699 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const instancePromise = getOrStartEditor('test-project');

      // Advance timers for the 2-second startup delay
      await vi.advanceTimersByTimeAsync(2000);

      const instance = await instancePromise;

      expect(spawn).toHaveBeenCalledWith(
        'code-server',
        expect.arrayContaining([
          '--bind-addr',
          expect.stringMatching(/127\.0\.0\.1:\d+/),
          '--auth',
          'none',
        ]),
        expect.any(Object)
      );

      expect(instance.project).toBe('test-project');
      expect(instance.port).toBeGreaterThanOrEqual(4680);
      expect(instance.port).toBeLessThanOrEqual(4699);
    });

    it('returns existing instance for same project', async () => {
      const { initEditor, getOrStartEditor } = await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4699 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const promise1 = getOrStartEditor('same-project');
      await vi.advanceTimersByTimeAsync(2000);
      const instance1 = await promise1;

      const instance2 = await getOrStartEditor('same-project');

      expect(instance1.port).toBe(instance2.port);
    });

    it('allocates different ports for different projects', async () => {
      const { initEditor, getOrStartEditor } = await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4699 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const promise1 = getOrStartEditor('project-1');
      await vi.advanceTimersByTimeAsync(2000);
      const instance1 = await promise1;

      // Need new mock process for second spawn
      mockProcess = createMockProcess();

      const promise2 = getOrStartEditor('project-2');
      await vi.advanceTimersByTimeAsync(2000);
      const instance2 = await promise2;

      expect(instance1.port).not.toBe(instance2.port);
    });

    it('throws when no ports available', async () => {
      const { initEditor, getOrStartEditor } = await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4680 }, // Only 1 port
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      // Use first (and only) port
      const promise1 = getOrStartEditor('project-1');
      await vi.advanceTimersByTimeAsync(2000);
      await promise1;

      mockProcess = createMockProcess();

      // Should throw when trying to get second editor
      await expect(getOrStartEditor('project-2')).rejects.toThrow(
        'No available ports'
      );
    });
  });

  describe('stopEditor', () => {
    it('stops running editor', async () => {
      const { initEditor, getOrStartEditor, stopEditor, getEditorStatus } =
        await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4699 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const promise = getOrStartEditor('stop-test');
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      expect(getEditorStatus('stop-test').running).toBe(true);

      const stopped = stopEditor('stop-test');

      expect(stopped).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(getEditorStatus('stop-test').running).toBe(false);
    });

    it('returns false for non-existent editor', async () => {
      const { initEditor, stopEditor } = await import('../../src/editor.js');

      initEditor(undefined, '/tmp/projects');

      const stopped = stopEditor('non-existent');
      expect(stopped).toBe(false);
    });
  });

  describe('getEditorStatus', () => {
    it('returns running status for active editor', async () => {
      const { initEditor, getOrStartEditor, getEditorStatus } =
        await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4699 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const promise = getOrStartEditor('status-test');
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      const status = getEditorStatus('status-test');

      expect(status.running).toBe(true);
      expect(status.project).toBe('status-test');
      expect(status.port).toBeDefined();
      expect(status.pid).toBeDefined();
      expect(status.startedAt).toBeDefined();
      expect(status.lastActivity).toBeDefined();
    });

    it('returns not running status for inactive editor', async () => {
      const { initEditor, getEditorStatus } = await import('../../src/editor.js');

      initEditor(undefined, '/tmp/projects');

      const status = getEditorStatus('inactive-project');

      expect(status.running).toBe(false);
      expect(status.project).toBe('inactive-project');
      expect(status.port).toBeUndefined();
    });
  });

  describe('getAllEditors', () => {
    it('returns all running editors', async () => {
      const { initEditor, getOrStartEditor, getAllEditors } =
        await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4699 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const promise1 = getOrStartEditor('editor-1');
      await vi.advanceTimersByTimeAsync(2000);
      await promise1;

      mockProcess = createMockProcess();

      const promise2 = getOrStartEditor('editor-2');
      await vi.advanceTimersByTimeAsync(2000);
      await promise2;

      const editors = getAllEditors();

      expect(editors).toHaveLength(2);
      expect(editors.map((e) => e.project)).toContain('editor-1');
      expect(editors.map((e) => e.project)).toContain('editor-2');
    });
  });

  describe('updateEditorActivity', () => {
    it('updates lastActivity timestamp', async () => {
      const { initEditor, getOrStartEditor, updateEditorActivity, getEditorStatus } =
        await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4699 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const promise = getOrStartEditor('activity-test');
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      const statusBefore = getEditorStatus('activity-test');
      const lastActivityBefore = statusBefore.lastActivity;

      // Advance time
      await vi.advanceTimersByTimeAsync(5000);

      updateEditorActivity('activity-test');

      const statusAfter = getEditorStatus('activity-test');

      expect(statusAfter.lastActivity).toBeGreaterThan(lastActivityBefore!);
    });
  });

  describe('shutdownAllEditors', () => {
    it('stops all running editors', async () => {
      const { initEditor, getOrStartEditor, shutdownAllEditors, getAllEditors } =
        await import('../../src/editor.js');

      initEditor(
        {
          enabled: true,
          portRange: { start: 4680, end: 4699 },
          idleTimeout: 60000,
        },
        '/tmp/projects'
      );

      const mockProcess1 = mockProcess;
      const promise1 = getOrStartEditor('shutdown-1');
      await vi.advanceTimersByTimeAsync(2000);
      await promise1;

      mockProcess = createMockProcess();
      const mockProcess2 = mockProcess;

      const promise2 = getOrStartEditor('shutdown-2');
      await vi.advanceTimersByTimeAsync(2000);
      await promise2;

      expect(getAllEditors()).toHaveLength(2);

      shutdownAllEditors();

      expect(mockProcess1.kill).toHaveBeenCalled();
      expect(mockProcess2.kill).toHaveBeenCalled();
      expect(getAllEditors()).toHaveLength(0);
    });
  });
});
