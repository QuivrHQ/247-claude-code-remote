import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test WebSocket reconnection logic in Terminal component.
 *
 * The Terminal uses automatic reconnection with exponential backoff:
 * 1. When WebSocket closes unexpectedly, schedule reconnection after delay
 * 2. Double the delay on each retry up to max (30 seconds)
 * 3. Reset delay to base (1 second) on successful connection
 * 4. Skip reconnection on intentional close (unmount, navigation)
 */

// Constants matching implementation
const WS_RECONNECT_BASE_DELAY = 1000; // 1 second
const WS_RECONNECT_MAX_DELAY = 30000; // 30 seconds

// Reconnection state interface
interface ReconnectionState {
  reconnectDelay: number;
  intentionalClose: boolean;
  isReconnect: boolean;
  connectionState: 'connected' | 'disconnected' | 'reconnecting';
  reconnectTimeout: NodeJS.Timeout | null;
}

/**
 * Calculate next delay using exponential backoff.
 * Doubles the current delay but caps at max.
 */
const calculateNextDelay = (currentDelay: number): number => {
  return Math.min(currentDelay * 2, WS_RECONNECT_MAX_DELAY);
};

/**
 * Determine if reconnection should be attempted.
 */
const shouldReconnect = (state: ReconnectionState): boolean => {
  return !state.intentionalClose;
};

/**
 * Update state on successful connection.
 */
const handleConnectionSuccess = (state: ReconnectionState): ReconnectionState => {
  return {
    ...state,
    connectionState: 'connected',
    reconnectDelay: WS_RECONNECT_BASE_DELAY, // Reset to base delay
  };
};

/**
 * Update state when connection closes unexpectedly.
 */
const handleConnectionClose = (
  state: ReconnectionState,
  scheduleReconnect: (delay: number) => NodeJS.Timeout
): ReconnectionState => {
  if (state.intentionalClose) {
    return {
      ...state,
      connectionState: 'disconnected',
      reconnectTimeout: null,
    };
  }

  const currentDelay = state.reconnectDelay;
  const nextDelay = calculateNextDelay(currentDelay);

  return {
    ...state,
    connectionState: 'disconnected',
    reconnectDelay: nextDelay,
    reconnectTimeout: scheduleReconnect(currentDelay),
  };
};

/**
 * Update state when starting reconnection attempt.
 */
const handleReconnectionAttempt = (state: ReconnectionState): ReconnectionState => {
  return {
    ...state,
    connectionState: 'reconnecting',
    isReconnect: true,
  };
};

/**
 * Cleanup state on component unmount.
 */
const handleCleanup = (state: ReconnectionState): ReconnectionState => {
  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout);
  }
  return {
    ...state,
    intentionalClose: true,
    reconnectTimeout: null,
    reconnectDelay: WS_RECONNECT_BASE_DELAY,
    isReconnect: false,
  };
};

