import { describe, it, expect, afterEach } from 'vitest';
import { createTerminal } from '../../src/terminal.js';
import { execSync } from 'child_process';

/**
 * E2E test for terminal initialization with init script.
 * These tests actually spawn tmux sessions and verify env vars are set correctly.
 *
 * NOTE: These tests are flaky due to timing dependencies with tmux and shell initialization.
 * They pass locally sometimes but fail in CI or when the shell has slow startup.
 */
describe.skip('Terminal Init E2E', () => {
  const testSessions: string[] = [];

  // Cleanup: kill all test sessions after each test
  afterEach(() => {
    for (const session of testSessions) {
      try {
        execSync(`tmux kill-session -t "${session}" 2>/dev/null`);
      } catch {
        // Session might not exist
      }
    }
    testSessions.length = 0;
  });

  it('creates session with CLAUDE_TMUX_SESSION env var', async () => {
    const sessionName = `e2e-test-${Date.now()}`;
    testSessions.push(sessionName);

    const terminal = createTerminal('/tmp', sessionName);

    // Wait for session to be ready
    await new Promise<void>((resolve) => {
      terminal.onReady(resolve);
    });

    // Give shell a moment to fully initialize
    await new Promise((r) => setTimeout(r, 500));

    // Check env var is set in the tmux session
    const result = execSync(
      `tmux send-keys -t "${sessionName}" 'echo "VAR=$CLAUDE_TMUX_SESSION"' C-m && sleep 1 && tmux capture-pane -t "${sessionName}" -p`,
      { encoding: 'utf-8' }
    );

    expect(result).toContain(`VAR=${sessionName}`);

    terminal.kill();
  });

  it('creates session with custom env vars', async () => {
    const sessionName = `e2e-custom-${Date.now()}`;
    testSessions.push(sessionName);

    const terminal = createTerminal('/tmp', sessionName, {
      MY_CUSTOM_VAR: 'hello-world',
      ANOTHER_VAR: 'test-value-123',
    });

    // Wait for session to be ready
    await new Promise<void>((resolve) => {
      terminal.onReady(resolve);
    });

    // Give shell a moment to fully initialize
    await new Promise((r) => setTimeout(r, 300));

    // Check custom env vars are set
    const result = execSync(
      `tmux send-keys -t "${sessionName}" 'echo "CUSTOM=$MY_CUSTOM_VAR ANOTHER=$ANOTHER_VAR"' C-m && sleep 0.3 && tmux capture-pane -t "${sessionName}" -p`,
      { encoding: 'utf-8' }
    );

    expect(result).toContain('CUSTOM=hello-world');
    expect(result).toContain('ANOTHER=test-value-123');

    terminal.kill();
  });

  it('handles env vars with special characters', async () => {
    const sessionName = `e2e-special-${Date.now()}`;
    testSessions.push(sessionName);

    const terminal = createTerminal('/tmp', sessionName, {
      WITH_SPACES: 'hello world',
      WITH_QUOTES: 'say "hello"',
    });

    // Wait for session to be ready
    await new Promise<void>((resolve) => {
      terminal.onReady(resolve);
    });

    // Give shell a moment to fully initialize
    await new Promise((r) => setTimeout(r, 300));

    // Check env vars with special chars are set correctly
    const result = execSync(
      `tmux send-keys -t "${sessionName}" 'echo "SPACES=$WITH_SPACES"' C-m && sleep 0.3 && tmux capture-pane -t "${sessionName}" -p`,
      { encoding: 'utf-8' }
    );

    expect(result).toContain('SPACES=hello world');

    terminal.kill();
  });

  it('attaches to existing session without re-initializing', async () => {
    const sessionName = `e2e-attach-${Date.now()}`;
    testSessions.push(sessionName);

    // Create first terminal
    const terminal1 = createTerminal('/tmp', sessionName, {
      INIT_VAR: 'first-init',
    });

    await new Promise<void>((resolve) => {
      terminal1.onReady(resolve);
    });
    await new Promise((r) => setTimeout(r, 300));

    // Set a marker in the session
    execSync(`tmux send-keys -t "${sessionName}" 'MARKER=session-alive' C-m`);
    await new Promise((r) => setTimeout(r, 200));

    // Detach first terminal
    terminal1.detach();
    await new Promise((r) => setTimeout(r, 200));

    // Create second terminal (should attach, not create new)
    const terminal2 = createTerminal('/tmp', sessionName, {
      INIT_VAR: 'second-init', // This should NOT override the first
    });

    expect(terminal2.isExistingSession()).toBe(true);

    await new Promise<void>((resolve) => {
      terminal2.onReady(resolve);
    });
    await new Promise((r) => setTimeout(r, 300));

    // Check that the marker from first session still exists
    const result = execSync(
      `tmux send-keys -t "${sessionName}" 'echo "MARKER=$MARKER INIT=$INIT_VAR"' C-m && sleep 0.3 && tmux capture-pane -t "${sessionName}" -p`,
      { encoding: 'utf-8' }
    );

    // Marker should still be there (session persisted)
    expect(result).toContain('MARKER=session-alive');
    // INIT_VAR should be from first init (not overwritten)
    expect(result).toContain('INIT=first-init');

    terminal2.kill();
  });

  it('cleans up init script after session starts', async () => {
    const sessionName = `e2e-cleanup-${Date.now()}`;
    testSessions.push(sessionName);

    const terminal = createTerminal('/tmp', sessionName);

    await new Promise<void>((resolve) => {
      terminal.onReady(resolve);
    });

    // Wait for cleanup (5 seconds in the code)
    await new Promise((r) => setTimeout(r, 5500));

    // Check that init script was deleted
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const scriptPath = path.join(os.tmpdir(), `247-init-${sessionName}.sh`);

    expect(fs.existsSync(scriptPath)).toBe(false);

    terminal.kill();
  });
});
