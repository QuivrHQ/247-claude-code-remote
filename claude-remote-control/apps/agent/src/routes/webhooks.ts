/**
 * Webhook notification routes.
 * Manages webhook configurations for external notifications.
 */

import { Router } from 'express';
import * as webhooksDb from '../db/webhooks.js';
import { sendTestWebhook } from '../push/webhook-sender.js';
import type { UpsertWebhookInput, WebhookType, WebhookEvent } from '../db/schema.js';

const VALID_TYPES: WebhookType[] = ['telegram', 'slack', 'discord', 'generic'];
const VALID_EVENTS: WebhookEvent[] = [
  'needs_attention',
  'task_complete',
  'session_start',
  'session_end',
];

export function createWebhookRoutes(): Router {
  const router = Router();

  /**
   * GET /api/webhooks
   * List all webhooks (secrets are hidden).
   */
  router.get('/', (_req, res) => {
    try {
      const webhooks = webhooksDb.getAllWebhooks();
      res.json({
        webhooks: webhooks.map(webhooksDb.toApiWebhook),
        count: webhooks.length,
        enabledCount: webhooksDb.getEnabledWebhookCount(),
      });
    } catch (err) {
      console.error('[Webhooks] Failed to list webhooks:', err);
      res.status(500).json({ error: 'Failed to list webhooks' });
    }
  });

  /**
   * GET /api/webhooks/:id
   * Get a specific webhook.
   */
  router.get('/:id', (req, res) => {
    try {
      const webhook = webhooksDb.getWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      res.json(webhooksDb.toApiWebhook(webhook));
    } catch (err) {
      console.error('[Webhooks] Failed to get webhook:', err);
      res.status(500).json({ error: 'Failed to get webhook' });
    }
  });

  /**
   * POST /api/webhooks
   * Create a new webhook.
   */
  router.post('/', (req, res) => {
    try {
      const body = req.body as Partial<UpsertWebhookInput>;

      // Validate required fields
      if (!body.name || typeof body.name !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid name' });
      }
      if (!body.url || typeof body.url !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid url' });
      }
      if (!body.type || !VALID_TYPES.includes(body.type)) {
        return res
          .status(400)
          .json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
      }
      if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
        return res.status(400).json({ error: 'Events must be a non-empty array' });
      }
      if (!body.events.every((e) => VALID_EVENTS.includes(e))) {
        return res
          .status(400)
          .json({ error: `Invalid events. Must be one of: ${VALID_EVENTS.join(', ')}` });
      }

      // Validate URL format
      try {
        new URL(body.url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      const webhook = webhooksDb.upsertWebhook({
        name: body.name,
        url: body.url,
        type: body.type,
        enabled: body.enabled !== false,
        events: body.events,
        secret: body.secret,
      });

      console.log(`[Webhooks] Created webhook: ${webhook.name} (${webhook.id})`);
      res.status(201).json(webhooksDb.toApiWebhook(webhook));
    } catch (err) {
      console.error('[Webhooks] Failed to create webhook:', err);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  });

  /**
   * PUT /api/webhooks/:id
   * Update an existing webhook.
   */
  router.put('/:id', (req, res) => {
    try {
      const existing = webhooksDb.getWebhook(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      const body = req.body as Partial<UpsertWebhookInput>;

      // Validate fields if provided
      if (body.type && !VALID_TYPES.includes(body.type)) {
        return res
          .status(400)
          .json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
      }
      if (
        body.events &&
        (!Array.isArray(body.events) || !body.events.every((e) => VALID_EVENTS.includes(e)))
      ) {
        return res
          .status(400)
          .json({ error: `Invalid events. Must be one of: ${VALID_EVENTS.join(', ')}` });
      }
      if (body.url) {
        try {
          new URL(body.url);
        } catch {
          return res.status(400).json({ error: 'Invalid URL format' });
        }
      }

      const webhook = webhooksDb.upsertWebhook({
        id: req.params.id,
        name: body.name || existing.name,
        url: body.url || existing.url,
        type: body.type || (existing.type as WebhookType),
        enabled: body.enabled ?? existing.enabled === 1,
        events: body.events || webhooksDb.parseWebhookEvents(existing),
        secret: body.secret !== undefined ? body.secret : existing.secret,
      });

      console.log(`[Webhooks] Updated webhook: ${webhook.name} (${webhook.id})`);
      res.json(webhooksDb.toApiWebhook(webhook));
    } catch (err) {
      console.error('[Webhooks] Failed to update webhook:', err);
      res.status(500).json({ error: 'Failed to update webhook' });
    }
  });

  /**
   * DELETE /api/webhooks/:id
   * Delete a webhook.
   */
  router.delete('/:id', (req, res) => {
    try {
      const deleted = webhooksDb.deleteWebhook(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Webhook not found' });
      }
      console.log(`[Webhooks] Deleted webhook: ${req.params.id}`);
      res.json({ success: true, deleted: true });
    } catch (err) {
      console.error('[Webhooks] Failed to delete webhook:', err);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  });

  /**
   * POST /api/webhooks/:id/toggle
   * Enable or disable a webhook.
   */
  router.post('/:id/toggle', (req, res) => {
    try {
      const webhook = webhooksDb.getWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      const { enabled } = req.body as { enabled?: boolean };
      const newState = enabled !== undefined ? enabled : webhook.enabled === 0;

      webhooksDb.toggleWebhook(req.params.id, newState);
      console.log(`[Webhooks] Toggled webhook ${req.params.id}: enabled=${newState}`);

      const updated = webhooksDb.getWebhook(req.params.id)!;
      res.json(webhooksDb.toApiWebhook(updated));
    } catch (err) {
      console.error('[Webhooks] Failed to toggle webhook:', err);
      res.status(500).json({ error: 'Failed to toggle webhook' });
    }
  });

  /**
   * POST /api/webhooks/:id/test
   * Send a test notification to a webhook.
   */
  router.post('/:id/test', async (req, res) => {
    try {
      const webhook = webhooksDb.getWebhook(req.params.id);
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      const result = await sendTestWebhook(req.params.id);

      if (result.success) {
        console.log(`[Webhooks] Test notification sent to ${webhook.name}`);
        res.json({ success: true, message: 'Test notification sent' });
      } else {
        console.error(`[Webhooks] Test notification failed for ${webhook.name}: ${result.error}`);
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (err) {
      console.error('[Webhooks] Failed to send test notification:', err);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });

  /**
   * GET /api/webhooks/status
   * Get webhook system status.
   */
  router.get('/status', (_req, res) => {
    res.json({
      enabled: true,
      webhookCount: webhooksDb.getWebhookCount(),
      enabledCount: webhooksDb.getEnabledWebhookCount(),
      supportedTypes: VALID_TYPES,
      supportedEvents: VALID_EVENTS,
    });
  });

  return router;
}
