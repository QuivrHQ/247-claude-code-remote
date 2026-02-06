import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { getAgentPaths, ensureDirectories } from './paths.js';
import { loadConfig } from './config.js';

/**
 * Check if the agent process is running
 */
export function isAgentRunning(): { running: boolean; pid?: number } {
  const paths = getAgentPaths();

  if (!existsSync(paths.pidFile)) {
    return { running: false };
  }

  try {
    const pidStr = readFileSync(paths.pidFile, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);

    if (isNaN(pid)) {
      return { running: false };
    }

    // Check if process is actually running
    try {
      process.kill(pid, 0); // Signal 0 just checks if process exists
      return { running: true, pid };
    } catch {
      // Process doesn't exist, clean up stale PID file
      try {
        unlinkSync(paths.pidFile);
      } catch {
        // Ignore cleanup errors
      }
      return { running: false };
    }
  } catch {
    return { running: false };
  }
}

/**
 * Start the agent as a background daemon
 */
export async function startAgentDaemon(): Promise<{ success: boolean; pid?: number; error?: string }> {
  const paths = getAgentPaths();
  const config = loadConfig();

  if (!config) {
    return { success: false, error: 'Configuration not found. Run: 247 init' };
  }

  // Check if already running
  const status = isAgentRunning();
  if (status.running) {
    return { success: false, error: `Agent is already running (PID: ${status.pid})` };
  }

  ensureDirectories();

  // Determine the entry point
  const entryPoint = paths.isDev
    ? join(paths.agentRoot, 'src', 'index.ts')
    : join(paths.agentRoot, 'dist', 'index.js');

  if (!existsSync(entryPoint) && !existsSync(entryPoint.replace('.ts', '.js'))) {
    return { success: false, error: `Agent entry point not found: ${entryPoint}` };
  }

  // Prepare log files
  const stdoutLog = join(paths.logDir, 'agent.log');
  const stderrLog = join(paths.logDir, 'agent.error.log');

  const stdout = openSync(stdoutLog, 'a');
  const stderr = openSync(stderrLog, 'a');

  // Build command
  let command: string;
  let args: string[];

  if (paths.isDev) {
    // Development: use tsx for TypeScript
    command = 'npx';
    args = ['tsx', entryPoint];
  } else {
    // Production: use node directly
    command = paths.nodePath;
    args = [entryPoint];
  }

  // Spawn detached process
  const child = spawn(command, args, {
    cwd: paths.agentRoot,
    detached: true,
    stdio: ['ignore', stdout, stderr],
    env: {
      ...process.env,
      AGENT_247_DATA: paths.dataDir,
    },
  });

  if (!child.pid) {
    return { success: false, error: 'Failed to start agent process' };
  }

  // Write PID file
  writeFileSync(paths.pidFile, String(child.pid), 'utf-8');

  // Detach from parent
  child.unref();

  // Wait a moment to check if process started successfully
  await new Promise(resolve => setTimeout(resolve, 500));

  const checkStatus = isAgentRunning();
  if (!checkStatus.running) {
    return { success: false, error: 'Agent process exited immediately. Check logs for errors.' };
  }

  return { success: true, pid: child.pid };
}

/**
 * Stop the running agent
 */
export function stopAgent(): { success: boolean; error?: string } {
  const status = isAgentRunning();

  if (!status.running || !status.pid) {
    return { success: true }; // Already stopped
  }

  try {
    // Send SIGTERM for graceful shutdown
    process.kill(status.pid, 'SIGTERM');

    // Wait for process to exit (max 5 seconds)
    const maxWait = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        process.kill(status.pid, 0);
        // Still running, wait more
        const waitTime = 100;
        const end = Date.now() + waitTime;
        while (Date.now() < end) {
          // Busy wait (not ideal but works for short durations)
        }
      } catch {
        // Process exited
        break;
      }
    }

    // If still running after timeout, force kill
    try {
      process.kill(status.pid, 0);
      process.kill(status.pid, 'SIGKILL');
    } catch {
      // Process already exited
    }

    // Clean up PID file
    const paths = getAgentPaths();
    if (existsSync(paths.pidFile)) {
      try {
        unlinkSync(paths.pidFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Restart the agent
 */
export async function restartAgent(): Promise<{ success: boolean; pid?: number; error?: string }> {
  const stopResult = stopAgent();
  if (!stopResult.success) {
    return { success: false, error: `Failed to stop: ${stopResult.error}` };
  }

  // Wait a moment before starting
  await new Promise(resolve => setTimeout(resolve, 500));

  return startAgentDaemon();
}

/**
 * Get agent health status by checking the API
 */
export async function getAgentHealth(port: number): Promise<{
  healthy: boolean;
  sessions?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`http://localhost:${port}/api/sessions`);
    if (!response.ok) {
      return { healthy: false, error: `HTTP ${response.status}` };
    }
    const sessions = await response.json() as unknown[];
    return { healthy: true, sessions: sessions.length };
  } catch (err) {
    return { healthy: false, error: (err as Error).message };
  }
}
