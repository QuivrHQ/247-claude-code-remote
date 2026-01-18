/**
 * WebSocket handlers for terminal connections and status subscriptions.
 * Simplified version without worktree or execution manager features.
 */

import { WebSocket } from 'ws';
import { execSync } from 'child_process';
import { createTerminal } from './terminal.js';
import { config } from './config.js';
import * as sessionsDb from './db/sessions.js';

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
import { getAgentVersion, needsUpdate } from './version.js';
import { triggerUpdate, isUpdateInProgress } from './updater.js';

/**
 * Handle terminal WebSocket connections
 */
export function handleTerminalConnection(ws: WebSocket, url: URL): void {
  const project = url.searchParams.get('project');
  const urlSessionName = url.searchParams.get('session');
  const createFlag = url.searchParams.get('create') === 'true';
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

    // Create terminal
    let terminal;
    try {
      terminal = createTerminal(projectPath, sessionName, {});
      terminalRef = terminal; // Store reference for early message handler
    } catch (err) {
      console.error('Failed to create terminal:', err);
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

      broadcastStatusUpdate({
        name: sessionName,
        project: project!,
        status: 'init',
        statusSource: 'hook',
        lastEvent: 'SessionCreated',
        lastStatusChange: now,
        createdAt,
        lastActivity: undefined,
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
