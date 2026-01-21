/**
 * Hook API routes for Claude Code / Codex hook notifications.
 * Receives status updates from hook scripts and broadcasts to WebSocket subscribers.
 */

import { Router } from 'express';
import type {
  AttentionNotification,
  SessionStatus,
  AttentionReason,
  StatusSource,
} from '247-shared';
import * as sessionsDb from '../db/sessions.js';
import { broadcastStatusUpdate } from '../websocket-handlers.js';
import { loadConfig } from '../config.js';

const WEB_PUSH_URL = 'https://247.quivr.com/api/push/notify';

/**
 * Send push notification to web API
 */
async function sendPushNotification(sessionName: string): Promise<void> {
  try {
    const config = loadConfig();
    const machineId = config.machine.id;

    if (!machineId) {
      console.log('[Hooks] No machineId configured, skipping push');
      return;
    }

    const response = await fetch(WEB_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId, sessionName }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Hooks] Push notification failed: ${response.status} ${error}`);
      return;
    }

    const result = await response.json();
    console.log(`[Hooks] Push notification: ${result.sent} sent`);
  } catch (_err) {
    // Don't log full error to avoid noise - push is best effort
    console.log('[Hooks] Push notification skipped (web unreachable)');
  }
}

/**
 * Validate that a value is a valid SessionStatus
 */
function isValidStatus(value: unknown): value is SessionStatus {
  return value === 'init' || value === 'working' || value === 'needs_attention' || value === 'idle';
}

/**
 * Validate that a value is a valid AttentionReason (now accepts any string for pass-through)
 */
function isValidAttentionReason(value: unknown): value is AttentionReason {
  // Accept any string, null, or undefined (pass-through from Claude Code notification_type)
  return typeof value === 'string' || value === null || value === undefined;
}

/**
 * Validate that a value is a valid StatusSource
 */
function isValidStatusSource(value: unknown): value is StatusSource {
  return value === 'hook' || value === 'tmux';
}

export function createHooksRoutes(): Router {
  const router = Router();

  /**
   * POST /api/hooks/status
   * Receives status updates from Claude Code / Codex hooks (notify-247.sh)
   *
   * Body: AttentionNotification
   * - sessionId: string (tmux session name, e.g., "project--abc123")
   * - status: SessionStatus
   * - attentionReason?: AttentionReason
   * - source: StatusSource
   * - timestamp: number
   * - eventType: string
   */
  router.post('/status', async (req, res) => {
    try {
      const notification = req.body as AttentionNotification;

      // Validate required fields
      if (!notification.sessionId || typeof notification.sessionId !== 'string') {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      if (!isValidStatus(notification.status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      if (!isValidAttentionReason(notification.attentionReason)) {
        return res.status(400).json({ error: 'Invalid attentionReason value' });
      }

      if (!isValidStatusSource(notification.source)) {
        return res.status(400).json({ error: 'Invalid source value' });
      }

      const sessionName = notification.sessionId;
      const now = Date.now();

      console.log(
        `[Hooks] Received status update: session=${sessionName} status=${notification.status} reason=${notification.attentionReason} event=${notification.eventType}`
      );

      // Check if session exists in DB
      let session = sessionsDb.getSession(sessionName);

      if (!session) {
        // Session doesn't exist in DB yet - create it
        // Extract project from session name (format: project--timestamp)
        const [project] = sessionName.split('--');
        session = sessionsDb.upsertSession(sessionName, {
          project,
          status: notification.status,
          statusSource: notification.source,
          attentionReason: notification.attentionReason,
          lastEvent: notification.eventType,
          lastActivity: now,
        });
        console.log(`[Hooks] Created new session from hook: ${sessionName}`);
      } else {
        // Update existing session
        session = sessionsDb.upsertSession(sessionName, {
          status: notification.status,
          statusSource: notification.source,
          attentionReason: notification.attentionReason,
          lastEvent: notification.eventType,
          lastActivity: now,
        });
      }

      // Broadcast status update to WebSocket subscribers
      broadcastStatusUpdate({
        name: session.name,
        project: session.project,
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        lastEvent: session.last_event ?? undefined,
        archivedAt: session.archived_at ?? undefined,
        status: session.status ?? undefined,
        statusSource: session.status_source ?? undefined,
        attentionReason: session.attention_reason ?? undefined,
        lastStatusChange: session.last_status_change ?? undefined,
      });

      // Send push notification if needs_attention
      if (notification.status === 'needs_attention') {
        // Fire and forget - don't block the response
        sendPushNotification(sessionName).catch(() => {});
      }

      res.json({
        success: true,
        sessionName,
        status: notification.status,
        attentionReason: notification.attentionReason,
      });
    } catch (err) {
      console.error('[Hooks] Error processing status update:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
