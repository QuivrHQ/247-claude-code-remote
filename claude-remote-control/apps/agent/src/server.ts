/**
 * Main server entry point - Express HTTP server with WebSocket support.
 * Routes and handlers are split into separate modules for maintainability.
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer as createHttpServer } from 'http';
import { initDatabase, closeDatabase } from './db/index.js';
import * as sessionsDb from './db/sessions.js';

// Routes
import {
  createProjectRoutes,
  createSessionRoutes,
  createAttentionRoutes,
  createPairRoutes,
} from './routes/index.js';

// Hook setup
import { ensureHooksConfigured } from './setup-hooks.js';

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
  initDatabase();

  // Reconcile sessions with active tmux sessions
  const activeTmuxSessions = getActiveTmuxSessions();
  sessionsDb.reconcileWithTmux(activeTmuxSessions);

  // Populate in-memory Map from database
  const dbSessions = sessionsDb.getAllSessions();
  for (const session of dbSessions) {
    tmuxSessionStatus.set(session.name, sessionsDb.toHookStatus(session));
  }
  console.log(`[DB] Loaded ${dbSessions.length} sessions from database`);

  // Configure attention hook for Claude Code integration
  ensureHooksConfigured();

  // Health check endpoint for container orchestration
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Mount API routes
  app.use('/api', createProjectRoutes());
  app.use('/api/sessions', createSessionRoutes());
  app.use('/api/attention', createAttentionRoutes());

  // Mount pairing routes (both at /pair and /api/pair for flexibility)
  app.use('/pair', createPairRoutes());
  app.use('/api/pair', createPairRoutes());

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
    closeDatabase();
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}
