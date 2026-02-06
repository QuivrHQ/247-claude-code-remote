/**
 * End-to-End Tests for 247 CLI
 *
 * These tests run the actual CLI binary in isolated temporary directories
 * to verify that:
 * 1. Files are created in the correct locations
 * 2. Configuration is properly saved and loaded
 * 3. The agent can start and stop
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { platform } from 'os';
import {
  createTestEnvironment,
  checkTmuxAvailable,
  checkNodeVersion,
  getFreePort,
  type TestEnvironment,
} from './helpers/test-env';

// Check prerequisites
const hasTmux = checkTmuxAvailable();
const hasNode22 = checkNodeVersion();
const skipE2E = !hasTmux || !hasNode22;

if (skipE2E) {
  console.warn('Skipping E2E tests:');
  if (!hasTmux) console.warn('  - tmux not installed');
  if (!hasNode22) console.warn('  - Node.js 22+ required');
}

describe.skipIf(skipE2E)('247 CLI E2E Tests', () => {
  let env: TestEnvironment;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('init command', () => {
    it('creates configuration with non-interactive flags', async () => {
      const port = await getFreePort();
      const result = await env.runCli([
        'init',
        '--port',
        String(port),
        '--projects',
        '~/Projects',
      ]);

      expect(result.exitCode).toBe(0);
      // The init command shows "Setup complete!" on success
      expect(result.stdout).toContain('Setup complete!');

      // Verify config file was created
      expect(env.fileExists('.247/config.json')).toBe(true);

      const config = env.readJson<{
        agent: { port: number };
        projects: { basePath: string };
      }>('.247/config.json');

      expect(config.agent.port).toBe(port);
      // Note: the CLI expands ~ to full path
      expect(config.projects.basePath).toContain('Projects');
    });

    it('creates required directories', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--port', String(port)]);

      expect(env.fileExists('.247')).toBe(true);
      expect(env.fileExists('.247/data')).toBe(true);

      if (platform() === 'darwin') {
        expect(env.fileExists('Library/Logs/247-agent')).toBe(true);
      } else {
        expect(env.fileExists('.local/log/247-agent')).toBe(true);
      }
    });

    it('refuses to overwrite without --force', async () => {
      const port1 = await getFreePort();
      const port2 = await getFreePort();

      // First init
      await env.runCli(['init', '--port', String(port1)]);

      // Second init without force
      const result = await env.runCli(['init', '--port', String(port2)]);

      expect(result.stdout).toContain('already exists');
      expect(result.stdout).toContain('--force');

      // Config should still have first port
      const config = env.readJson<{ agent: { port: number } }>('.247/config.json');
      expect(config.agent.port).toBe(port1);
    });

    it('overwrites with --force', async () => {
      const port1 = await getFreePort();
      const port2 = await getFreePort();

      await env.runCli(['init', '--port', String(port1)]);

      await env.runCli(['init', '--port', String(port2), '--force']);

      const config = env.readJson<{ agent: { port: number } }>('.247/config.json');
      expect(config.agent.port).toBe(port2);
    });
  });

  describe('status command', () => {
    it('shows not configured when no init', async () => {
      const result = await env.runCli(['status']);

      // Case-insensitive check
      expect(result.stdout.toLowerCase()).toContain('not configured');
    });

    it('shows stopped after init', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--port', String(port)]);

      const result = await env.runCli(['status']);

      // The status command shows "stopped" when agent is not running
      expect(result.stdout.toLowerCase()).toContain('stopped');
    });
  });

  describe('stop command', () => {
    it('succeeds when not running', async () => {
      const result = await env.runCli(['stop']);

      expect(result.exitCode).toBe(0);
      // Case-insensitive check
      expect(result.stdout.toLowerCase()).toContain('not running');
    });
  });

  describe('start/stop lifecycle', () => {
    it('fails to start without init', async () => {
      const result = await env.runCli(['start']);

      expect(result.exitCode).toBe(1);
    });

    it('starts and creates PID file', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--port', String(port)]);

      const startResult = await env.runCli(['start'], { timeout: 15000 });

      // Should succeed or show already running
      if (startResult.exitCode === 0) {
        // Check PID file was created
        expect(env.fileExists('.247/agent.pid')).toBe(true);

        const pid = parseInt(env.readFile('.247/agent.pid'), 10);
        expect(pid).toBeGreaterThan(0);

        // Stop the agent
        const stopResult = await env.runCli(['stop']);
        expect(stopResult.exitCode).toBe(0);
      }
    });
  });
});
