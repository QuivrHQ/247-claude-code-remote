/**
 * Webhook notification sender.
 * Sends notifications to external services (Telegram, Slack, Discord, generic).
 */

import crypto from 'crypto';
import type { WSSessionInfo, AttentionReason } from '247-shared';
import * as webhooksDb from '../db/webhooks.js';
import type { DbWebhook, WebhookType, WebhookEvent } from '../db/schema.js';

export interface WebhookPayload {
  event: WebhookEvent;
  session: {
    name: string;
    project: string;
    status: string;
    attentionReason?: AttentionReason;
    model?: string;
    costUsd?: number;
  };
  timestamp: number;
  message: string;
}

/**
 * Get notification message based on attention reason.
 */
function getNotificationMessage(reason: AttentionReason | undefined): {
  title: string;
  body: string;
} {
  switch (reason) {
    case 'permission':
      return {
        title: 'Action requise',
        body: 'Claude a besoin de votre autorisation pour continuer.',
      };
    case 'input':
      return {
        title: 'Réponse attendue',
        body: 'Claude attend votre réponse pour continuer.',
      };
    case 'plan_approval':
      return {
        title: 'Plan à valider',
        body: 'Claude a terminé son plan et attend votre validation.',
      };
    case 'task_complete':
      return {
        title: 'Tâche terminée',
        body: 'Claude a terminé sa tâche.',
      };
    default:
      return {
        title: 'Attention requise',
        body: 'Une session nécessite votre attention.',
      };
  }
}

/**
 * Create HMAC signature for webhook payload.
 */
function createSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Format payload for Telegram Bot API.
 */
function formatTelegramPayload(webhook: DbWebhook, data: WebhookPayload): object {
  // URL format: https://api.telegram.org/bot<token>/sendMessage?chat_id=<chat_id>
  // We expect the webhook URL to contain the chat_id as a query param
  const url = new URL(webhook.url);
  const chatId = url.searchParams.get('chat_id');

  const { title, body } = getNotificationMessage(data.session.attentionReason);
  const emoji = data.event === 'task_complete' ? '✅' : '🔔';

  return {
    chat_id: chatId,
    text: `${emoji} *${title}*\n\n📁 ${data.session.project}\n📝 ${data.session.name}\n\n${body}`,
    parse_mode: 'Markdown',
  };
}

/**
 * Format payload for Slack Incoming Webhooks.
 */
function formatSlackPayload(_webhook: DbWebhook, data: WebhookPayload): object {
  const { title, body } = getNotificationMessage(data.session.attentionReason);
  const color = data.event === 'task_complete' ? '#36a64f' : '#ff9800';

  return {
    text: `${title} - ${data.session.name}`,
    attachments: [
      {
        color,
        title: data.session.project,
        text: body,
        fields: [
          {
            title: 'Session',
            value: data.session.name,
            short: true,
          },
          {
            title: 'Status',
            value: data.session.attentionReason || data.session.status,
            short: true,
          },
        ],
        ts: Math.floor(data.timestamp / 1000),
      },
    ],
  };
}

/**
 * Format payload for Discord Webhooks.
 */
function formatDiscordPayload(_webhook: DbWebhook, data: WebhookPayload): object {
  const { title, body } = getNotificationMessage(data.session.attentionReason);
  const color = data.event === 'task_complete' ? 0x36a64f : 0xff9800;

  return {
    embeds: [
      {
        title: `${title} - ${data.session.name}`,
        description: body,
        color,
        fields: [
          {
            name: 'Project',
            value: data.session.project,
            inline: true,
          },
          {
            name: 'Status',
            value: data.session.attentionReason || data.session.status,
            inline: true,
          },
        ],
        timestamp: new Date(data.timestamp).toISOString(),
      },
    ],
  };
}

/**
 * Format payload based on webhook type.
 */
function formatPayload(webhook: DbWebhook, data: WebhookPayload): { url: string; body: object } {
  switch (webhook.type as WebhookType) {
    case 'telegram': {
      // For Telegram, we need to extract the base URL and format properly
      const url = new URL(webhook.url);
      // Remove chat_id from URL as we put it in the body
      url.searchParams.delete('chat_id');
      return {
        url: url.toString(),
        body: formatTelegramPayload(webhook, data),
      };
    }
    case 'slack':
      return {
        url: webhook.url,
        body: formatSlackPayload(webhook, data),
      };
    case 'discord':
      return {
        url: webhook.url,
        body: formatDiscordPayload(webhook, data),
      };
    case 'generic':
    default:
      return {
        url: webhook.url,
        body: data,
      };
  }
}

/**
 * Send a webhook notification.
 */
async function sendWebhook(
  webhook: DbWebhook,
  data: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
  const { url, body } = formatPayload(webhook, data);
  const bodyStr = JSON.stringify(body);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': '247-Agent/1.0',
  };

  // Add HMAC signature for generic webhooks with secrets
  if (webhook.secret && webhook.type === 'generic') {
    headers['X-Webhook-Signature'] = createSignature(bodyStr, webhook.secret);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyStr,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `HTTP ${response.status}: ${text.substring(0, 200)}`,
      };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error };
  }
}

/**
 * Send webhooks for a session event.
 */
export async function sendWebhookNotifications(
  event: WebhookEvent,
  session: WSSessionInfo
): Promise<{ sent: number; failed: number }> {
  const webhooks = webhooksDb.getWebhooksForEvent(event);

  if (webhooks.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const { title, body } = getNotificationMessage(session.attentionReason);

  const payload: WebhookPayload = {
    event,
    session: {
      name: session.name,
      project: session.project || 'unknown',
      status: session.status,
      attentionReason: session.attentionReason,
      model: session.model,
      costUsd: session.costUsd,
    },
    timestamp: Date.now(),
    message: `${title}: ${body}`,
  };

  console.log(`[Webhook] Sending ${event} to ${webhooks.length} webhook(s)`);

  let sent = 0;
  let failed = 0;

  // Send all webhooks in parallel
  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const result = await sendWebhook(webhook, payload);
      if (result.success) {
        sent++;
      } else {
        failed++;
        console.error(`[Webhook] Failed to send to ${webhook.name}: ${result.error}`);
      }
      return result;
    })
  );

  console.log(`[Webhook] Sent ${sent}/${webhooks.length}, failed ${failed}`);
  return { sent, failed };
}

/**
 * Send a test notification to a specific webhook.
 */
export async function sendTestWebhook(
  webhookId: string
): Promise<{ success: boolean; error?: string }> {
  const webhook = webhooksDb.getWebhook(webhookId);
  if (!webhook) {
    return { success: false, error: 'Webhook not found' };
  }

  const payload: WebhookPayload = {
    event: 'needs_attention',
    session: {
      name: 'test-session',
      project: 'test-project',
      status: 'needs_attention',
      attentionReason: 'input',
    },
    timestamp: Date.now(),
    message: 'Test notification from 247 Agent',
  };

  return sendWebhook(webhook, payload);
}
