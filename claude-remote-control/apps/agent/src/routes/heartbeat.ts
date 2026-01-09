/**
 * Heartbeat API route: receives statusLine updates from Claude Code.
 * Replaces the old hooks system with a simpler heartbeat-based approach.
 */

import { Router, type Router as RouterType } from 'express';
import path from 'path';
import { execSync } from 'child_process';
import { tmuxSessionStatus, broadcastStatusUpdate, type HookStatus } from '../status.js';
import * as sessionsDb from '../db/sessions.js';
import { getEnvironmentMetadata, getSessionEnvironment } from '../db/environments.js';

const router: RouterType = Router();

// Track last heartbeat per session for timeout detection
export const lastHeartbeat = new Map<string, number>();

/**
 * Check if a tmux session exists.
 * Prevents ghost sessions from being created by stale heartbeats.
 */
function tmuxSessionExists(sessionName: string): boolean {
  try {
    execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * StatusLine payload from Claude Code
 * Sent every ~300ms while Claude is actively working
 */
interface StatusLinePayload {
  tmux_session: string;
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  model?: {
    id: string;
    display_name: string;
  };
  cost?: {
    total_cost_usd: number;
    total_duration_ms: number;
    total_lines_added: number;
    total_lines_removed: number;
  };
  context_window?: {
    context_window_size: number;
    current_usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens: number;
    };
  };
}

/**
 * Receive heartbeat from Claude Code statusLine.
 * Any heartbeat means Claude is actively working.
 */
router.post('/', (req, res) => {
  const payload: StatusLinePayload = req.body;
  const { tmux_session } = payload;

  if (!tmux_session) {
    return res.status(400).json({ error: 'Missing tmux_session' });
  }

  // Validate that the tmux session actually exists (prevents ghost sessions)
  if (!tmuxSessionExists(tmux_session)) {
    // Silently ignore heartbeats for non-existent sessions
    // This can happen when a session is killed but Claude Code is still running briefly
    return res.status(404).json({ error: 'Session not found' });
  }

  const now = Date.now();
  lastHeartbeat.set(tmux_session, now);

  // Extract project from cwd or session name
  const project = payload.cwd
    ? path.basename(payload.cwd)
    : tmux_session.split('--')[0] || undefined;

  const existing = tmuxSessionStatus.get(tmux_session);
  const statusChanged = !existing || existing.status !== 'working';

  // Calculate context usage percentage
  let contextUsage: number | undefined;
  if (payload.context_window?.current_usage && payload.context_window?.context_window_size) {
    const { input_tokens, cache_read_input_tokens } = payload.context_window.current_usage;
    const totalUsed = input_tokens + cache_read_input_tokens;
    contextUsage = Math.round((totalUsed / payload.context_window.context_window_size) * 100);
  }

  const hookData: HookStatus = {
    status: 'working',
    hasBeenWorking: true, // Mark session as having worked - prevents idle regression
    lastEvent: 'Heartbeat',
    lastActivity: now,
    lastStatusChange: statusChanged ? now : existing?.lastStatusChange || now,
    project,
    transcriptPath: payload.transcript_path,
    model: payload.model?.display_name,
    costUsd: payload.cost?.total_cost_usd,
    contextUsage,
    linesAdded: payload.cost?.total_lines_added,
    linesRemoved: payload.cost?.total_lines_removed,
  };

  tmuxSessionStatus.set(tmux_session, hookData);

  // Persist to database (including metrics)
  const dbSession = sessionsDb.upsertSession(tmux_session, {
    project: project || tmux_session.split('--')[0] || '',
    status: 'working',
    lastEvent: 'Heartbeat',
    lastActivity: now,
    lastStatusChange: statusChanged ? now : (existing?.lastStatusChange ?? now),
    // StatusLine metrics
    model: hookData.model,
    costUsd: hookData.costUsd,
    contextUsage,
    linesAdded: hookData.linesAdded,
    linesRemoved: hookData.linesRemoved,
  });

  // Broadcast status change to dashboard
  if (statusChanged) {
    const envId = getSessionEnvironment(tmux_session);
    const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

    broadcastStatusUpdate({
      name: tmux_session,
      project: project || '',
      status: 'working',
      statusSource: 'hook',
      lastEvent: 'Heartbeat',
      lastStatusChange: hookData.lastStatusChange,
      createdAt: dbSession?.created_at || now,
      lastActivity: now,
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
      model: hookData.model,
      costUsd: hookData.costUsd,
      contextUsage,
      linesAdded: hookData.linesAdded,
      linesRemoved: hookData.linesRemoved,
    });

    console.log(`[Heartbeat] ${tmux_session}: → working`);
  }

  res.json({ ok: true });
});

export function createHeartbeatRoutes(): Router {
  return router;
}

export default router;
