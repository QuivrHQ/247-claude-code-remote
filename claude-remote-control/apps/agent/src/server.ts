/**
 * Main server entry point - Express HTTP server with WebSocket support.
 * Routes and handlers are split into separate modules for maintainability.
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer as createHttpServer } from 'http';
import httpProxy from 'http-proxy';
import { initEditor, shutdownAllEditors } from './editor.js';
import { initDatabase, closeDatabase, migrateEnvironmentsFromJson } from './db/index.js';
import { ensureDefaultEnvironment } from './db/environments.js';
import * as sessionsDb from './db/sessions.js';
import { config } from './config.js';
import type { AgentConfig } from '247-shared';

// Routes
import {
  createProjectRoutes,
  createEnvironmentRoutes,
  createSessionRoutes,
  createHeartbeatRoutes,
  createNotificationRoutes,
  createStopRoutes,
  createEditorRoutes,
  createFilesRoutes,
  createTaskRoutes,
  isProjectAllowed,
  updateEditorActivity,
  getOrStartEditor,
} from './routes/index.js';

// Task queue executor
import { startTaskQueueExecutor, stopTaskQueueExecutor } from './services/task-queue.js';

// StatusLine setup and heartbeat monitor
import { ensureStatusLineConfigured } from './setup-statusline.js';
import { startHeartbeatMonitor, stopHeartbeatMonitor } from './heartbeat-monitor.js';

// Status and WebSocket
import { tmuxSessionStatus, cleanupStatusMaps, getActiveTmuxSessions } from './status.js';
import { handleTerminalConnection, handleStatusConnection } from './websocket-handlers.js';

export async function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = createHttpServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Initialize editor manager
  const typedConfig = config as unknown as AgentConfig;
  await initEditor(typedConfig.editor, config.projects.basePath);

  // Initialize SQLite database
  const db = initDatabase();
  migrateEnvironmentsFromJson(db);
  ensureDefaultEnvironment();

  // Reconcile sessions with active tmux sessions
  const activeTmuxSessions = getActiveTmuxSessions();
  sessionsDb.reconcileWithTmux(activeTmuxSessions);

  // Populate in-memory Map from database
  const dbSessions = sessionsDb.getAllSessions();
  for (const session of dbSessions) {
    tmuxSessionStatus.set(session.name, sessionsDb.toHookStatus(session));
  }
  console.log(`[DB] Loaded ${dbSessions.length} sessions from database`);

  // Create proxy for code-server
  const editorProxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true });

  editorProxy.on('error', (err, _req, res) => {
    console.error('[Editor Proxy] HTTP Error:', err.message);
    if (res && 'writeHead' in res) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Editor proxy error', message: err.message }));
    }
  });

  // Configure statusLine for Claude Code integration
  ensureStatusLineConfigured();

  // Start heartbeat timeout monitor
  startHeartbeatMonitor();

  // Mount API routes
  app.use('/api', createProjectRoutes());
  app.use('/api/environments', createEnvironmentRoutes());
  app.use('/api/sessions', createSessionRoutes());
  app.use('/api/heartbeat', createHeartbeatRoutes());
  app.use('/api/notification', createNotificationRoutes());
  app.use('/api/stop', createStopRoutes());
  app.use('/api/editor', createEditorRoutes());
  app.use('/api/files', createFilesRoutes());
  app.use('/api/tasks', createTaskRoutes());

  // Start task queue executor
  startTaskQueueExecutor();

  // Editor proxy middleware
  app.use('/editor/:project', async (req, res) => {
    const { project } = req.params;

    if (!isProjectAllowed(project)) {
      return res.status(403).json({ error: 'Project not allowed' });
    }
    if (!typedConfig.editor?.enabled) {
      return res.status(400).json({ error: 'Editor is disabled in config' });
    }

    try {
      const editor = await getOrStartEditor(project);
      updateEditorActivity(project);
      req.url = req.url.replace(`/editor/${project}`, '') || '/';
      editorProxy.web(req, res, { target: `http://127.0.0.1:${editor.port}` });
    } catch (err) {
      console.error('[Editor Proxy] Failed:', err);
      res.status(502).json({ error: 'Failed to proxy to editor' });
    }
  });

  // Handle WebSocket upgrades
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    if (url.pathname === '/terminal') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleTerminalConnection(ws, url);
      });
      return;
    }

    if (url.pathname === '/status') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleStatusConnection(ws, url);
      });
      return;
    }

    if (url.pathname.startsWith('/editor/')) {
      const pathParts = url.pathname.split('/');
      const project = pathParts[2];

      if (!project || !isProjectAllowed(project) || !typedConfig.editor?.enabled) {
        socket.destroy();
        return;
      }

      try {
        const editor = await getOrStartEditor(project);
        updateEditorActivity(project);
        const rewrittenPath = url.pathname.replace(`/editor/${project}`, '') || '/';
        req.url = rewrittenPath + url.search;
        editorProxy.ws(req, socket, head, { target: `http://127.0.0.1:${editor.port}` });
      } catch (err) {
        console.error('[Editor WS] Failed:', err);
        socket.destroy();
      }
      return;
    }

    socket.destroy();
  });

  // Periodic cleanup
  setInterval(cleanupStatusMaps, 60 * 60 * 1000);

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Server] Shutting down...');
    stopHeartbeatMonitor();
    stopTaskQueueExecutor();
    shutdownAllEditors();
    closeDatabase();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}
