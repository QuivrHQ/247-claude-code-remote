/**
 * Webhook database operations.
 * Stores webhook configurations for external notifications (Telegram, Slack, Discord, etc.)
 */

import { getDatabase } from './index.js';
import type { DbWebhook, WebhookEvent, UpsertWebhookInput } from './schema.js';

/**
 * Generate a unique webhook ID
 */
function generateWebhookId(): string {
  return `wh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create or update a webhook.
 */
export function upsertWebhook(input: UpsertWebhookInput): DbWebhook {
  const db = getDatabase();
  const now = Date.now();
  const id = input.id || generateWebhookId();

  const stmt = db.prepare(`
    INSERT INTO webhooks (id, name, url, type, enabled, events, secret, created_at, updated_at)
    VALUES (@id, @name, @url, @type, @enabled, @events, @secret, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      url = @url,
      type = @type,
      enabled = @enabled,
      events = @events,
      secret = @secret,
      updated_at = @updatedAt
  `);

  stmt.run({
    id,
    name: input.name,
    url: input.url,
    type: input.type,
    enabled: input.enabled !== false ? 1 : 0,
    events: JSON.stringify(input.events),
    secret: input.secret ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return getWebhook(id)!;
}

/**
 * Get a webhook by ID.
 */
export function getWebhook(id: string): DbWebhook | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as DbWebhook | undefined;
  return row ?? null;
}

/**
 * Get all webhooks.
 */
export function getAllWebhooks(): DbWebhook[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all() as DbWebhook[];
}

/**
 * Get enabled webhooks that listen to a specific event.
 */
export function getWebhooksForEvent(event: WebhookEvent): DbWebhook[] {
  const db = getDatabase();
  const webhooks = db.prepare('SELECT * FROM webhooks WHERE enabled = 1').all() as DbWebhook[];

  // Filter by event (events is stored as JSON array)
  return webhooks.filter((wh) => {
    try {
      const events = JSON.parse(wh.events) as WebhookEvent[];
      return events.includes(event);
    } catch {
      return false;
    }
  });
}

/**
 * Delete a webhook.
 */
export function deleteWebhook(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Toggle webhook enabled status.
 */
export function toggleWebhook(id: string, enabled: boolean): boolean {
  const db = getDatabase();
  const result = db
    .prepare('UPDATE webhooks SET enabled = ?, updated_at = ? WHERE id = ?')
    .run(enabled ? 1 : 0, Date.now(), id);
  return result.changes > 0;
}

/**
 * Get webhook count.
 */
export function getWebhookCount(): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM webhooks').get() as { count: number };
  return result.count;
}

/**
 * Get enabled webhook count.
 */
export function getEnabledWebhookCount(): number {
  const db = getDatabase();
  const result = db.prepare('SELECT COUNT(*) as count FROM webhooks WHERE enabled = 1').get() as {
    count: number;
  };
  return result.count;
}

/**
 * Parse stored events JSON to typed array.
 */
export function parseWebhookEvents(webhook: DbWebhook): WebhookEvent[] {
  try {
    return JSON.parse(webhook.events) as WebhookEvent[];
  } catch {
    return [];
  }
}

/**
 * Convert DbWebhook to a safe format for API response (hide secret).
 */
export function toApiWebhook(
  webhook: DbWebhook
): Omit<DbWebhook, 'secret'> & { hasSecret: boolean } {
  const { secret, ...rest } = webhook;
  return {
    ...rest,
    hasSecret: !!secret,
  };
}
