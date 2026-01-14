/**
 * WebSocket handlers for terminal connections and status subscriptions.
 */

import { WebSocket } from 'ws';
import { execSync } from 'child_process';
import { createTerminal } from './terminal.js';
import { config } from './config.js';
import * as sessionsDb from './db/sessions.js';
import { worktreeManager, executionManager } from './services/index.js';

/**
 * Check if a tmux session exists
 */
function tmuxSessionExists(sessionName: string): boolean {
  try {
    execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}
import {
  getEnvironmentVariables,
  getEnvironmentMetadata,
  setSessionEnvironment,
  clearSessionEnvironment,
  getSessionEnvironment,
} from './db/environments.js';
import {
  tmuxSessionStatus,
  activeConnections,
  statusSubscribers,
  generateSessionName,
  broadcastStatusUpdate,
} from './status.js';
import type {
  WSMessageToAgent,
  SessionStatus,
  AttentionReason,
  WSSessionInfo,
  WSStatusMessageFromAgent,
} from '247-shared';
import * as path from 'path';

// Track last Ralph Loop start times to debounce duplicate requests
const ralphLoopLastStart = new Map<string, number>();
const RALPH_DEBOUNCE_MS = 2000;
import { getAgentVersion, needsUpdate } from './version.js';
import { triggerUpdate, isUpdateInProgress } from './updater.js';

/**
 * Handle terminal WebSocket connections
 */
export function handleTerminalConnection(ws: WebSocket, url: URL): void {
  const project = url.searchParams.get('project');
  const urlSessionName = url.searchParams.get('session');
  const environmentId = url.searchParams.get('environment');
  const createFlag = url.searchParams.get('create') === 'true';
  const useWorktree = url.searchParams.get('worktree') === 'true';
  const branchName = url.searchParams.get('branch') || undefined;
  const sessionName = urlSessionName || generateSessionName(project || 'unknown');

  // Validate project
  const whitelist = config.projects.whitelist as string[];
  const hasWhitelist = whitelist && whitelist.length > 0;
  const isAllowed = hasWhitelist ? whitelist.includes(project!) : true;
  if (!project || !isAllowed) {
    ws.close(1008, 'Project not allowed');
    return;
  }

  const projectPath = `${config.projects.basePath}/${project}`.replace('~', process.env.HOME!);

  console.log(`New terminal connection for project: ${project}`);
  console.log(`Project path: ${projectPath}`);

  // Buffer for messages received before async setup completes
  // This prevents race condition where client sends messages before handler is registered
  const messageBuffer: Buffer[] = [];
  let setupComplete = false;
  let terminalRef: ReturnType<typeof createTerminal> | null = null;

  // Register message handler IMMEDIATELY (before any async code)
  // This ensures no messages are lost during async initialization
  ws.on('message', (data) => {
    const msgStr = data.toString();
    console.log(`[Terminal] Received message for '${sessionName}': ${msgStr.substring(0, 100)}...`);
    if (!setupComplete || !terminalRef) {
      // Buffer message for later processing
      console.log(`[Terminal] Buffering message (setup not complete)`);
      messageBuffer.push(data as Buffer);
      return;
    }
    try {
      const msg: WSMessageToAgent = JSON.parse(msgStr);
      handleTerminalMessage(msg, terminalRef, ws, sessionName, project!, projectPath);
    } catch (err) {
      console.error('Failed to parse message:', err);
    }
  });

  // Async initialization
  (async () => {
    const fs = await import('fs');
    if (!fs.existsSync(projectPath)) {
      console.error(`Path does not exist: ${projectPath}`);
      ws.close(1008, 'Project path not found');
      return;
    }

    const envVars = getEnvironmentVariables(environmentId || undefined);

    // Check if session exists before attempting to create/connect
    const sessionExists = tmuxSessionExists(sessionName);

    // If session doesn't exist and no create flag, reject the connection
    if (!sessionExists && !createFlag) {
      console.log(
        `[Terminal] Session '${sessionName}' not found and create flag not set, rejecting connection`
      );
      ws.close(4001, 'Session not found');
      return;
    }

    // For new sessions, check capacity and create worktree if requested
    let terminalCwd = projectPath;
    let worktreePath: string | null = null;
    let worktreeBranch: string | null = null;

    if (!sessionExists && createFlag) {
      // Check execution capacity
      if (!executionManager.canStart()) {
        const capacity = executionManager.getCapacity();
        console.log(
          `[Terminal] Capacity exceeded: ${capacity.running}/${capacity.max} sessions running`
        );
        ws.close(4029, `Max ${capacity.max} parallel sessions`);
        return;
      }

      // Create worktree if requested
      if (useWorktree) {
        try {
          const worktreeInfo = await worktreeManager.create(projectPath, sessionName, branchName);
          terminalCwd = worktreeInfo.worktreePath;
          worktreePath = worktreeInfo.worktreePath;
          worktreeBranch = worktreeInfo.branch;
          console.log(
            `[Terminal] Created worktree for session '${sessionName}' at ${worktreePath} (branch: ${worktreeBranch})`
          );
        } catch (err) {
          console.error(`[Terminal] Failed to create worktree:`, err);
          ws.close(1011, 'Failed to create worktree');
          return;
        }
      }

      // Register with execution manager
      executionManager.register(sessionName, project!, worktreePath);
    }

    // Create terminal
    let terminal;
    try {
      terminal = createTerminal(terminalCwd, sessionName, {
        customEnvVars: envVars,
      });
      terminalRef = terminal; // Store reference for early message handler
      if (environmentId) {
        setSessionEnvironment(sessionName, environmentId);
      }
    } catch (err) {
      console.error('Failed to create terminal:', err);
      clearSessionEnvironment(sessionName);
      // Cleanup worktree on failure
      if (worktreePath) {
        await worktreeManager.remove(projectPath, worktreePath).catch(() => {});
      }
      executionManager.unregister(sessionName);
      ws.close(1011, 'Failed to create terminal');
      return;
    }

    // Track connection
    if (!activeConnections.has(sessionName)) {
      activeConnections.set(sessionName, new Set());
    }
    activeConnections.get(sessionName)!.add(ws);

    // Handle existing session reconnect
    if (terminal.isExistingSession()) {
      console.log(`Reconnecting to existing session '${sessionName}'`);
      terminal
        .captureHistory(10000)
        .then((history) => {
          if (history && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({ type: 'history', data: history, lines: history.split('\n').length })
            );
          }
        })
        .catch((err) => {
          console.error(`Failed to capture history for '${sessionName}':`, err);
        });
    } else {
      // New session - register and broadcast
      const now = Date.now();
      let createdAt = now;

      try {
        const dbSession = sessionsDb.upsertSession(sessionName, {
          project: project!,
          status: 'init',
          attentionReason: undefined,
          lastEvent: 'SessionCreated',
          lastActivity: now,
          lastStatusChange: now,
          environmentId: environmentId || undefined,
          worktreePath: worktreePath || undefined,
          branchName: worktreeBranch || undefined,
        });
        if (dbSession?.created_at) createdAt = dbSession.created_at;
      } catch (err) {
        console.error(`Failed to persist session '${sessionName}':`, err);
      }

      tmuxSessionStatus.set(sessionName, {
        status: 'init',
        lastEvent: 'SessionCreated',
        lastActivity: now,
        lastStatusChange: now,
        project: project!,
      });

      const envMeta = environmentId ? getEnvironmentMetadata(environmentId) : undefined;
      broadcastStatusUpdate({
        name: sessionName,
        project: project!,
        status: 'init',
        statusSource: 'hook',
        lastEvent: 'SessionCreated',
        lastStatusChange: now,
        createdAt,
        lastActivity: undefined,
        environmentId: environmentId || undefined,
        environment: envMeta
          ? {
              id: envMeta.id,
              name: envMeta.name,
              provider: envMeta.provider,
              icon: envMeta.icon,
              isDefault: envMeta.isDefault,
            }
          : undefined,
      });
    }

    // Forward terminal output
    terminal.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        // Log first 100 chars of significant output for debugging
        if (data.length > 10 && !data.startsWith('\x1b')) {
          console.log(
            `[Terminal] Sending ${data.length} bytes to client: ${data.substring(0, 100).replace(/\n/g, '\\n')}...`
          );
        }
      }
    });

    terminal.onExit(({ exitCode }: { exitCode: number }) => {
      console.log(`Terminal exited with code ${exitCode}`);
      // Unregister from execution manager when terminal exits
      executionManager.unregister(sessionName);
      if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'Terminal closed');
    });

    // Process any messages that were buffered during async setup
    setupComplete = true;
    console.log(
      `[Terminal] Setup complete for '${sessionName}', processing ${messageBuffer.length} buffered messages`
    );
    if (messageBuffer.length > 0) {
      for (const bufferedData of messageBuffer) {
        try {
          const msg: WSMessageToAgent = JSON.parse(bufferedData.toString());
          console.log(`[Terminal] Processing buffered message type: ${msg.type}`);
          handleTerminalMessage(msg, terminal, ws, sessionName, project!, projectPath);
        } catch (err) {
          console.error('Failed to parse buffered message:', err);
        }
      }
      messageBuffer.length = 0; // Clear buffer
    }

    ws.on('close', () => {
      console.log(`Client disconnected, tmux session '${sessionName}' preserved`);
      try {
        (terminal as any).removeAllListeners?.('data');
        (terminal as any).removeAllListeners?.('exit');
      } catch {
        /* ignore */
      }
      terminal.detach();

      const connections = activeConnections.get(sessionName);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) activeConnections.delete(sessionName);
      }
    });

    ws.on('error', (err) => console.error('WebSocket error:', err));
  })();
}

