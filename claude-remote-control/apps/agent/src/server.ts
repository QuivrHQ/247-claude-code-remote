import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';
import httpProxy from 'http-proxy';
import { execSync } from 'child_process';
import * as path from 'path';
import { createTerminal } from './terminal.js';
import {
  initEditor,
  getOrStartEditor,
  stopEditor,
  getEditorStatus,
  getAllEditors,
  updateEditorActivity,
  shutdownAllEditors,
} from './editor.js';
// Database imports
import {
  initDatabase,
  closeDatabase,
  migrateEnvironmentsFromJson,
  RETENTION_CONFIG,
} from './db/index.js';
import {
  getEnvironmentsMetadata,
  getEnvironmentMetadata,
  getEnvironment,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  getEnvironmentVariables,
  setSessionEnvironment,
  getSessionEnvironment,
  clearSessionEnvironment,
  ensureDefaultEnvironment,
} from './db/environments.js';
import * as sessionsDb from './db/sessions.js';
import * as historyDb from './db/history.js';
import {
  cloneRepo,
  extractProjectName,
  listFiles,
  getFileContent,
  openFileInEditor,
  getChangesSummary,
} from './git.js';
import { config } from './config.js';
import type {
  WSMessageToAgent,
  AgentConfig,
  WSSessionInfo,
  WSStatusMessageFromAgent,
} from '@vibecompany/247-shared';

import type { SessionStatus, AttentionReason } from '@vibecompany/247-shared';

// Store session status from Claude Code hooks
// Simplified to 3 states: working (active), needs_attention (user intervention needed), idle (no activity)
interface HookStatus {
  status: SessionStatus;
  attentionReason?: AttentionReason;
  lastEvent: string;
  lastActivity: number;
  lastStatusChange: number; // Timestamp when status actually changed
  project?: string;
}

// Store by tmux session name - single source of truth for status
const tmuxSessionStatus = new Map<string, HookStatus>();

// Track active WebSocket connections per session
const activeConnections = new Map<string, Set<WebSocket>>();

// Track WebSocket subscribers for status updates (real-time push)
const statusSubscribers = new Set<WebSocket>();

