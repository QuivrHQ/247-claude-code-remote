import { describe, it, expect } from 'vitest';
import { authHeaders, wsSubprotocols, WS_TOKEN_PROTOCOL_PREFIX } from '@/lib/agent-auth';

describe('agent-auth helpers', () => {
  describe('authHeaders', () => {
    it('returns a Bearer header when a token is present', () => {
      expect(authHeaders('abc123')).toEqual({ Authorization: 'Bearer abc123' });
    });

    it('returns an empty object when there is no token', () => {
      expect(authHeaders(undefined)).toEqual({});
      expect(authHeaders(null)).toEqual({});
      expect(authHeaders('')).toEqual({});
    });
  });

  describe('wsSubprotocols', () => {
    it('returns the bearer subprotocol when a token is present', () => {
      // Assert the literal wire value so a prefix change can't silently drift
      // away from the agent's `247.bearer.` contract.
      expect(wsSubprotocols('abc123')).toEqual(['247.bearer.abc123']);
      expect(WS_TOKEN_PROTOCOL_PREFIX).toBe('247.bearer.');
    });

    it('returns undefined when there is no token (so WebSocket behaves as before)', () => {
      expect(wsSubprotocols(undefined)).toBeUndefined();
      expect(wsSubprotocols(null)).toBeUndefined();
      expect(wsSubprotocols('')).toBeUndefined();
    });
  });
});
