import { EventEmitter } from 'events';
import type { AttentionReason } from '247-shared';

// Attention event data structure
export interface AttentionEvent {
  sessionName: string;
  project: string;
  reason: AttentionReason;
  timestamp: number;
  machineId?: string;
  machineName?: string;
}

// Global event emitter for SSE broadcasting
// Using a simple in-memory emitter - events are transient
class AttentionEventEmitter extends EventEmitter {
  private static instance: AttentionEventEmitter;

  private constructor() {
    super();
    // Allow unlimited listeners for SSE connections
    this.setMaxListeners(0);
  }

  static getInstance(): AttentionEventEmitter {
    if (!AttentionEventEmitter.instance) {
      AttentionEventEmitter.instance = new AttentionEventEmitter();
    }
    return AttentionEventEmitter.instance;
  }

  // Emit attention event to all SSE subscribers
  emitAttention(event: AttentionEvent): void {
    this.emit('attention', event);
  }

  // Subscribe to attention events
  onAttention(callback: (event: AttentionEvent) => void): () => void {
    this.on('attention', callback);
    return () => this.off('attention', callback);
  }
}

export const attentionEvents = AttentionEventEmitter.getInstance();
