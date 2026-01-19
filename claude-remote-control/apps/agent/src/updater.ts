/**
 * Auto-update module for the 247 agent.
 * Handles version detection and automatic updates when the web dashboard
 * reports a newer version.
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { platform } from 'os';
import { logger } from './logger.js';
import { broadcastUpdatePending } from './websocket-handlers.js';

const UPDATE_SCRIPT = '/tmp/247-update.sh';
const PACKAGE_NAME = '247-cli';

let updateInProgress = false;

/**
 * Check if an update is currently in progress.
 */
export function isUpdateInProgress(): boolean {
  return updateInProgress;
}

/**
 * Trigger an auto-update to the specified version.
 * Creates a detached shell script that:
 * 1. Waits for the agent to exit
 * 2. Runs npm install -g
 * 3. Restarts the agent via service manager
 */
export function triggerUpdate(targetVersion: string): void {
  if (updateInProgress) {
    logger.main.warn('Update already in progress, ignoring');
    return;
  }

  updateInProgress = true;
  logger.main.info({ targetVersion }, 'Auto-update triggered');

  // Broadcast to all connected clients
  broadcastUpdatePending(targetVersion, `Agent updating to version ${targetVersion}...`);

  // Determine restart command based on platform
  const os = platform();
  let restartCommand: string;

  if (os === 'darwin') {
    // macOS: try launchctl kickstart first, fallback to manual start
    restartCommand = 'launchctl kickstart -k gui/$(id -u)/com.quivr.247 2>/dev/null || 247 start';
  } else if (os === 'linux') {
    // Linux: try systemctl first, fallback to manual start
    restartCommand = 'systemctl --user restart 247-agent 2>/dev/null || 247 start';
  } else {
    logger.main.error({ os }, 'Unsupported platform for auto-update');
    updateInProgress = false;
    return;
  }

  // Create update script
  const script = `#!/bin/bash
# 247 Auto-Update Script
# Target version: ${targetVersion}

# Change to /tmp to avoid blocking the agent directory during npm install
cd /tmp

# Wait for agent to fully exit
sleep 2

# Load nvm if available (required for Linux VMs using nvm)
export NVM_DIR="${'$'}{NVM_DIR:-${'$'}HOME/.nvm}"
if [ -s "${'$'}NVM_DIR/nvm.sh" ]; then
  source "${'$'}NVM_DIR/nvm.sh"
  echo "[247] Loaded nvm from ${'$'}NVM_DIR"
fi

echo "[247] Installing version ${targetVersion}..."
npm install -g ${PACKAGE_NAME}@${targetVersion}

if [ $? -ne 0 ]; then
  echo "[247] npm install failed, attempting restart anyway..."
fi

# Fix executable permissions (npm doesn't always preserve them)
CLI_BIN="$(npm root -g)/${PACKAGE_NAME}/dist/index.js"
if [ -f "$CLI_BIN" ]; then
  chmod +x "$CLI_BIN"
  echo "[247] Fixed executable permissions"
fi

echo "[247] Restarting agent..."
${restartCommand}

echo "[247] Auto-update complete"
rm -f "${UPDATE_SCRIPT}"
`;

  try {
    writeFileSync(UPDATE_SCRIPT, script, { mode: 0o755 });
    logger.main.info({ path: UPDATE_SCRIPT }, 'Update script created');
  } catch (err) {
    logger.main.error({ err }, 'Failed to write update script');
    updateInProgress = false;
    return;
  }

  // Build PATH with common locations for npm
  const nvmPath = process.env.NVM_BIN || '';
  const basePath = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin';
  const extraPath = process.env.PATH || '';

  // Spawn detached updater process
  const updater = spawn('bash', [UPDATE_SCRIPT], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      // Ensure npm and 247 are in PATH (nvm paths + homebrew + standard)
      PATH: `${nvmPath}:${basePath}:${extraPath}`,
      NVM_DIR: process.env.NVM_DIR || `${process.env.HOME}/.nvm`,
    },
  });

  updater.unref();
  logger.main.info({ pid: updater.pid }, 'Update script spawned');

  // Exit after short delay to give script time to start
  setTimeout(() => {
    logger.main.info('Agent exiting for update...');
    process.exit(0);
  }, 1000);
}