// Broadcast status update to all subscribers
function broadcastStatusUpdate(session: WSSessionInfo) {
  if (statusSubscribers.size === 0) return;

  const message: WSStatusMessageFromAgent = { type: 'status-update', session };
  const messageStr = JSON.stringify(message);

  for (const ws of statusSubscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
  console.log(
    `[Status WS] Broadcast status update for ${session.name}: ${session.status} to ${statusSubscribers.size} subscribers`
  );
}

// Broadcast session removed to all subscribers
function broadcastSessionRemoved(sessionName: string) {
  if (statusSubscribers.size === 0) return;

  const message: WSStatusMessageFromAgent = { type: 'session-removed', sessionName };
  const messageStr = JSON.stringify(message);

  for (const ws of statusSubscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
  console.log(`[Status WS] Broadcast session removed: ${sessionName}`);
}

// Broadcast session archived to all subscribers
function broadcastSessionArchived(sessionName: string, session: WSSessionInfo) {
  if (statusSubscribers.size === 0) return;

  const message: WSStatusMessageFromAgent = { type: 'session-archived', sessionName, session };
  const messageStr = JSON.stringify(message);

  for (const ws of statusSubscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
  console.log(`[Status WS] Broadcast session archived: ${sessionName}`);
}

// Generate human-readable session names with project prefix
function generateSessionName(project: string): string {
  const adjectives = [
    'brave',
    'swift',
    'calm',
    'bold',
    'wise',
    'keen',
    'fair',
    'wild',
    'bright',
    'cool',
  ];
  const nouns = ['lion', 'hawk', 'wolf', 'bear', 'fox', 'owl', 'deer', 'lynx', 'eagle', 'tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${project}--${adj}-${noun}-${num}`;
}

// Clean up stale status entries (called periodically)
function cleanupStatusMaps() {
  const now = Date.now();
  const STALE_THRESHOLD = RETENTION_CONFIG.sessionMaxAge;

  let cleanedTmux = 0;

  // Get active tmux sessions
  let activeSessions = new Set<string>();
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', {
      encoding: 'utf-8',
    });
    activeSessions = new Set(output.trim().split('\n').filter(Boolean));
  } catch {
    // No tmux sessions exist
  }

  // Clean tmuxSessionStatus - remove if session doesn't exist OR is stale
  for (const [sessionName, status] of tmuxSessionStatus) {
    const sessionExists = activeSessions.has(sessionName);
    const isStale = now - status.lastActivity > STALE_THRESHOLD;

    if (!sessionExists || isStale) {
      tmuxSessionStatus.delete(sessionName);
      cleanedTmux++;
    }
  }

  if (cleanedTmux > 0) {
    console.log(`[Status Cleanup] Removed ${cleanedTmux} stale status entries from memory`);
  }

  // Also cleanup SQLite database (pass archivedMaxAge for archived session cleanup)
  const dbSessionsCleaned = sessionsDb.cleanupStaleSessions(
    STALE_THRESHOLD,
    RETENTION_CONFIG.archivedMaxAge
  );
  const dbHistoryCleaned = historyDb.cleanupOldHistory(RETENTION_CONFIG.historyMaxAge);

  if (dbSessionsCleaned > 0 || dbHistoryCleaned > 0) {
    console.log(`[DB Cleanup] Sessions: ${dbSessionsCleaned}, History: ${dbHistoryCleaned}`);
  }
}

// Run cleanup every hour
setInterval(cleanupStatusMaps, 60 * 60 * 1000);

export async function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = createHttpServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Initialize editor manager (cleans up orphan code-server processes)
  const typedConfig = config as unknown as AgentConfig;
  await initEditor(typedConfig.editor, config.projects.basePath);

  // Initialize SQLite database
  const db = initDatabase();

  // Migrate environments from JSON if this is a fresh database
  migrateEnvironmentsFromJson(db);

  // Ensure default environment exists
  ensureDefaultEnvironment();

  // Reconcile sessions with active tmux sessions
  let activeTmuxSessions = new Set<string>();
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', {
      encoding: 'utf-8',
    });
    activeTmuxSessions = new Set(output.trim().split('\n').filter(Boolean));
  } catch {
    // No tmux sessions exist
  }
  sessionsDb.reconcileWithTmux(activeTmuxSessions);

  // Populate in-memory Map from database (for backward compatibility during transition)
  const dbSessions = sessionsDb.getAllSessions();
  for (const session of dbSessions) {
    tmuxSessionStatus.set(session.name, sessionsDb.toHookStatus(session));
  }
  console.log(`[DB] Loaded ${dbSessions.length} sessions from database`);

  // Create proxy for code-server
  const editorProxy = httpProxy.createProxyServer({
    ws: true,
    changeOrigin: true,
  });

  editorProxy.on('error', (err, _req, res) => {
    console.error('[Editor Proxy] HTTP Error:', err.message);
    if (res && 'writeHead' in res) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Editor proxy error', message: err.message }));
    }
  });

  // WebSocket proxy events for debugging
  editorProxy.on('proxyReqWs', (proxyReq, _req, _socket) => {
    console.log('[Editor Proxy] WS request to:', proxyReq.path);
  });

  editorProxy.on('open', (_proxySocket) => {
    console.log('[Editor Proxy] WS connection opened');
  });

  editorProxy.on('close', (_res, _socket, _head) => {
    console.log('[Editor Proxy] WS connection closed');
  });

  // WebSocket terminal handler
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const project = url.searchParams.get('project');
    const urlSessionName = url.searchParams.get('session');
    const environmentId = url.searchParams.get('environment'); // Environment to use
    const sessionName = urlSessionName || generateSessionName(project || 'unknown');

    // Validate project - if whitelist is empty, allow any project
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
    if (environmentId) {
      const env = getEnvironment(environmentId);
      console.log(`Using environment: ${env?.name || environmentId}`);
    }

    // Verify path exists
    const fs = await import('fs');
    if (!fs.existsSync(projectPath)) {
      console.error(`Path does not exist: ${projectPath}`);
      ws.close(1008, 'Project path not found');
      return;
    }

    // Get environment variables for this session
    const envVars = getEnvironmentVariables(environmentId || undefined);

    let terminal;
    try {
      terminal = createTerminal(projectPath, sessionName, envVars);
      // Track which environment this session uses
      if (environmentId) {
        setSessionEnvironment(sessionName, environmentId);
      }
    } catch (err) {
      console.error('Failed to create terminal:', err);
      // Clean up any partial state
      clearSessionEnvironment(sessionName);
      ws.close(1011, 'Failed to create terminal');
      return;
    }

    // Track this connection
    if (!activeConnections.has(sessionName)) {
      activeConnections.set(sessionName, new Set());
    }
    activeConnections.get(sessionName)!.add(ws);
    console.log(
      `[Connections] Added connection to '${sessionName}' (total: ${activeConnections.get(sessionName)!.size})`
    );

    // If reconnecting to an existing session, send the scrollback history
    if (terminal.isExistingSession()) {
      console.log(`Reconnecting to existing session '${sessionName}', sending history...`);
      terminal
        .captureHistory(10000)
        .then((history) => {
          if (history && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'history',
                data: history,
                lines: history.split('\n').length,
              })
            );
          }
        })
        .catch((err) => {
          console.error(`[Terminal] Failed to capture initial history for '${sessionName}':`, err);
        });
    } else {
      // New session created - register in DB and broadcast to subscribers
      const now = Date.now();
      const sessionProject = project!;

      // Store in database (may be undefined in test environments)
      let createdAt = now;
      try {
        const dbSession = sessionsDb.upsertSession(sessionName, {
          project: sessionProject,
          status: 'init',
          attentionReason: undefined,
          lastEvent: 'SessionCreated',
          lastActivity: now,
          lastStatusChange: now,
          environmentId: environmentId || undefined,
        });
        if (dbSession?.created_at) {
          createdAt = dbSession.created_at;
        }
      } catch (err) {
        console.error(`[Session] Failed to persist session '${sessionName}':`, err);
      }

      // Update in-memory map
      tmuxSessionStatus.set(sessionName, {
        status: 'init',
        lastEvent: 'SessionCreated',
        lastActivity: now,
        lastStatusChange: now,
        project: sessionProject,
      });

      // Get environment info for the broadcast
      const envMeta = environmentId ? getEnvironmentMetadata(environmentId) : undefined;

      // Broadcast new session to all subscribers
      broadcastStatusUpdate({
        name: sessionName,
        project: sessionProject,
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

      console.log(
        `[Session] New session '${sessionName}' created and broadcast to ${statusSubscribers.size} subscribers`
      );
    }

    // Forward terminal output to WebSocket - store handler for cleanup
    const dataHandler = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    };
    terminal.onData(dataHandler);

    const exitHandler = ({ exitCode }: { exitCode: number }) => {
      console.log(`Terminal exited with code ${exitCode}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Terminal closed');
      }
    };
    terminal.onExit(exitHandler);

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const msg: WSMessageToAgent = JSON.parse(data.toString());

        switch (msg.type) {
          case 'input':
            terminal.write(msg.data);
            // Update status to 'working' when user sends input
            // This helps track when the user provides input that might resume Claude
            if (msg.data.includes('\r') || msg.data.includes('\n')) {
              const existing = tmuxSessionStatus.get(sessionName);
              const currentStatus = existing?.status;

              // Only set to working if Claude was waiting for attention (input)
              // Don't overwrite: working (already active), idle (no session)
              if (currentStatus === 'needs_attention' && existing?.attentionReason === 'input') {
                const now = Date.now();
                tmuxSessionStatus.set(sessionName, {
                  status: 'working',
                  lastEvent: 'UserInput',
                  lastActivity: now,
                  lastStatusChange: now,
                  project,
                });
                console.log(`[Status] Updated '${sessionName}' to 'working' (user input)`);
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
            // Create ralph loop config file and start claude
            (async () => {
              const fsSync = await import('fs');
              const ralphConfig = msg.config;
              const claudeDir = path.join(projectPath, '.claude');
              const ralphStateFile = path.join(claudeDir, 'ralph-loop.local.md');

              // Ensure .claude directory exists
              if (!fsSync.existsSync(claudeDir)) {
                fsSync.mkdirSync(claudeDir, { recursive: true });
              }

              // Create ralph loop state file
              const ralphState = `---
iteration: 1
maxIterations: ${ralphConfig.maxIterations || 'unlimited'}
completionPromise: ${ralphConfig.completionPromise || 'none'}
useWorktree: ${ralphConfig.useWorktree || false}
active: true
createdAt: ${new Date().toISOString()}
---

# Ralph Loop Task

${ralphConfig.prompt}

---
*This file is auto-generated by 247 Dashboard. Do not edit manually.*
`;
              fsSync.writeFileSync(ralphStateFile, ralphState);
              console.log(`[Ralph] Created ralph loop state: ${ralphStateFile}`);

              // If worktree requested, create it first
              if (ralphConfig.useWorktree) {
                const branchName = `ralph-${sessionName}-${Date.now()}`;
                terminal.write(
                  `git worktree add -b ${branchName} ../ralph-${branchName} 2>/dev/null || echo "Worktree setup skipped"\r`
                );
                terminal.write(`cd ../ralph-${branchName} && `);
              }

              // Start claude with ralph loop command using correct syntax
              const args: string[] = [];
              if (ralphConfig.maxIterations) {
                args.push(`--max-iterations ${ralphConfig.maxIterations}`);
              }
              if (ralphConfig.completionPromise) {
                args.push(`--completion-promise "${ralphConfig.completionPromise}"`);
              }

              // Use the ralph-loop slash command format
              const ralphPromptEscaped = ralphConfig.prompt
                .replace(/"/g, '\\"')
                .replace(/\n/g, ' ');
              terminal.write(
                `claude -p '/ralph-loop:ralph-loop "${ralphPromptEscaped}" ${args.join(' ')}'\r`
              );
            })();
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
                    JSON.stringify({
                      type: 'history',
                      data: history,
                      lines: history.split('\n').length,
                    })
                  );
                }
              })
              .catch((err) => {
                console.error(`[Terminal] Failed to capture history for '${sessionName}':`, err);
              });
            break;
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected, tmux session '${sessionName}' preserved`);

      // Remove terminal event listeners to prevent memory leaks
      try {
        (terminal as any).removeAllListeners?.('data');
        (terminal as any).removeAllListeners?.('exit');
      } catch {
        // Terminal may not support removeAllListeners, ignore
      }

      // Detach from tmux instead of killing - session stays alive
      terminal.detach();

      // Remove from active connections
      const connections = activeConnections.get(sessionName);
      if (connections) {
        connections.delete(ws);
        console.log(
          `[Connections] Removed connection from '${sessionName}' (remaining: ${connections.size})`
        );
        if (connections.size === 0) {
          activeConnections.delete(sessionName);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  // REST API endpoints
  app.get('/api/projects', (_req, res) => {
    res.json(config.projects.whitelist);
  });

  // Dynamic folder listing - scans basePath for directories
  app.get('/api/folders', async (_req, res) => {
    try {
      const fs = await import('fs/promises');
      const basePath = config.projects.basePath.replace('~', process.env.HOME!);

      const entries = await fs.readdir(basePath, { withFileTypes: true });
      const folders = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();

      res.json(folders);
    } catch (err) {
      console.error('Failed to list folders:', err);
      res.status(500).json({ error: 'Failed to list folders' });
    }
  });

  // Clone a git repository
  app.post('/api/clone', async (req, res) => {
    const { repoUrl, projectName } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: 'Missing repoUrl' });
    }

    try {
      const result = await cloneRepo(repoUrl, config.projects.basePath, projectName);

      if (result.success) {
        res.json({
          success: true,
          projectName: result.projectName,
          path: result.path,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          projectName: result.projectName,
        });
      }
    } catch (err) {
      console.error('Clone error:', err);
      res.status(500).json({ error: 'Internal server error during clone' });
    }
  });

  // Preview what project name would be extracted from a URL
  app.get('/api/clone/preview', (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    const projectName = extractProjectName(url);
    res.json({ projectName });
  });

  // ========== Environment API Endpoints ==========

  // List all environments (metadata only - no secret values sent to dashboard)
  app.get('/api/environments', (_req, res) => {
    res.json(getEnvironmentsMetadata());
  });

  // Get single environment metadata
  app.get('/api/environments/:id', (req, res) => {
    const metadata = getEnvironmentMetadata(req.params.id);
    if (!metadata) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    res.json(metadata);
  });

  // Get full environment data (including secret values) - for local editing only
  app.get('/api/environments/:id/full', (req, res) => {
    const env = getEnvironment(req.params.id);
    if (!env) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    res.json(env);
  });

  // Create environment
  app.post('/api/environments', (req, res) => {
    const { name, provider, icon, isDefault, variables } = req.body;

    if (!name || !provider) {
      return res.status(400).json({ error: 'Missing required fields: name, provider' });
    }

    try {
      const env = createEnvironment({
        name,
        provider,
        icon,
        isDefault,
        variables: variables ?? {},
      });
      // Return metadata only (not the actual secrets)
      res.status(201).json({
        id: env.id,
        name: env.name,
        provider: env.provider,
        icon: env.icon,
        isDefault: env.isDefault,
        variableKeys: Object.keys(env.variables),
        createdAt: env.createdAt,
        updatedAt: env.updatedAt,
      });
    } catch (err) {
      console.error('[Environments] Create error:', err);
      res.status(500).json({ error: 'Failed to create environment' });
    }
  });

  // Update environment
  app.put('/api/environments/:id', (req, res) => {
    const { name, provider, icon, isDefault, variables } = req.body;

    const updated = updateEnvironment(req.params.id, {
      name,
      provider,
      icon,
      isDefault,
      variables,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    // Return metadata only
    res.json({
      id: updated.id,
      name: updated.name,
      provider: updated.provider,
      icon: updated.icon,
      isDefault: updated.isDefault,
      variableKeys: Object.keys(updated.variables),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  });

  // Delete environment
  app.delete('/api/environments/:id', (req, res) => {
    const deleted = deleteEnvironment(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Environment not found' });
    }
    res.json({ success: true });
  });

  // Receive status updates from Claude Code hooks
  // The hook script now sends pre-mapped status, making this endpoint simpler
  app.post('/api/hooks/status', (req, res) => {
    const { event, status, attention_reason, session_id, tmux_session, project, timestamp } =
      req.body;

    if (!event) {
      return res.status(400).json({ error: 'Missing event' });
    }

    // Validate status
    const validStatuses: SessionStatus[] = ['init', 'working', 'needs_attention', 'idle'];
    const receivedStatus: SessionStatus = validStatuses.includes(status) ? status : 'working';

    // Validate attention_reason if provided
    const validReasons: AttentionReason[] = [
      'permission',
      'input',
      'plan_approval',
      'task_complete',
    ];
    const receivedReason: AttentionReason | undefined =
      attention_reason && validReasons.includes(attention_reason) ? attention_reason : undefined;

    const now = Date.now();

    // Store by tmux session name (REQUIRED for per-session status)
    if (tmux_session) {
      const existing = tmuxSessionStatus.get(tmux_session);
      const statusChanged = !existing || existing.status !== receivedStatus;

      const hookData: HookStatus = {
        status: receivedStatus,
        attentionReason: receivedReason,
        lastEvent: event,
        lastActivity: timestamp || now,
        lastStatusChange: statusChanged ? now : existing.lastStatusChange,
        project,
      };

      // Write to SQLite database first (persistent storage)
      // The DB preserves the original createdAt from when the session was first seen
      const sessionProject = tmux_session.split('--')[0] || project;
      const dbSession = sessionsDb.upsertSession(tmux_session, {
        project: sessionProject,
        status: receivedStatus,
        attentionReason: receivedReason,
        lastEvent: event,
        lastActivity: timestamp || now,
        lastStatusChange: statusChanged ? now : (existing?.lastStatusChange ?? now),
        environmentId: getSessionEnvironment(tmux_session),
      });

      // Then update in-memory Map (for real-time performance)
      tmuxSessionStatus.set(tmux_session, hookData);

      // Broadcast status update to WebSocket subscribers
      // Use createdAt from DB to ensure stable sorting on the frontend
      const envId = getSessionEnvironment(tmux_session);
      const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

      broadcastStatusUpdate({
        name: tmux_session,
        project: sessionProject || project,
        status: hookData.status,
        attentionReason: hookData.attentionReason,
        statusSource: 'hook',
        lastEvent: hookData.lastEvent,
        lastStatusChange: hookData.lastStatusChange,
        createdAt: dbSession.created_at, // Use stable createdAt from DB, not current timestamp
        lastActivity: undefined,
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
      });

      console.log(
        `[Hook] ${tmux_session}: ${event} → ${receivedStatus}${receivedReason ? ` (${receivedReason})` : ''}`
      );
    } else {
      // Warning: tmux_session is required for proper per-session status tracking
      console.warn(
        `[Hook] WARNING: Missing tmux_session for ${event} (session_id=${session_id}, project=${project})`
      );
    }

    res.json({ received: true });
  });

  // Enhanced sessions endpoint with detailed info
  // Combines Claude Code hooks (reliable) with tmux heuristics (instant fallback)
  app.get('/api/sessions', async (_req, res) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      // Get session list with creation time
      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}|#{session_created}" 2>/dev/null'
      );

      const sessions: WSSessionInfo[] = [];

      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const [name, created] = line.split('|');
        // Extract project from session name (format: project--adjective-noun-number)
        const [project] = name.split('--');

        let status: SessionStatus = 'init';
        let attentionReason: AttentionReason | undefined;
        let statusSource: 'hook' | 'tmux' = 'tmux';
        let lastEvent: string | undefined;
        let lastStatusChange: number | undefined;

        // Use hook status if available, otherwise idle
        const hookData = tmuxSessionStatus.get(name);

        if (hookData) {
          status = hookData.status;
          attentionReason = hookData.attentionReason;
          statusSource = 'hook';
          lastEvent = hookData.lastEvent;
          lastStatusChange = hookData.lastStatusChange;
        }

        // Get environment info for this session
        const envId = getSessionEnvironment(name);
        const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

        sessions.push({
          name,
          project,
          createdAt: parseInt(created) * 1000,
          status,
          attentionReason,
          statusSource,
          lastActivity: '',
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
        });
      }

      res.json(sessions);
    } catch {
      res.json([]);
    }
  });

  // Get terminal preview (last N lines from tmux pane)
  app.get('/api/sessions/:sessionName/preview', async (req, res) => {
    const { sessionName } = req.params;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Validate session name format to prevent injection
    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    try {
      // Capture last 20 lines from the tmux pane
      const { stdout } = await execAsync(
        `tmux capture-pane -t "${sessionName}" -p -S -20 2>/dev/null`
      );

      // Split into lines and take last 15 non-empty lines for display
      const allLines = stdout.split('\n');
      const lines = allLines
        .slice(-16, -1)
        .filter((line) => line.trim() !== '' || allLines.indexOf(line) > allLines.length - 5);

      res.json({
        lines: lines.length > 0 ? lines : ['(empty terminal)'],
        timestamp: Date.now(),
      });
    } catch {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  // Kill a tmux session
  app.delete('/api/sessions/:sessionName', async (req, res) => {
    const { sessionName } = req.params;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Validate session name format to prevent injection
    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    try {
      await execAsync(`tmux kill-session -t "${sessionName}" 2>/dev/null`);
      console.log(`Killed tmux session: ${sessionName}`);

      // Clean up from SQLite database
      sessionsDb.deleteSession(sessionName);
      sessionsDb.clearSessionEnvironmentId(sessionName);

      // Clean up status tracking (in-memory) and broadcast removal
      tmuxSessionStatus.delete(sessionName);
      clearSessionEnvironment(sessionName); // Clean up environment tracking
      broadcastSessionRemoved(sessionName);

      res.json({ success: true, message: `Session ${sessionName} killed` });
    } catch {
      res.status(404).json({ error: 'Session not found or already killed' });
    }
  });

  // Archive a session (mark as done and keep in history)
  app.post('/api/sessions/:sessionName/archive', async (req, res) => {
    const { sessionName } = req.params;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Validate session name format to prevent injection
    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    // Archive the session in SQLite
    const archivedSession = sessionsDb.archiveSession(sessionName);
    if (!archivedSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Kill the tmux session (terminal no longer needed)
    try {
      await execAsync(`tmux kill-session -t "${sessionName}" 2>/dev/null`);
      console.log(`[Archive] Killed tmux session: ${sessionName}`);
    } catch {
      // Session might already be dead, that's fine
      console.log(`[Archive] Tmux session ${sessionName} was already gone`);
    }

    // Clean up in-memory status tracking
    tmuxSessionStatus.delete(sessionName);

    // Get environment info for the response
    const envId = getSessionEnvironment(sessionName);
    const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

    // Broadcast session-archived event
    const archivedInfo: WSSessionInfo = {
      name: sessionName,
      project: archivedSession.project,
      createdAt: archivedSession.created_at,
      status: archivedSession.status,
      attentionReason: archivedSession.attention_reason ?? undefined,
      statusSource: 'hook',
      lastEvent: archivedSession.last_event ?? undefined,
      lastStatusChange: archivedSession.last_status_change,
      archivedAt: archivedSession.archived_at ?? undefined,
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
    };

    broadcastSessionArchived(sessionName, archivedInfo);

    res.json({
      success: true,
      message: `Session ${sessionName} archived`,
      session: archivedInfo,
    });
  });

  // Get archived sessions
  app.get('/api/sessions/archived', (_req, res) => {
    const archivedSessions = sessionsDb.getArchivedSessions();

    const sessions: WSSessionInfo[] = archivedSessions.map((session) => {
      const envId = getSessionEnvironment(session.name);
      const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

      return {
        name: session.name,
        project: session.project,
        createdAt: session.created_at,
        status: session.status,
        attentionReason: session.attention_reason ?? undefined,
        statusSource: 'hook' as const,
        lastEvent: session.last_event ?? undefined,
        lastStatusChange: session.last_status_change,
        archivedAt: session.archived_at ?? undefined,
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
      };
    });

    res.json(sessions);
  });

  // ========== Editor API Endpoints ==========

  // Helper to check if project is allowed (whitelist empty = allow any)
  const isProjectAllowed = (project: string): boolean => {
    const whitelist = config.projects.whitelist as string[];
    const hasWhitelist = whitelist && whitelist.length > 0;
    return hasWhitelist ? whitelist.includes(project) : true;
  };

  // Get editor status for a project
  app.get('/api/editor/:project/status', (req, res) => {
    const { project } = req.params;

    if (!isProjectAllowed(project)) {
      return res.status(403).json({ error: 'Project not allowed' });
    }

    res.json(getEditorStatus(project));
  });

  // Start editor for a project
  app.post('/api/editor/:project/start', async (req, res) => {
    const { project } = req.params;

    if (!isProjectAllowed(project)) {
      return res.status(403).json({ error: 'Project not allowed' });
    }

    // Check if editor is enabled
    if (!typedConfig.editor?.enabled) {
      return res.status(400).json({ error: 'Editor is disabled in config' });
    }

    try {
      const editor = await getOrStartEditor(project);
      res.json({
        success: true,
        port: editor.port,
        startedAt: editor.startedAt,
      });
    } catch (err) {
      console.error('[Editor] Failed to start:', err);
      res.status(500).json({ error: 'Failed to start editor', message: (err as Error).message });
    }
  });

  // Stop editor for a project
  app.post('/api/editor/:project/stop', (req, res) => {
    const { project } = req.params;

    if (!isProjectAllowed(project)) {
      return res.status(403).json({ error: 'Project not allowed' });
    }

    const stopped = stopEditor(project);
    res.json({ success: stopped });
  });

  // List all running editors
  app.get('/api/editors', (_req, res) => {
    res.json(getAllEditors());
  });

  // ========== File Explorer API Endpoints ==========

  // Get files tree with git status for a project
  app.get('/api/files/:project', async (req, res) => {
    const { project } = req.params;

    if (!isProjectAllowed(project)) {
      return res.status(403).json({ error: 'Project not allowed' });
    }

    try {
      const projectPath = `${config.projects.basePath}/${project}`.replace('~', process.env.HOME!);

      // Check if project exists
      const fs = await import('fs');
      if (!fs.existsSync(projectPath)) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get file tree
      const files = await listFiles(projectPath);

      // Get changes summary
      const summary = await getChangesSummary(projectPath);

      res.json({
        files,
        summary,
      });
    } catch (err) {
      console.error('[Files] Failed to list files:', err);
      res.status(500).json({ error: 'Failed to list files', message: (err as Error).message });
    }
  });

  // Get content of a specific file
  app.get('/api/files/:project/content', async (req, res) => {
    const { project } = req.params;
    const { path: filePath } = req.query;

    if (!isProjectAllowed(project)) {
      return res.status(403).json({ error: 'Project not allowed' });
    }

    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    // Validate path to prevent directory traversal
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    try {
      const projectPath = `${config.projects.basePath}/${project}`.replace('~', process.env.HOME!);
      const content = await getFileContent(projectPath, filePath);

      res.json(content);
    } catch (err) {
      console.error('[Files] Failed to get file content:', err);
      res.status(500).json({ error: 'Failed to read file', message: (err as Error).message });
    }
  });

  // Open a file in the local editor
  app.post('/api/files/:project/open', async (req, res) => {
    const { project } = req.params;
    const { path: filePath } = req.body;

    if (!isProjectAllowed(project)) {
      return res.status(403).json({ error: 'Project not allowed' });
    }

    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Missing path in body' });
    }

    // Validate path
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    try {
      const projectPath = `${config.projects.basePath}/${project}`.replace('~', process.env.HOME!);
      const result = await openFileInEditor(projectPath, filePath);

      if (result.success) {
        res.json({
          success: true,
          command: result.command,
        });
      } else {
        res.status(400).json(result);
      }
    } catch (err) {
      console.error('[Files] Failed to open file:', err);
      res.status(500).json({ error: 'Failed to open file', message: (err as Error).message });
    }
  });

  // ========== Editor Proxy Routes ==========

  // Proxy HTTP requests to code-server
  app.use('/editor/:project', async (req, res, _next) => {
    const { project } = req.params;

    // Validate project
    if (!isProjectAllowed(project)) {
      return res.status(403).json({ error: 'Project not allowed' });
    }

    // Check if editor is enabled
    if (!typedConfig.editor?.enabled) {
      return res.status(400).json({ error: 'Editor is disabled in config' });
    }

    try {
      // Get or start the editor
      const editor = await getOrStartEditor(project);
      updateEditorActivity(project);

      // Rewrite the URL to remove /editor/:project prefix
      req.url = req.url.replace(`/editor/${project}`, '') || '/';

      // Proxy to code-server
      editorProxy.web(req, res, {
        target: `http://127.0.0.1:${editor.port}`,
      });
    } catch (err) {
      console.error('[Editor Proxy] Failed:', err);
      res.status(502).json({ error: 'Failed to proxy to editor' });
    }
  });

  // Handle ALL WebSocket upgrades manually (noServer mode)
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // Handle terminal WebSocket
    if (url.pathname === '/terminal') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
      return;
    }

    // Handle status WebSocket (real-time session status updates)
    if (url.pathname === '/status') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        console.log('[Status WS] New subscriber connected');
        statusSubscribers.add(ws);

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

              // Use hook status if available, otherwise idle
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
                lastActivity: '',
                lastEvent,
                lastStatusChange,
                environmentId: getSessionEnvironment(name),
              });
            }

            const message: WSStatusMessageFromAgent = { type: 'sessions-list', sessions };
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(message));
              console.log(`[Status WS] Sent initial sessions list: ${sessions.length} sessions`);
            }
          } catch (err) {
            console.error('[Status WS] Failed to get initial sessions:', err);
            if (ws.readyState === WebSocket.OPEN) {
              try {
                const message: WSStatusMessageFromAgent = { type: 'sessions-list', sessions: [] };
                ws.send(JSON.stringify(message));
              } catch (sendErr) {
                console.error('[Status WS] Failed to send error response:', sendErr);
              }
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
      });
      return;
    }

    // Handle editor WebSocket
    if (url.pathname.startsWith('/editor/')) {
      const pathParts = url.pathname.split('/');
      const project = pathParts[2];

      if (!project || !isProjectAllowed(project)) {
        socket.destroy();
        return;
      }

      if (!typedConfig.editor?.enabled) {
        socket.destroy();
        return;
      }

      try {
        const editor = await getOrStartEditor(project);
        updateEditorActivity(project);

        // Rewrite the URL - ensure path starts with /
        const rewrittenPath = url.pathname.replace(`/editor/${project}`, '') || '/';
        req.url = rewrittenPath + url.search;

        console.log(`[Editor WS] Proxying ${url.pathname} → ${req.url} to port ${editor.port}`);

        editorProxy.ws(req, socket, head, {
          target: `http://127.0.0.1:${editor.port}`,
        });
      } catch (err) {
        console.error('[Editor WS] Failed:', err);
        socket.destroy();
      }
      return;
    }

    // Unknown WebSocket path - destroy
    socket.destroy();
  });

  // Graceful shutdown handler
  const shutdown = () => {
    console.log('[Server] Shutting down...');
    shutdownAllEditors();
    closeDatabase(); // Close SQLite database
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}
