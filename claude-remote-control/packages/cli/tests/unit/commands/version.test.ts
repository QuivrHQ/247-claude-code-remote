/**
 * Version Command Tests
 *
 * Tests for the version command that shows current version and checks for updates.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const TEST_VERSION = '1.2.3';

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    green: (s: string) => `[green]${s}[/green]`,
    yellow: (s: string) => `[yellow]${s}[/yellow]`,
    dim: (s: string) => `[dim]${s}[/dim]`,
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock util
vi.mock('util', () => ({
  promisify: vi.fn(() => vi.fn()),
}));

describe('Version Command', () => {
  let consoleLogs: string[];
  let originalConsoleLog: typeof console.log;
  let mockExecAsync: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    // Mock package.json import
    vi.doMock('../../../package.json', () => ({
      default: { version: TEST_VERSION },
    }));

    // Capture console.log output
    consoleLogs = [];
    originalConsoleLog = console.log;
    console.log = vi.fn((...args) => {
      consoleLogs.push(args.join(' '));
    });

    // Setup mock for promisify(exec)
    mockExecAsync = vi.fn();
    const { promisify } = await import('util');
    vi.mocked(promisify).mockReturnValue(mockExecAsync);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('shows current version with (latest) when up to date', async () => {
    mockExecAsync.mockResolvedValue({ stdout: `${TEST_VERSION}\n` });

    const { versionCommand } = await import('../../../src/commands/version.js');
    await versionCommand.parseAsync(['node', 'version']);

    expect(consoleLogs.some((log) => log.includes(`247 v${TEST_VERSION}`))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('[green](latest)[/green]'))).toBe(true);
  });

  it('shows update available when newer version exists', async () => {
    mockExecAsync.mockResolvedValue({ stdout: '9.9.9\n' });

    const { versionCommand } = await import('../../../src/commands/version.js');
    await versionCommand.parseAsync(['node', 'version']);

    expect(consoleLogs.some((log) => log.includes(`247 v${TEST_VERSION}`))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('[yellow]Update available'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('9.9.9'))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('npm install -g 247-cli'))).toBe(true);
  });

  it('shows version with warning when npm check fails', async () => {
    mockExecAsync.mockRejectedValue(new Error('Network error'));

    const { versionCommand } = await import('../../../src/commands/version.js');
    await versionCommand.parseAsync(['node', 'version']);

    expect(consoleLogs.some((log) => log.includes(`247 v${TEST_VERSION}`))).toBe(true);
    expect(consoleLogs.some((log) => log.includes('Could not check for updates'))).toBe(true);
  });
});
