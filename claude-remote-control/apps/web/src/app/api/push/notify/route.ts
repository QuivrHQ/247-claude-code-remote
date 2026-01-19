import { NextResponse } from 'next/server';
import { db, agentConnection, pushSubscription } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { sendPushNotification } from '@/lib/push';

/**
 * POST /api/push/notify
 * Send push notification to user (called by agent with machineId)
 *
 * Body:
 * - machineId: string (agent's machine UUID)
 * - sessionName: string (e.g., "project--session-name")
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { machineId, sessionName } = body;

    if (!machineId) {
      return NextResponse.json({ error: 'machineId required' }, { status: 400 });
    }

    if (!sessionName) {
      return NextResponse.json({ error: 'sessionName required' }, { status: 400 });
    }

    // Find the agent connection by machineId to get the userId
    const [connection] = await db
      .select()
      .from(agentConnection)
      .where(eq(agentConnection.machineId, machineId))
      .limit(1);

    console.warn(
      `[Push] Looking for machineId=${machineId}, found connection:`,
      connection?.id || 'none'
    );

    if (!connection) {
      // No connection found for this machineId - agent not paired
      console.warn(`[Push] No connection found for machineId=${machineId}`);
      return NextResponse.json({ success: true, sent: 0, message: 'Agent not paired' });
    }

    // Get all push subscriptions for this user
    const subscriptions = await db
      .select()
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, connection.userId));

    console.warn(
      `[Push] Found ${subscriptions.length} subscriptions for userId=${connection.userId}`
    );

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions' });
    }

    // Extract project name from session name (format: project--session-id)
    const [projectName] = sessionName.split('--');

    // Send push notification to all user's subscriptions
    const payload = {
      title: `Claude - ${projectName}`,
      body: 'Attention requise',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: `claude-${sessionName}`,
      data: {
        sessionName,
        projectName,
        url: '/',
      },
    };

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const success = await sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );

        // Remove expired subscription
        if (!success) {
          await db.delete(pushSubscription).where(eq(pushSubscription.id, sub.id));
        }

        return success;
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    const expired = results.filter((r) => r.status === 'fulfilled' && r.value === false).length;

    console.warn(`[Push] Sent ${sent} notifications for ${sessionName} (${expired} expired)`);

    return NextResponse.json({ success: true, sent, expired });
  } catch (error) {
    console.error('[Push] Error sending notification:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