/**
 * Handle individual terminal messages
 */
function handleTerminalMessage(
  msg: WSMessageToAgent,
  terminal: ReturnType<typeof createTerminal>,
  ws: WebSocket,
  sessionName: string,
  project: string,
  _projectPath: string
): void {
  switch (msg.type) {
    case 'input':
      terminal.write(msg.data);
      if (msg.data.includes('\r') || msg.data.includes('\n')) {
        const existing = tmuxSessionStatus.get(sessionName);
        if (existing?.status === 'needs_attention' && existing?.attentionReason === 'input') {
          const now = Date.now();
          tmuxSessionStatus.set(sessionName, {
            status: 'working',
            lastEvent: 'UserInput',
            lastActivity: now,
            lastStatusChange: now,
            project,
          });
        }
      }
      break;
    case 'resize':
      terminal.resize(msg.cols, msg.rows);
      break;
    case 'start-claude':
      terminal.write('claude\r');
      break;
    case 'start-claude-ralph':
      handleRalphLoop(msg, terminal, sessionName, _projectPath);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    case 'request-history':
      terminal
        .captureHistory(msg.lines || 10000)
        .then((history) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({ type: 'history', data: history, lines: history.split('\n').length })
            );
          }
        })
        .catch((err) => console.error(`Failed to capture history:`, err));
      break;
  }
}