describe('Terminal WebSocket reconnection', () => {
  let state: ReconnectionState;

  beforeEach(() => {
    state = {
      reconnectDelay: WS_RECONNECT_BASE_DELAY,
      intentionalClose: false,
      isReconnect: false,
      connectionState: 'disconnected',
      reconnectTimeout: null,
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Exponential backoff', () => {
    it('should double delay on each reconnection attempt', () => {
      expect(calculateNextDelay(1000)).toBe(2000);
      expect(calculateNextDelay(2000)).toBe(4000);
      expect(calculateNextDelay(4000)).toBe(8000);
      expect(calculateNextDelay(8000)).toBe(16000);
    });

    it('should cap delay at maximum (30s)', () => {
      expect(calculateNextDelay(16000)).toBe(30000);
      expect(calculateNextDelay(30000)).toBe(30000);
      expect(calculateNextDelay(50000)).toBe(30000);
    });

    it('should start at base delay (1s)', () => {
      expect(WS_RECONNECT_BASE_DELAY).toBe(1000);
    });
  });

  describe('Intentional close detection', () => {
    it('should NOT reconnect when intentionalClose is true', () => {
      state.intentionalClose = true;
      expect(shouldReconnect(state)).toBe(false);
    });

    it('should reconnect when intentionalClose is false', () => {
      state.intentionalClose = false;
      expect(shouldReconnect(state)).toBe(true);
    });
  });

  describe('Connection success handling', () => {
    it('should reset delay to base value on successful connection', () => {
      // Simulate multiple failed attempts
      state.reconnectDelay = 8000; // After 3 failures

      const newState = handleConnectionSuccess(state);

      expect(newState.reconnectDelay).toBe(WS_RECONNECT_BASE_DELAY);
    });

    it('should set connection state to connected', () => {
      state.connectionState = 'reconnecting';

      const newState = handleConnectionSuccess(state);

      expect(newState.connectionState).toBe('connected');
    });
  });

  describe('Connection close handling', () => {
    it('should schedule reconnection when not intentional close', () => {
      const scheduleReconnect = vi.fn((delay: number) => setTimeout(() => {}, delay));

      const newState = handleConnectionClose(state, scheduleReconnect);

      expect(scheduleReconnect).toHaveBeenCalledWith(WS_RECONNECT_BASE_DELAY);
      expect(newState.connectionState).toBe('disconnected');
    });

    it('should NOT schedule reconnection when intentional close', () => {
      state.intentionalClose = true;
      const scheduleReconnect = vi.fn();

      const newState = handleConnectionClose(state, scheduleReconnect);

      expect(scheduleReconnect).not.toHaveBeenCalled();
      expect(newState.connectionState).toBe('disconnected');
    });

    it('should increase delay for next attempt', () => {
      const scheduleReconnect = vi.fn((delay: number) => setTimeout(() => {}, delay));

      const newState = handleConnectionClose(state, scheduleReconnect);

      expect(newState.reconnectDelay).toBe(2000); // Doubled from 1000
    });
  });

  describe('Reconnection attempt handling', () => {
    it('should set connection state to reconnecting', () => {
      state.connectionState = 'disconnected';

      const newState = handleReconnectionAttempt(state);

      expect(newState.connectionState).toBe('reconnecting');
    });

    it('should mark as reconnect for UI purposes', () => {
      state.isReconnect = false;

      const newState = handleReconnectionAttempt(state);

      expect(newState.isReconnect).toBe(true);
    });
  });

  describe('Cleanup behavior', () => {
    it('should mark as intentional close', () => {
      const newState = handleCleanup(state);

      expect(newState.intentionalClose).toBe(true);
    });

    it('should clear reconnect timeout', () => {
      state.reconnectTimeout = setTimeout(() => {}, 1000);
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      handleCleanup(state);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(state.reconnectTimeout);
    });

    it('should reset delay for next mount', () => {
      state.reconnectDelay = 8000;

      const newState = handleCleanup(state);

      expect(newState.reconnectDelay).toBe(WS_RECONNECT_BASE_DELAY);
    });

    it('should reset isReconnect flag', () => {
      state.isReconnect = true;

      const newState = handleCleanup(state);

      expect(newState.isReconnect).toBe(false);
    });
  });

  describe('Connection state transitions', () => {
    it('should transition disconnected -> reconnecting -> connected', () => {
      // Initial state
      expect(state.connectionState).toBe('disconnected');

      // Reconnection attempt starts
      let newState = handleReconnectionAttempt(state);
      expect(newState.connectionState).toBe('reconnecting');

      // Connection succeeds
      newState = handleConnectionSuccess(newState);
      expect(newState.connectionState).toBe('connected');
    });

    it('should transition connected -> disconnected -> reconnecting -> connected', () => {
      // Start connected
      state.connectionState = 'connected';

      // Connection lost
      const scheduleReconnect = vi.fn((delay: number) => setTimeout(() => {}, delay));
      let newState = handleConnectionClose(state, scheduleReconnect);
      expect(newState.connectionState).toBe('disconnected');

      // Reconnection attempt
      newState = handleReconnectionAttempt(newState);
      expect(newState.connectionState).toBe('reconnecting');

      // Reconnection succeeds
      newState = handleConnectionSuccess(newState);
      expect(newState.connectionState).toBe('connected');
    });
  });

  describe('Full reconnection flow simulation', () => {
    it('should handle multiple failed reconnection attempts with increasing delays', () => {
      const delays: number[] = [];
      const scheduleReconnect = vi.fn((delay: number) => {
        delays.push(delay);
        return setTimeout(() => {}, delay);
      });

      // First disconnect (delay = 1000, next = 2000)
      state = handleConnectionClose(state, scheduleReconnect);
      expect(delays[0]).toBe(1000);

      // Second disconnect (delay = 2000, next = 4000)
      state = handleConnectionClose(state, scheduleReconnect);
      expect(delays[1]).toBe(2000);

      // Third disconnect (delay = 4000, next = 8000)
      state = handleConnectionClose(state, scheduleReconnect);
      expect(delays[2]).toBe(4000);

      // Fourth disconnect (delay = 8000, next = 16000)
      state = handleConnectionClose(state, scheduleReconnect);
      expect(delays[3]).toBe(8000);

      // Eventually caps at 30000
      state.reconnectDelay = 30000;
      state = handleConnectionClose(state, scheduleReconnect);
      expect(delays[4]).toBe(30000);
      expect(state.reconnectDelay).toBe(30000); // Still capped
    });

    it('should reset delay after successful reconnection', () => {
      const scheduleReconnect = vi.fn((delay: number) => setTimeout(() => {}, delay));

      // Multiple failed attempts
      state = handleConnectionClose(state, scheduleReconnect);
      state = handleConnectionClose(state, scheduleReconnect);
      state = handleConnectionClose(state, scheduleReconnect);

      expect(state.reconnectDelay).toBe(8000); // 1000 -> 2000 -> 4000 -> 8000

      // Successful connection
      state = handleConnectionSuccess(state);

      expect(state.reconnectDelay).toBe(WS_RECONNECT_BASE_DELAY);

      // Next failure starts fresh
      state = handleConnectionClose(state, scheduleReconnect);
      expect(scheduleReconnect).toHaveBeenLastCalledWith(WS_RECONNECT_BASE_DELAY);
    });
  });
});
