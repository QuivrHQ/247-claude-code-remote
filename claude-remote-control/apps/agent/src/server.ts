import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';
import httpProxy from 'http-proxy';
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
import { cloneRepo, extractProjectName } from './git.js';
import config from '../config.json' with { type: 'json' };
import type { WSMessageToAgent, AgentConfig } from '@claude-remote/shared';

// Store session status from Claude Code hooks (more reliable than tmux heuristics)
interface HookStatus {
  status: 'running' | 'waiting' | 'stopped' | 'ended' | 'permission';
  lastEvent: string;
  lastActivity: number;
  lastStatusChange: number; // Timestamp when status actually changed
  project?: string;
  toolName?: string;
  stopReason?: string;
}

// Store by tmux session name (primary) and Claude session_id (backup for debugging)
// NOTE: Removed projectHookStatus - it caused status sharing between sessions in same project
const tmuxSessionStatus = new Map<string, HookStatus>();
const claudeSessionStatus = new Map<string, HookStatus>();

// Track pending tool executions to detect permission waiting
const pendingTools = new Map<string, { toolName: string; timestamp: number }>();

// Track active WebSocket connections per session
const activeConnections = new Map<string, Set<WebSocket>>();

// Generate human-readable session names with project prefix
function generateSessionName(project: string): string {
  const adjectives = ['brave', 'swift', 'calm', 'bold', 'wise', 'keen', 'fair', 'wild', 'bright', 'cool'];
  const nouns = ['lion', 'hawk', 'wolf', 'bear', 'fox', 'owl', 'deer', 'lynx', 'eagle', 'tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${project}--${adj}-${noun}-${num}`;
}

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = createHttpServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Initialize editor manager
  const typedConfig = config as unknown as AgentConfig;
  initEditor(typedConfig.editor, config.projects.basePath);

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
  editorProxy.on('proxyReqWs', (proxyReq, req, socket) => {
    console.log('[Editor Proxy] WS request to:', proxyReq.path);
  });

  editorProxy.on('open', (proxySocket) => {
    console.log('[Editor Proxy] WS connection opened');
  });

  editorProxy.on('close', (res, socket, head) => {
    console.log('[Editor Proxy] WS connection closed');
  });

  // WebSocket terminal handler
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const project = url.searchParams.get('project');
    const urlSessionName = url.searchParams.get('session');
    const sessionName = urlSessionName || generateSessionName(project || 'unknown');

    // Validate project - if whitelist is empty, allow any project
    const hasWhitelist = config.projects.whitelist && config.projects.whitelist.length > 0;
    const isAllowed = hasWhitelist ? config.projects.whitelist.includes(project!) : true;
    if (!project || !isAllowed) {
      ws.close(1008, 'Project not allowed');
      return;
    }

    const projectPath = `${config.projects.basePath}/${project}`.replace(
      '~',
      process.env.HOME!
    );

    console.log(`New terminal connection for project: ${project}`);
    console.log(`Project path: ${projectPath}`);

    // Verify path exists
    const fs = await import('fs');
    if (!fs.existsSync(projectPath)) {
      console.error(`Path does not exist: ${projectPath}`);
      ws.close(1008, 'Project path not found');
      return;
    }

    let terminal;
    try {
      terminal = createTerminal(projectPath, sessionName);
    } catch (err) {
      console.error('Failed to create terminal:', err);
      ws.close(1011, 'Failed to create terminal');
      return;
    }

    // Track this connection
    if (!activeConnections.has(sessionName)) {
      activeConnections.set(sessionName, new Set());
    }
    activeConnections.get(sessionName)!.add(ws);
    console.log(`[Connections] Added connection to '${sessionName}' (total: ${activeConnections.get(sessionName)!.size})`);

    // If reconnecting to an existing session, send the scrollback history
    if (terminal.isExistingSession()) {
      console.log(`Reconnecting to existing session '${sessionName}', sending history...`);
      terminal.captureHistory(10000).then((history) => {
        if (history && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'history',
            data: history,
            lines: history.split('\n').length
          }));
        }
      });
    }

    // Forward terminal output to WebSocket
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    terminal.onExit(({ exitCode }) => {
      console.log(`Terminal exited with code ${exitCode}`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Terminal closed');
      }
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const msg: WSMessageToAgent = JSON.parse(data.toString());

        switch (msg.type) {
          case 'input':
            terminal.write(msg.data);
            // Update status to 'running' when user sends input from stopped/waiting state
            // Don't overwrite permission status (user might just be accepting/rejecting)
            if (msg.data.includes('\r') || msg.data.includes('\n')) {
              const existing = tmuxSessionStatus.get(sessionName);
              const currentStatus = existing?.status;

              // Only set to running if Claude was waiting for input (stopped/waiting)
              // Don't overwrite: running (already running), permission (user accepting/rejecting), ended
              if (!currentStatus || currentStatus === 'stopped' || currentStatus === 'waiting') {
                const now = Date.now();
                tmuxSessionStatus.set(sessionName, {
                  status: 'running',
                  lastEvent: 'UserInput',
                  lastActivity: now,
                  lastStatusChange: now,
                  project,
                });
                console.log(`[Status] Updated '${sessionName}' to 'running' (user input from ${currentStatus || 'unknown'})`);
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
            terminal.captureHistory(msg.lines || 10000).then((history) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'history',
                  data: history,
                  lines: history.split('\n').length
                }));
              }
            });
            break;
        }
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected, tmux session '${sessionName}' preserved`);
      // Detach from tmux instead of killing - session stays alive
      terminal.detach();

      // Remove from active connections
      const connections = activeConnections.get(sessionName);
      if (connections) {
        connections.delete(ws);
        console.log(`[Connections] Removed connection from '${sessionName}' (remaining: ${connections.size})`);
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
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => entry.name)
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

  // Receive status updates from Claude Code hooks
  app.post('/api/hooks/status', (req, res) => {
    const { event, session_id, tmux_session, project, notification_type, stop_reason, tool_name, timestamp } = req.body;

    if (!event) {
      return res.status(400).json({ error: 'Missing event' });
    }

    // Key for tracking pending tools (prefer tmux_session, fallback to session_id)
    const trackingKey = tmux_session || session_id || project;

    let status: HookStatus['status'] = 'running';

    switch (event) {
      case 'SessionStart':
        status = 'running';
        break;
      case 'PreToolUse':
        // Tool starting - still running (most tools are auto-approved)
        status = 'running';
        if (trackingKey) {
          pendingTools.set(trackingKey, { toolName: tool_name, timestamp: timestamp || Date.now() });
        }
        break;
      case 'PostToolUse':
        // Tool completed - still running
        status = 'running';
        if (trackingKey) {
          pendingTools.delete(trackingKey);
        }
        break;
      case 'PermissionRequest':
        // Claude is waiting for user to approve a tool
        status = 'permission';
        break;
      case 'Stop':
        status = 'stopped'; // Claude finished, waiting for next prompt
        if (trackingKey) {
          pendingTools.delete(trackingKey);
        }
        break;
      case 'Notification':
        if (notification_type === 'idle_prompt') {
          status = 'waiting'; // Claude explicitly waiting for user input
        }
        break;
      case 'SessionEnd':
        status = 'ended';
        if (trackingKey) {
          pendingTools.delete(trackingKey);
        }
        break;
    }

    const now = Date.now();

    // Helper to create hookData with proper lastStatusChange tracking
    const createHookData = (existingData: HookStatus | undefined): HookStatus => {
      const statusChanged = !existingData || existingData.status !== status;
      return {
        status,
        lastEvent: event,
        lastActivity: timestamp || now,
        lastStatusChange: statusChanged ? now : existingData.lastStatusChange,
        project,
        toolName: tool_name,
        stopReason: stop_reason,
      };
    };

    // Priority 1: Store by tmux session name (REQUIRED for per-session status)
    if (tmux_session) {
      const existing = tmuxSessionStatus.get(tmux_session);
      tmuxSessionStatus.set(tmux_session, createHookData(existing));
    } else {
      // Warning: tmux_session is required for proper per-session status tracking
      console.warn(`[Hook] WARNING: Missing tmux_session for ${event} (session_id=${session_id}, project=${project})`);
    }

    // Priority 2: Store by Claude session_id (backup for debugging)
    if (session_id) {
      const existing = claudeSessionStatus.get(session_id);
      claudeSessionStatus.set(session_id, createHookData(existing));
    }

    // NOTE: Removed projectHookStatus storage - it caused status sharing between sessions
    // in the same project. Per-session tracking via tmux_session is now required.

    const identifier = tmux_session || session_id || project;
    console.log(`[Hook] ${identifier}: ${event} → ${status}${tool_name ? ` (${tool_name})` : ''}${!tmux_session ? ' (NO TMUX SESSION!)' : ''}`);
    res.json({ received: true });
  });

  // Enhanced sessions endpoint with detailed info
  // Combines Claude Code hooks (reliable) with tmux heuristics (instant fallback)
  app.get('/api/sessions', async (_req, res) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    interface SessionInfo {
      name: string;
      project: string;
      createdAt: number;
      status: 'running' | 'waiting' | 'stopped' | 'ended' | 'idle' | 'permission';
      statusSource: 'hook' | 'tmux';
      lastActivity?: string;
      lastEvent?: string;
      lastStatusChange?: number;
    }

    try {
      // Get session list with creation time
      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}|#{session_created}" 2>/dev/null'
      );

      const sessions: SessionInfo[] = [];
      const now = Date.now();
      const HOOK_TTL = 2 * 60 * 1000; // Hook data valid for 2 minutes

      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const [name, created] = line.split('|');
        // Extract project from session name (format: project--timestamp)
        const [project] = name.split('--');

        let status: SessionInfo['status'] = 'idle';
        let statusSource: SessionInfo['statusSource'] = 'tmux';
        let lastActivity = '';
        let lastEvent: string | undefined;
        let lastStatusChange: number | undefined;

        // 1. First check hook status (per-session, most reliable)
        // Only use tmuxSessionStatus - no project fallback to avoid status sharing
        const hookData = tmuxSessionStatus.get(name);

        if (hookData && (now - hookData.lastActivity < HOOK_TTL)) {
          // Hook data is fresh, use it
          status = hookData.status;
          statusSource = 'hook';
          lastEvent = hookData.lastEvent;
          lastStatusChange = hookData.lastStatusChange;
        } else {
          // 2. Fallback to tmux heuristics
          try {
            const { stdout: paneContent } = await execAsync(
              `tmux capture-pane -t "${name}" -p -S -3 2>/dev/null`
            );
            lastActivity = paneContent.trim().split('\n').pop() || '';

            // Heuristic: check for common prompts to determine status
            if (lastActivity.match(/[$>%#]\s*$/) || lastActivity.includes('Claude >') || lastActivity.includes('? ')) {
              status = 'waiting';
            } else if (lastActivity.length > 0) {
              status = 'running';
            }
          } catch {
            // Session exists but pane capture failed
          }
        }

        sessions.push({
          name,
          project,  // Project is already extracted from session name
          createdAt: parseInt(created) * 1000,
          status,
          statusSource,
          lastActivity: lastActivity.slice(-80),
          lastEvent,
          lastStatusChange,
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
      const lines = allLines.slice(-16, -1).filter(line => line.trim() !== '' || allLines.indexOf(line) > allLines.length - 5);

      res.json({
        lines: lines.length > 0 ? lines : ['(empty terminal)'],
        timestamp: Date.now()
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
      res.json({ success: true, message: `Session ${sessionName} killed` });
    } catch {
      res.status(404).json({ error: 'Session not found or already killed' });
    }
  });

  // ========== Editor API Endpoints ==========

  // Helper to check if project is allowed (whitelist empty = allow any)
  const isProjectAllowed = (project: string): boolean => {
    const hasWhitelist = config.projects.whitelist && config.projects.whitelist.length > 0;
    return hasWhitelist ? config.projects.whitelist.includes(project) : true;
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
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}