/**
 * Handle Ralph Loop start
 */
function handleRalphLoop(
  msg: WSMessageToAgent & { type: 'start-claude-ralph' },
  terminal: ReturnType<typeof createTerminal>,
  sessionName: string,
  projectPath: string
): void {
  const now = Date.now();
  const lastStart = ralphLoopLastStart.get(projectPath);
  if (lastStart && now - lastStart < RALPH_DEBOUNCE_MS) {
    console.log(`[Ralph] Ignoring duplicate for ${projectPath}`);
    return;
  }
  ralphLoopLastStart.set(projectPath, now);

  const ralphConfig = { ...msg.config };

  console.log(`[Ralph] Registering onReady callback for session '${sessionName}'`);
  terminal.onReady(() => {
    console.log(`[Ralph] onReady fired, waiting 300ms before sending command`);
    // Delay to let shell process exports and clear sequence before sending Claude command
    setTimeout(() => {
      console.log(`[Ralph] 300ms delay complete, preparing to write Claude command`);
      (async () => {
        const fsSync = await import('fs');
        const claudeDir = path.join(projectPath, '.claude');
        const ralphStateFile = path.join(claudeDir, 'ralph-loop.local.md');

        // Ensure ralph-loop plugin is enabled for this project
        const settingsFile = path.join(claudeDir, 'settings.json');
        try {
          let settings: { enabledPlugins?: Record<string, boolean> } = {};
          if (fsSync.existsSync(settingsFile)) {
            settings = JSON.parse(fsSync.readFileSync(settingsFile, 'utf-8'));
          }
          if (!settings.enabledPlugins) {
            settings.enabledPlugins = {};
          }
          if (!settings.enabledPlugins['ralph-loop@claude-plugins-official']) {
            console.log(`[Ralph] Enabling ralph-loop plugin for project`);
            settings.enabledPlugins['ralph-loop@claude-plugins-official'] = true;
            if (!fsSync.existsSync(claudeDir)) {
              fsSync.mkdirSync(claudeDir, { recursive: true });
            }
            fsSync.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
          }
        } catch (err) {
          console.error(`[Ralph] Failed to enable plugin:`, err);
        }

        if (!fsSync.existsSync(claudeDir)) {
          fsSync.mkdirSync(claudeDir, { recursive: true });
        }

        const ralphState = `---
iteration: 1
maxIterations: ${ralphConfig.maxIterations || 'unlimited'}
completionPromise: ${ralphConfig.completionPromise || 'none'}
useWorktree: ${ralphConfig.useWorktree || false}
trustMode: ${ralphConfig.trustMode || false}
active: true
createdAt: ${new Date().toISOString()}
---

# Ralph Loop Task

${ralphConfig.prompt}

---
*This file is auto-generated by 247 Dashboard. Do not edit manually.*
`;
        fsSync.writeFileSync(ralphStateFile, ralphState);

        if (ralphConfig.useWorktree) {
          const branchName = `ralph-${sessionName}-${Date.now()}`;
          terminal.write(
            `git worktree add -b ${branchName} ../ralph-${branchName} 2>/dev/null || echo "Worktree setup skipped"\r`
          );
          terminal.write(`cd ../ralph-${branchName} && `);
        }

        // Build Claude command flags
        const claudeFlags: string[] = [];
        if (ralphConfig.trustMode) {
          claudeFlags.push('--dangerously-skip-permissions');
        }

        // Build ralph-loop command arguments
        const ralphArgs: string[] = [];
        if (ralphConfig.maxIterations)
          ralphArgs.push(`--max-iterations ${ralphConfig.maxIterations}`);
        if (ralphConfig.completionPromise)
          ralphArgs.push(`--completion-promise "${ralphConfig.completionPromise}"`);

        // Sanitize prompt: remove shell special characters and escape for single-quotes
        const promptSanitized = ralphConfig.prompt
          .replace(/[&><;|`$!(){}[\]\\]/g, '') // Remove shell special chars
          .replace(/\n/g, ' ') // Replace newlines with spaces
          .replace(/'/g, "'\\''"); // Escape single quotes for shell

        // Build args string
        const argsStr = ralphArgs.length > 0 ? ` ${ralphArgs.join(' ')}` : '';

        // Launch Claude with the ralph-loop command as initial prompt (single-quoted)
        // Format: /pluginName:commandName - so /ralph-loop:ralph-loop
        const claudeFlagsStr = claudeFlags.length > 0 ? `${claudeFlags.join(' ')} ` : '';
        const fullCommand = `claude ${claudeFlagsStr}'/ralph-loop:ralph-loop ${promptSanitized}${argsStr}'`;
        console.log(`[Ralph] Writing command to terminal: ${fullCommand.substring(0, 100)}...`);
        terminal.write(`${fullCommand}\r`);
      })();
    }, 300); // 300ms delay to let shell stabilize
  });
}

/**
 * Handle status WebSocket connections (real-time session updates)
 */
export function handleStatusConnection(ws: WebSocket, url?: URL): void {
  console.log('[Status WS] New subscriber connected');
  statusSubscribers.add(ws);

  // Extract web version from query params and check for updates
  const webVersion = url?.searchParams.get('v');
  const agentVersion = getAgentVersion();

  // Send agent version info to client
  if (ws.readyState === WebSocket.OPEN) {
    const versionMessage: WSStatusMessageFromAgent = {
      type: 'version-info',
      agentVersion,
    };
    ws.send(JSON.stringify(versionMessage));
  }

  // Check if update needed (only upgrade, never downgrade)
  // Skip auto-update in cloud/Docker environments - they get updated via new image deployments
  const isCloudAgent = process.env.CLOUD_AGENT === 'true';
  if (
    webVersion &&
    !isUpdateInProgress() &&
    !isCloudAgent &&
    needsUpdate(agentVersion, webVersion)
  ) {
    console.log(`[Update] Version mismatch detected: agent=${agentVersion} web=${webVersion}`);

    // Delay update to allow client connection to stabilize
    setTimeout(() => {
      triggerUpdate(webVersion);
    }, 2000);
  }

  // Send initial session list
  (async () => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}|#{session_created}" 2>/dev/null'
      );

      const sessions: WSSessionInfo[] = [];

      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const [name, created] = line.split('|');
        const [project] = name.split('--');

        let status: SessionStatus = 'init';
        let attentionReason: AttentionReason | undefined;
        let statusSource: 'hook' | 'tmux' = 'tmux';
        let lastEvent: string | undefined;
        let lastStatusChange: number | undefined;

        const hookData = tmuxSessionStatus.get(name);
        if (hookData) {
          status = hookData.status;
          attentionReason = hookData.attentionReason;
          statusSource = 'hook';
          lastEvent = hookData.lastEvent;
          lastStatusChange = hookData.lastStatusChange;
        }

        const envId = getSessionEnvironment(name);
        const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

        sessions.push({
          name,
          project,
          createdAt: parseInt(created) * 1000,
          status,
          attentionReason,
          statusSource,
          lastActivity: hookData?.lastActivity,
          lastEvent,
          lastStatusChange,
          environmentId: envId,
          environment: envMeta
            ? {
                id: envMeta.id,
                name: envMeta.name,
                provider: envMeta.provider,
                icon: envMeta.icon,
                isDefault: envMeta.isDefault,
              }
            : undefined,
          // StatusLine metrics
          model: hookData?.model,
          costUsd: hookData?.costUsd,
          contextUsage: hookData?.contextUsage,
          linesAdded: hookData?.linesAdded,
          linesRemoved: hookData?.linesRemoved,
        });
      }

      const message: WSStatusMessageFromAgent = { type: 'sessions-list', sessions };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (err) {
      console.error('[Status WS] Failed to get initial sessions:', err);
      if (ws.readyState === WebSocket.OPEN) {
        const message: WSStatusMessageFromAgent = { type: 'sessions-list', sessions: [] };
        ws.send(JSON.stringify(message));
      }
    }
  })();

  ws.on('close', () => {
    statusSubscribers.delete(ws);
    console.log(`[Status WS] Subscriber disconnected (remaining: ${statusSubscribers.size})`);
  });

  ws.on('error', (err) => {
    console.error('[Status WS] Error:', err);
    statusSubscribers.delete(ws);
  });
}
