/**
 * Doctor Command Tests
 *
 * Tests for the doctor command that diagnoses 247 installation issues.
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

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock prerequisites
vi.mock('../../../src/lib/prerequisites.js', () => ({
  checkNode: vi.fn(),
  checkTmux: vi.fn(),
  checkNativeDeps: vi.fn(),
}));

// Mock config
vi.mock('../../../src/lib/config.js', () => ({
  configExists: vi.fn(),
  loadConfig: vi.fn(),
}));

// Mock process
vi.mock('../../../src/lib/process.js', () => ({
  isAgentRunning: vi.fn(),
  getAgentHealth: vi.fn(),
}));

// Mock service manager
vi.mock('../../../src/service/index.js', () => ({
  createServiceManager: vi.fn(),
}));

// Mock paths
vi.mock('../../../src/lib/paths.js', () => ({
  getAgentPaths: vi.fn(),
}));

// Mock hooks
vi.mock('../../../src/lib/hooks.js', () => ({
  getHooksStatus: vi.fn(),
}));

// Mock net module
const createMockServer = (portAvailable: boolean = true) => {
  return {
    once: vi.fn((event: string, callback: () => void) => {
      // Simulate immediate callback
      if (event === 'listening' && portAvailable) {
        setTimeout(() => callback(), 0);
      } else if (event === 'error' && !portAvailable) {
        setTimeout(() => callback(), 0);
      }
    }),
    listen: vi.fn(),
    close: vi.fn(),
  };
};

vi.mock('net', () => ({
  createServer: vi.fn(() => createMockServer(true)),
}));

describe('Doctor Command', () => {
  let consoleLogs: string[];
  let originalConsoleLog: typeof console.log;
  let exitMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Capture console output
    consoleLogs = [];
    originalConsoleLog = console.log;
    console.log = vi.fn((...args) => {
      consoleLogs.push(args.join(' '));
    });

    // Mock process.exit
    exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    exitMock.mockRestore();
  });

  const setupAllMocks = async (overrides: Record<string, any> = {}) => {
    const { checkNode, checkTmux, checkNativeDeps } =
      await import('../../../src/lib/prerequisites.js');
    const { configExists, loadConfig } = await import('../../../src/lib/config.js');
    const { isAgentRunning, getAgentHealth } = await import('../../../src/lib/process.js');
    const { createServiceManager } = await import('../../../src/service/index.js');
    const { getAgentPaths } = await import('../../../src/lib/paths.js');
    const { getHooksStatus } = await import('../../../src/lib/hooks.js');
    const { existsSync } = await import('fs');

    // Default all passing scenario
    vi.mocked(checkNode).mockReturnValue({
      name: 'Node.js',
      status: 'ok',
      message: 'v22.0.0',
      required: true,
    });

    vi.mocked(checkTmux).mockReturnValue({
      name: 'tmux',
      status: 'ok',
      message: 'tmux 3.4',
      required: true,
    });

    vi.mocked(checkNativeDeps).mockResolvedValue({
      name: 'Native modules',
      status: 'ok',
      message: 'All native modules loaded',
      required: true,
    });

    vi.mocked(configExists).mockReturnValue(true);
    vi.mocked(loadConfig).mockReturnValue({
      machine: { id: 'test-id', name: 'Test Machine' },
      agent: { port: 4678 },
      projects: { basePath: '/test/projects', whitelist: [] },
      editor: { enabled: false },
    } as any);

    vi.mocked(isAgentRunning).mockReturnValue({ running: true, pid: 12345 });
    vi.mocked(getAgentHealth).mockResolvedValue({ healthy: true, sessions: 2 });

    vi.mocked(createServiceManager).mockReturnValue({
      platform: 'launchd',
      status: vi.fn().mockResolvedValue({
        installed: true,
        running: true,
        enabled: true,
      }),
      install: vi.fn(),
      uninstall: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    } as any);

    vi.mocked(getAgentPaths).mockReturnValue({
      configDir: '/home/user/.247',
      logDir: '/home/user/Library/Logs/247-agent',
    } as any);

    vi.mocked(getHooksStatus).mockReturnValue({
      installed: true,
      version: '2.25.0',
      path: '/home/user/.247/hooks/notify-247.sh',
      settingsConfigured: true,
      needsUpdate: false,
      packagedVersion: '2.25.0',
    });

    vi.mocked(existsSync).mockReturnValue(true);

    // Apply overrides
    if (overrides.checkNode) vi.mocked(checkNode).mockReturnValue(overrides.checkNode);
    if (overrides.checkTmux) vi.mocked(checkTmux).mockReturnValue(overrides.checkTmux);
    if (overrides.checkNativeDeps)
      vi.mocked(checkNativeDeps).mockResolvedValue(overrides.checkNativeDeps);
    if (overrides.configExists !== undefined)
      vi.mocked(configExists).mockReturnValue(overrides.configExists);
    if (overrides.loadConfig !== undefined)
      vi.mocked(loadConfig).mockReturnValue(overrides.loadConfig);
    if (overrides.isAgentRunning)
      vi.mocked(isAgentRunning).mockReturnValue(overrides.isAgentRunning);
    if (overrides.getAgentHealth)
      vi.mocked(getAgentHealth).mockResolvedValue(overrides.getAgentHealth);
    if (overrides.serviceStatus) {
      vi.mocked(createServiceManager).mockReturnValue({
        platform: 'launchd',
        status: vi.fn().mockResolvedValue(overrides.serviceStatus),
        install: vi.fn(),
        uninstall: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      } as any);
    }
    if (overrides.existsSync !== undefined)
      vi.mocked(existsSync).mockReturnValue(overrides.existsSync);
    if (overrides.hooksStatus) vi.mocked(getHooksStatus).mockReturnValue(overrides.hooksStatus);

    // Setup net mock for port availability check (only runs when agent not running)
    const net = await import('net');
    vi.mocked(net.createServer).mockReturnValue(
      createMockServer(overrides.portAvailable !== false) as any
    );
  };

  it('shows all checks passing', async () => {
    await setupAllMocks();

    const { doctorCommand } = await import('../../../src/commands/doctor.js');
    await doctorCommand.parseAsync(['node', 'doctor']);

    expect(consoleLogs.some((log) => log.includes('Node.js'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('tmux'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('All checks passed'))).toBe(true);
  });

  it('shows Node.js check failure', async () => {
    await setupAllMocks({
      checkNode: {
        name: 'Node.js',
        status: 'error',
        message: 'Node.js v18.0.0 found',
        required: true,
      },
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');

    try {
      await doctorCommand.parseAsync(['node', 'doctor']);
    } catch {
      // Expected process.exit
    }

    expect(consoleLogs.some((log) => log.includes('Node.js'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('failures'))).toBe(true);
  });

  it('shows tmux check failure with install hint', async () => {
    await setupAllMocks({
      checkTmux: {
        name: 'tmux',
        status: 'error',
        message: 'Not installed',
        required: true,
      },
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');

    try {
      await doctorCommand.parseAsync(['node', 'doctor']);
    } catch {
      // Expected process.exit
    }

    expect(consoleLogs.some((log) => log.includes('tmux'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('brew') || log.includes('apt'))).toBe(true);
  });

  it('shows configuration not found', async () => {
    await setupAllMocks({
      configExists: false,
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');

    try {
      await doctorCommand.parseAsync(['node', 'doctor']);
    } catch {
      // Expected process.exit
    }

    expect(consoleLogs.some((log) => log.includes('Not configured'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('247 init'))).toBe(true);
  });

  it('shows invalid configuration', async () => {
    await setupAllMocks({
      loadConfig: null,
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');

    try {
      await doctorCommand.parseAsync(['node', 'doctor']);
    } catch {
      // Expected process.exit
    }

    expect(consoleLogs.some((log) => log.includes('invalid'))).toBe(true);
  });

  it('shows agent not running warning', async () => {
    await setupAllMocks({
      isAgentRunning: { running: false },
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');
    await doctorCommand.parseAsync(['node', 'doctor']);

    expect(consoleLogs.some((log) => log.includes('Not running'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('247 start'))).toBe(true);
  });

  it('shows agent health warning when not responding', async () => {
    await setupAllMocks({
      getAgentHealth: {
        healthy: false,
        error: 'Connection refused',
      },
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');
    await doctorCommand.parseAsync(['node', 'doctor']);

    expect(consoleLogs.some((log) => log.includes('Not responding'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('restart'))).toBe(true);
  });

  it('shows service not installed warning', async () => {
    await setupAllMocks({
      serviceStatus: {
        installed: false,
        running: false,
        enabled: false,
      },
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');
    await doctorCommand.parseAsync(['node', 'doctor']);

    expect(consoleLogs.some((log) => log.includes('Service'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('247 service install'))).toBe(true);
  });

  it('shows service installed but not running', async () => {
    await setupAllMocks({
      serviceStatus: {
        installed: true,
        running: false,
        enabled: false,
      },
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');
    await doctorCommand.parseAsync(['node', 'doctor']);

    expect(consoleLogs.some((log) => log.includes('not running'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('247 service start'))).toBe(true);
  });

  it('shows missing config directory warning', async () => {
    const { existsSync } = await import('fs');
    await setupAllMocks();
    vi.mocked(existsSync).mockImplementation((path) => {
      return !String(path).includes('configDir') && !String(path).includes('.247');
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');
    await doctorCommand.parseAsync(['node', 'doctor']);

    expect(consoleLogs.some((log) => log.includes('Missing'))).toBe(true);
  });

  it('shows summary with pass, warn, fail counts', async () => {
    await setupAllMocks();

    const { doctorCommand } = await import('../../../src/commands/doctor.js');
    await doctorCommand.parseAsync(['node', 'doctor']);

    expect(consoleLogs.some((log) => log.includes('Summary'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('passed'))).toBe(true);
  });

  it('exits with code 1 when there are failures', async () => {
    await setupAllMocks({
      checkNode: {
        name: 'Node.js',
        status: 'error',
        message: 'Node.js not found',
        required: true,
      },
    });

    const { doctorCommand } = await import('../../../src/commands/doctor.js');

    try {
      await doctorCommand.parseAsync(['node', 'doctor']);
    } catch (e) {
      expect((e as Error).message).toBe('process.exit');
    }

    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('shows warnings message when only warnings exist', async () => {
    await setupAllMocks({
      isAgentRunning: { running: false },
    });

    // Make sure no failures occur
    const { configExists, loadConfig } = await import('../../../src/lib/config.js');
    vi.mocked(configExists).mockReturnValue(true);
    vi.mocked(loadConfig).mockReturnValue({
      machine: { id: 'test-id', name: 'Test' },
      agent: { port: 4678 },
      projects: { basePath: '/test', whitelist: [] },
    } as any);

    const { doctorCommand } = await import('../../../src/commands/doctor.js');
    await doctorCommand.parseAsync(['node', 'doctor']);

    expect(consoleLogs.some((log) => log.includes('warnings'))).toBe(true);
  });
});
