/**
 * Status Command Tests
 *
 * Tests for the status command that shows agent status.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    bold: (s: string) => s,
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// Mock config
vi.mock('../../../src/lib/config.js', () => ({
  loadConfig: vi.fn(),
  configExists: vi.fn(),
}));

// Mock paths
vi.mock('../../../src/lib/paths.js', () => ({
  getAgentPaths: vi.fn(),
}));

// Mock process
vi.mock('../../../src/lib/process.js', () => ({
  isAgentRunning: vi.fn(),
  getAgentHealth: vi.fn(),
}));

describe('Status Command', () => {
  let consoleLogs: string[];
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Capture console.log output
    consoleLogs = [];
    originalConsoleLog = console.log;
    console.log = vi.fn((...args) => {
      consoleLogs.push(args.join(' '));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('shows not configured message when config does not exist', async () => {
    const { configExists } = await import('../../../src/lib/config.js');
    vi.mocked(configExists).mockReturnValue(false);

    const { statusCommand } = await import('../../../src/commands/status.js');
    await statusCommand.parseAsync(['node', 'status']);

    expect(consoleLogs.some((log) => log.includes('Not configured'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('247 init'))).toBe(true);
  });

  it('shows error when config fails to load', async () => {
    const { configExists, loadConfig } = await import('../../../src/lib/config.js');
    vi.mocked(configExists).mockReturnValue(true);
    vi.mocked(loadConfig).mockReturnValue(null);

    const { statusCommand } = await import('../../../src/commands/status.js');
    await statusCommand.parseAsync(['node', 'status']);

    expect(consoleLogs.some((log) => log.includes('Failed to load configuration'))).toBe(true);
  });

  it('shows process status as running with PID', async () => {
    const { configExists, loadConfig } = await import('../../../src/lib/config.js');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { isAgentRunning, getAgentHealth } = await import('../../../src/lib/process.js');

    vi.mocked(configExists).mockReturnValue(true);
    vi.mocked(loadConfig).mockReturnValue({
      agent: { port: 4678 },
      projects: { basePath: '/test/projects', whitelist: [] },
    });
    vi.mocked(getAgentPaths).mockReturnValue({
      configPath: '/test/.247/config.json',
    } as any);
    vi.mocked(isAgentRunning).mockReturnValue({ running: true, pid: 12345 });
    vi.mocked(getAgentHealth).mockResolvedValue({ healthy: true, sessions: 3 });

    const { statusCommand } = await import('../../../src/commands/status.js');
    await statusCommand.parseAsync(['node', 'status']);

    expect(consoleLogs.some((log) => log.includes('Running'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('12345'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('Sessions: 3'))).toBe(true);
  });

  it('shows process status as stopped', async () => {
    const { configExists, loadConfig } = await import('../../../src/lib/config.js');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { isAgentRunning } = await import('../../../src/lib/process.js');

    vi.mocked(configExists).mockReturnValue(true);
    vi.mocked(loadConfig).mockReturnValue({
      agent: { port: 4678 },
      projects: { basePath: '/test/projects', whitelist: [] },
    });
    vi.mocked(getAgentPaths).mockReturnValue({
      configPath: '/test/.247/config.json',
    } as any);
    vi.mocked(isAgentRunning).mockReturnValue({ running: false });

    const { statusCommand } = await import('../../../src/commands/status.js');
    await statusCommand.parseAsync(['node', 'status']);

    expect(consoleLogs.some((log) => log.includes('Stopped'))).toBe(true);
  });

  it('shows warning when agent is not responding', async () => {
    const { configExists, loadConfig } = await import('../../../src/lib/config.js');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { isAgentRunning, getAgentHealth } = await import('../../../src/lib/process.js');

    vi.mocked(configExists).mockReturnValue(true);
    vi.mocked(loadConfig).mockReturnValue({
      agent: { port: 4678 },
      projects: { basePath: '/test/projects', whitelist: [] },
    });
    vi.mocked(getAgentPaths).mockReturnValue({
      configPath: '/test/.247/config.json',
    } as any);
    vi.mocked(isAgentRunning).mockReturnValue({ running: true, pid: 12345 });
    vi.mocked(getAgentHealth).mockResolvedValue({
      healthy: false,
      error: 'Connection refused',
    });

    const { statusCommand } = await import('../../../src/commands/status.js');
    await statusCommand.parseAsync(['node', 'status']);

    expect(consoleLogs.some((log) => log.includes('Warning'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('not responding'))).toBe(true);
  });

  it('shows configuration info', async () => {
    const { configExists, loadConfig } = await import('../../../src/lib/config.js');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { isAgentRunning } = await import('../../../src/lib/process.js');

    vi.mocked(configExists).mockReturnValue(true);
    vi.mocked(loadConfig).mockReturnValue({
      agent: { port: 4678 },
      projects: { basePath: '/test/projects', whitelist: [] },
    });
    vi.mocked(getAgentPaths).mockReturnValue({
      configPath: '/home/user/.247/config.json',
    } as any);
    vi.mocked(isAgentRunning).mockReturnValue({ running: false });

    const { statusCommand } = await import('../../../src/commands/status.js');
    await statusCommand.parseAsync(['node', 'status']);

    expect(consoleLogs.some((log) => log.includes('Port: 4678'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('/test/projects'))).toBe(true);
  });
});
