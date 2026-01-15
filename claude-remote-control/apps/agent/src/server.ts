/**
 * Main server entry point - Express HTTP server with WebSocket support.
 * Routes and handlers are split into separate modules for maintainability.
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer as createHttpServer } from 'http';
import { initDatabase, closeDatabase, migrateEnvironmentsFromJson } from './db/index.js';
import { ensureDefaultEnvironment } from './db/environments.js';
import * as sessionsDb from './db/sessions.js';

// Routes
import {
  createProjectRoutes,
  createEnvironmentRoutes,
  createSessionRoutes,
  createHeartbeatRoutes,
  createNotificationRoutes,
  createStopRoutes,
} from './routes/index.js';
import { createPushRoutes } from './routes/push.js';
import { createWebhookRoutes } from './routes/webhooks.js';
import { initWebPush } from './push/vapid.js';

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

  // Configure statusLine for Claude Code integration
  ensureStatusLineConfigured();

  // Initialize Web Push for notifications
  initWebPush();

  // Start heartbeat timeout monitor
  startHeartbeatMonitor();

  // Health check endpoint for container orchestration
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Mount API routes
  app.use('/api', createProjectRoutes());
  app.use('/api/environments', createEnvironmentRoutes());
  app.use('/api/sessions', createSessionRoutes());
  app.use('/api/heartbeat', createHeartbeatRoutes());
  app.use('/api/notification', createNotificationRoutes());
  app.use('/api/stop', createStopRoutes());
  app.use('/api/push', createPushRoutes());
  app.use('/api/webhooks', createWebhookRoutes());

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

    socket.destroy();
  });

  // Periodic cleanup
  setInterval(cleanupStatusMaps, 60 * 60 * 1000);

  // Graceful shutdown
  const shutdown = () => {
    console.log('[Server] Shutting down...');
    stopHeartbeatMonitor();
    closeDatabase();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}
