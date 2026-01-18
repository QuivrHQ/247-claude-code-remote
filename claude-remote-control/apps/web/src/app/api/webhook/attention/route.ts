import { NextResponse } from 'next/server';
import { attentionEvents, type AttentionEvent } from '@/lib/attention-events';
import type { AttentionReason } from '247-shared';

// Valid attention reasons
const VALID_REASONS: AttentionReason[] = ['permission', 'input', 'plan_approval', 'task_complete'];

// API key for webhook authentication
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY;

export async function POST(req: Request) {
  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    if (!WEBHOOK_API_KEY) {
      console.warn('[Webhook] WEBHOOK_API_KEY not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
    if (apiKey !== WEBHOOK_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionName, project, reason, machineId, machineName } = body;

    // Validate required fields
    if (!sessionName || typeof sessionName !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid sessionName' }, { status: 400 });
    }
    if (!project || typeof project !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid project' }, { status: 400 });
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Create attention event
    const event: AttentionEvent = {
      sessionName,
      project,
      reason,
      timestamp: Date.now(),
      machineId,
      machineName,
    };

    // Broadcast to all SSE subscribers
    attentionEvents.emitAttention(event);

    console.log('[Webhook] Attention event received:', event);

    return NextResponse.json({ ok: true, event });
  } catch (error) {
    console.error('[Webhook] Error processing attention:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
