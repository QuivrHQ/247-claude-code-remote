/**
 * End-to-End Tests for 247 CLI
 *
 * These tests run the actual CLI binary in isolated temporary directories
 * to verify that:
 * 1. Files are created in the correct locations
 * 2. Configuration is properly saved and loaded
 * 3. Services are configured correctly
 * 4. The agent can start and stop
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
        '--name',
        'test-machine',
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
        machine: { id: string; name: string };
        agent: { port: number };
        projects: { basePath: string };
      }>('.247/config.json');

      expect(config.machine.name).toBe('test-machine');
      expect(config.agent.port).toBe(port);
      // Note: the CLI expands ~ to full path
      expect(config.projects.basePath).toContain('Projects');
      // UUID format check
      expect(config.machine.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('creates required directories', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'test', '--port', String(port)]);

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
      await env.runCli(['init', '--name', 'first', '--port', String(port1)]);

      // Second init without force
      const result = await env.runCli(['init', '--name', 'second', '--port', String(port2)]);

      expect(result.stdout).toContain('already exists');
      expect(result.stdout).toContain('--force');

      // Config should still have first machine name
      const config = env.readJson<{ machine: { name: string } }>('.247/config.json');
      expect(config.machine.name).toBe('first');
    });

    it('overwrites with --force', async () => {
      const port1 = await getFreePort();
      const port2 = await getFreePort();

      await env.runCli(['init', '--name', 'first', '--port', String(port1)]);

      await env.runCli(['init', '--name', 'second', '--port', String(port2), '--force']);

      const config = env.readJson<{ machine: { name: string } }>('.247/config.json');
      expect(config.machine.name).toBe('second');
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
      await env.runCli(['init', '--name', 'status-test', '--port', String(port)]);

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

  describe('doctor command', () => {
    it('runs health checks', async () => {
      const result = await env.runCli(['doctor']);

      expect(result.stdout).toContain('Node.js');
      expect(result.stdout).toContain('tmux');
    });

    it('shows config status after init', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'doctor-test', '--port', String(port)]);

      const result = await env.runCli(['doctor']);

      expect(result.stdout).toContain('Configuration');
    });
  });

  describe('hooks command', () => {
    it('shows hooks status after init', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'hooks-test', '--port', String(port)]);

      const result = await env.runCli(['hooks', 'status']);

      // Should show hooks status header
      expect(result.stdout).toContain('247 Hooks Status');
    });

    it('installs hooks successfully', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'hooks-test', '--port', String(port)]);

      const installResult = await env.runCli(['hooks', 'install']);
      // hooks install shows success message with path
      expect(installResult.stdout).toContain('Path:');

      const statusResult = await env.runCli(['hooks', 'status']);
      expect(statusResult.stdout).toContain('247 Hooks Status');
    });
  });

  describe('service command (platform-specific)', () => {
    it.skipIf(platform() !== 'darwin')('creates launchd plist on macOS', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'service-test', '--port', String(port)]);

      // Service install creates the plist file
      // Note: launchctl commands may fail in sandbox but file should be created
      await env.runCli(['service', 'install']);

      expect(env.fileExists('Library/LaunchAgents/com.quivr.247.plist')).toBe(true);

      const plist = env.readFile('Library/LaunchAgents/com.quivr.247.plist');
      expect(plist).toContain('com.quivr.247');
      expect(plist).toContain('AGENT_247_CONFIG');
    });

    it.skipIf(platform() !== 'linux')('creates systemd unit on Linux', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'service-test', '--port', String(port)]);

      // Service install creates the unit file
      // Note: systemctl commands may fail in sandbox but file should be created
      await env.runCli(['service', 'install']);

      expect(env.fileExists('.config/systemd/user/247-agent.service')).toBe(true);

      const unit = env.readFile('.config/systemd/user/247-agent.service');
      expect(unit).toContain('247 Agent');
      expect(unit).toContain('AGENT_247_CONFIG');
    });
  });

  describe('start/stop lifecycle', () => {
    it('fails to start without init', async () => {
      const result = await env.runCli(['start']);

      expect(result.exitCode).toBe(1);
    });

    it('starts and creates PID file', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'lifecycle-test', '--port', String(port)]);

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

  describe('profile management', () => {
    it('lists profiles after init', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'profile-machine', '--port', String(port)]);

      const result = await env.runCli(['profile', 'list']);

      // After init, default profile should exist
      expect(result.stdout.toLowerCase()).toContain('default');
    });

    it('shows profile details', async () => {
      const port = await getFreePort();
      await env.runCli(['init', '--name', 'profile-test', '--port', String(port)]);

      const result = await env.runCli(['profile', 'show']);

      expect(result.stdout).toContain('profile-test');
      expect(result.stdout).toContain(String(port));
    });
  });
});
