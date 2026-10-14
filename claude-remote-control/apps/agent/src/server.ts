/**
 * Main server entry point - Express HTTP server with WebSocket support.
 * Routes and handlers are split into separate modules for maintainability.
 */

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer as createHttpServer } from 'http';
import { execSync } from 'child_process';
import { initDatabase, closeDatabase } from './db/index.js';
import * as sessionsDb from './db/sessions.js';
import { loadConfig } from './config.js';
import {
  resolveAuthToken,
  isAuthorized,
  extractBearerToken,
  extractWebSocketToken,
  WS_TOKEN_PROTOCOL_PREFIX,
} from './lib/auth.js';

// Routes
import {
  createProjectRoutes,
  createSessionRoutes,
  createPairRoutes,
  createHooksRoutes,
} from './routes/index.js';

// WebSocket
import { handleTerminalConnection, handleSessionsConnection } from './websocket-handlers.js';

// Utility to get active tmux sessions
function getActiveTmuxSessions(): Set<string> {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', {
      encoding: 'utf-8',
    });
    return new Set(
      output
        .trim()
        .split('\n')
        .filter((s: string) => s)
    );
  } catch {
    return new Set();
  }
}

export async function createServer() {
  // The shared secret that gates the shell surface. Delivered out of band:
  // `247 init` prints it and the user enters it into the dashboard, so it is
  // never served by a (publicly reachable) agent endpoint. When unset the agent
  // runs without authentication, which keeps pre-token installs working.
  const expectedToken = resolveAuthToken(
    loadConfig().agent?.authToken,
    process.env.AGENT_247_AUTH_TOKEN
  );
  if (!expectedToken) {
    console.warn(
      '[Server] No agent.authToken configured: running WITHOUT authentication. ' +
        'Anyone who can reach this agent can open a terminal. Run `247 init` to add a token.'
    );
  }

  // Health and pairing stay reachable without a token: health is for probes,
  // and pairing only conveys the agent's URL/identity (never the token).
  const isPublicPath = (path: string): boolean =>
    path === '/health' ||
    path === '/pair' ||
    path.startsWith('/pair/') ||
    path === '/api/pair' ||
    path.startsWith('/api/pair/');

  const app = express();
  app.use(cors());

  // Require the bearer token on everything except health, pairing and CORS
  // preflight (which carries no Authorization header). A no-op when auth is
  // disabled (expectedToken undefined).
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS' || isPublicPath(req.path)) {
      next();
      return;
    }
    if (!isAuthorized(extractBearerToken(req.headers.authorization), expectedToken)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  app.use(express.json());

  const server = createHttpServer(app);
  // Echo back the token-bearing subprotocol so the browser's WebSocket
  // handshake completes (a browser that offered a subprotocol expects the
  // server to confirm one).
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => {
      for (const protocol of protocols) {
        if (protocol.startsWith(WS_TOKEN_PROTOCOL_PREFIX)) {
          return protocol;
        }
      }
      return false;
    },
  });

  // Initialize SQLite database
  initDatabase();

  // Reconcile sessions with active tmux sessions
  const activeTmuxSessions = getActiveTmuxSessions();
  sessionsDb.reconcileWithTmux(activeTmuxSessions);

  // Load existing sessions
  const dbSessions = sessionsDb.getAllSessions();
  console.log(`[DB] Loaded ${dbSessions.length} sessions from database`);

  // Health check endpoint for container orchestration
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Mount API routes
  app.use('/api', createProjectRoutes());
  app.use('/api/sessions', createSessionRoutes());

  // Mount pairing routes (both at /pair and /api/pair for flexibility)
  app.use('/pair', createPairRoutes());
  app.use('/api/pair', createPairRoutes());

  // Mount hooks routes for Claude Code hook notifications
  app.use('/api/hooks', createHooksRoutes());

  // Handle WebSocket upgrades
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // Browsers cannot set an Authorization header on a WebSocket, so the token
    // travels as a `247.bearer.<token>` subprotocol.
    const wsToken = extractWebSocketToken(req.headers['sec-websocket-protocol']);
    if (!isAuthorized(wsToken, expectedToken)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    if (url.pathname === '/terminal') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleTerminalConnection(ws, url);
      });
      return;
    }

    if (url.pathname === '/sessions') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleSessionsConnection(ws, url);
      });
      return;
    }

    socket.destroy();
  });

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
