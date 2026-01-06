import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';
import { createTerminal } from './terminal.js';
import config from '../config.json' with { type: 'json' };
import type { WSMessageToAgent } from '@claude-remote/shared';

// Store session status from Claude Code hooks (more reliable than tmux heuristics)
interface HookStatus {
  status: 'running' | 'waiting' | 'stopped' | 'ended' | 'permission';
  lastEvent: string;
  lastActivity: number;
  project?: string;
  toolName?: string;
  stopReason?: string;
}

// Store by tmux session name (most reliable), Claude session_id (fallback), and project (last resort)
const tmuxSessionStatus = new Map<string, HookStatus>();
const claudeSessionStatus = new Map<string, HookStatus>();
const projectHookStatus = new Map<string, HookStatus>();

// Track pending tool executions to detect permission waiting
const pendingTools = new Map<string, { toolName: string; timestamp: number }>();

// Generate human-readable session names
function generateSessionName(): string {
  const adjectives = ['brave', 'swift', 'calm', 'bold', 'wise', 'keen', 'fair', 'wild', 'bright', 'cool'];
  const nouns = ['lion', 'hawk', 'wolf', 'bear', 'fox', 'owl', 'deer', 'lynx', 'eagle', 'tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}-${noun}-${num}`;
}

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const server = createHttpServer(app);
  const wss = new WebSocketServer({ server, path: '/terminal' });

  // WebSocket terminal handler
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const project = url.searchParams.get('project');
    const sessionName = url.searchParams.get('session') || generateSessionName();

    // Validate project whitelist
    if (!project || !config.projects.whitelist.includes(project)) {
      ws.close(1008, 'Project not whitelisted');
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
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  // REST API endpoints
  app.get('/api/projects', (_req, res) => {
    res.json(config.projects.whitelist);
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

    const hookData: HookStatus = {
      status,
      lastEvent: event,
      lastActivity: timestamp || Date.now(),
      project,
      toolName: tool_name,
      stopReason: stop_reason,
    };

    // Priority 1: Store by tmux session name (most reliable for matching)
    if (tmux_session) {
      tmuxSessionStatus.set(tmux_session, hookData);
    }

    // Priority 2: Store by Claude session_id (backup)
    if (session_id) {
      claudeSessionStatus.set(session_id, hookData);
    }

    // Priority 3: Store by project name (last resort, can cause conflicts with multiple sessions)
    if (project) {
      projectHookStatus.set(project, hookData);
    }

    const identifier = tmux_session || project || session_id;
    console.log(`[Hook] ${identifier}: ${event} → ${status}${tool_name ? ` (${tool_name})` : ''}`);
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

        // 1. First check hook status (more reliable)
        // Priority: tmux session name (exact match) > project name (can conflict)
        const hookData = tmuxSessionStatus.get(name) || projectHookStatus.get(project);
        if (hookData && (now - hookData.lastActivity < HOOK_TTL)) {
          // Hook data is fresh, use it
          status = hookData.status;
          statusSource = 'hook';
          lastEvent = hookData.lastEvent;
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
          project: config.projects.whitelist.includes(project) ? project : name,
          createdAt: parseInt(created) * 1000,
          status,
          statusSource,
          lastActivity: lastActivity.slice(-80),
          lastEvent,
        });
      }

      res.json(sessions);
    } catch {
      res.json([]);
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

  return server;
}
