/**
 * Helpers for sending the agent's bearer token on HTTP and WebSocket calls.
 *
 * The token is captured during pairing and stored on the connection record.
 * The agent accepts it as `Authorization: Bearer <token>` on HTTP and as a
 * `247.bearer.<token>` subprotocol on WebSocket upgrades (browsers cannot set
 * custom headers on a `WebSocket`). When a connection has no token (an agent
 * running without authentication), both helpers are no-ops.
 */

/** Must match WS_TOKEN_PROTOCOL_PREFIX in apps/agent/src/lib/auth.ts. */
export const WS_TOKEN_PROTOCOL_PREFIX = '247.bearer.';

/** Authorization header for `fetch`, or an empty object when there is no token. */
export function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Subprotocols for `new WebSocket(url, protocols)`, or `undefined` when there
 * is no token (so the call behaves exactly as before).
 */
export function wsSubprotocols(token?: string | null): string[] | undefined {
  return token ? [`${WS_TOKEN_PROTOCOL_PREFIX}${token}`] : undefined;
}
