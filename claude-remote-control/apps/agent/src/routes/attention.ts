/**
 * Attention API route: receives attention notifications from Claude Code hooks.
 * Simplified replacement for the notification/heartbeat system.
 * Forwards attention events to Next.js dashboard webhook.
 */

import { Router, type Router as RouterType } from 'express';
import path from 'path';
import { execSync } from 'child_process';
import * as sessionsDb from '../db/sessions.js';
import { config } from '../config.js';
import type { AttentionReason } from '247-shared';

const router: RouterType = Router();

// Dashboard webhook configuration
const DASHBOARD_WEBHOOK_URL = process.env.DASHBOARD_WEBHOOK_URL;
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY;

/**
 * Check if a tmux session exists.
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
 * Notification types from Claude Code
 */
type NotificationType = 'permission_prompt' | 'idle_prompt' | 'elicitation_dialog' | 'auth_success';

/**
 * Attention hook payload from Claude Code
 */
interface AttentionPayload {
  tmux_session: string;
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  permission_mode?: string;
  hook_event_name?: string;
  notification_type?: NotificationType;
  message?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

/**
 * Determine attention reason from payload.
 */
function getAttentionReason(payload: AttentionPayload): AttentionReason {
  if (payload.permission_mode === 'plan') {
    return 'plan_approval';
  }

  switch (payload.notification_type) {
    case 'permission_prompt':
      return 'permission';
    case 'idle_prompt':
      return 'input';
    case 'elicitation_dialog':
      return 'permission';
    case 'auth_success':
      return 'input';
    default:
      if (payload.tool_name) {
        return 'permission';
      }
      return 'input';
  }
}

/**
 * Forward attention event to dashboard webhook
 */
async function forwardToWebhook(
  sessionName: string,
  project: string,
  reason: AttentionReason
): Promise<void> {
  if (!DASHBOARD_WEBHOOK_URL || !DASHBOARD_API_KEY) {
    console.log('[Attention] Dashboard webhook not configured, skipping forward');
    return;
  }

  try {
    const response = await fetch(DASHBOARD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DASHBOARD_API_KEY,
      },
      body: JSON.stringify({
        sessionName,
        project,
        reason,
        machineId: config.machine.id,
        machineName: config.machine.name,
      }),
    });

    if (!response.ok) {
      console.error(`[Attention] Webhook failed: ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Attention] Forwarded to webhook: ${sessionName} (${reason})`);
    }
  } catch (error) {
    console.error('[Attention] Failed to forward to webhook:', error);
  }
}

/**
 * Receive attention notification from Claude Code hook.
 * Persists to database and forwards to dashboard webhook.
 */
router.post('/', async (req, res) => {
  const payload: AttentionPayload = req.body;
  const { tmux_session } = payload;

  if (!tmux_session) {
    return res.status(400).json({ error: 'Missing tmux_session' });
  }

  // Validate that the tmux session actually exists
  if (!tmuxSessionExists(tmux_session)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const now = Date.now();

  // Extract project from cwd or session name
  const project = payload.cwd
    ? path.basename(payload.cwd)
    : tmux_session.split('--')[0] || 'unknown';

  const attentionReason = getAttentionReason(payload);

  // Persist to database
  sessionsDb.upsertSession(tmux_session, {
    project,
    status: 'needs_attention',
    attentionReason,
    lastActivity: now,
    lastStatusChange: now,
  });

  console.log(`[Attention] ${tmux_session}: needs_attention (${attentionReason})`);

  // Forward to dashboard webhook (async, don't wait)
  forwardToWebhook(tmux_session, project, attentionReason).catch(() => {
    // Error already logged in forwardToWebhook
  });

  res.json({ ok: true });
});

export function createAttentionRoutes(): RouterType {
  return router;
}

export default router;
