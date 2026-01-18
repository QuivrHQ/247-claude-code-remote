import { attentionEvents, type AttentionEvent } from '@/lib/attention-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // Subscribe to attention events
      unsubscribe = attentionEvents.onAttention((event: AttentionEvent) => {
        const message = `data: ${JSON.stringify({ type: 'attention', ...event })}\n\n`;
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          // Client disconnected
          if (unsubscribe) unsubscribe();
        }
      });

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        const heartbeat = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`;
        try {
          controller.enqueue(encoder.encode(heartbeat));
        } catch {
          // Client disconnected
          clearInterval(heartbeatInterval);
          if (unsubscribe) unsubscribe();
        }
      }, 30000);

      // Cleanup on close
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        if (unsubscribe) unsubscribe();
      };

      // Store cleanup function
      (controller as any)._cleanup = cleanup;
    },
    cancel() {
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
