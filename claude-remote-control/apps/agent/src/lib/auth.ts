/**
 * Bearer-token authentication for the agent's HTTP and WebSocket surface.
 *
 * The agent hands out a shell, so the Origin allowlist in `origin.ts` is not
 * enough on its own: it only stops *browsers* on other sites, while any
 * non-browser client that can reach the port or tunnel still gets in. A shared
 * secret token closes that gap.
 *
 * Delivery:
 * - HTTP: `Authorization: Bearer <token>`.
 * - WebSocket: browsers cannot set custom headers on a `WebSocket`, so the
 *   token travels as a subprotocol of the form `247.bearer.<token>` in the
 *   `Sec-WebSocket-Protocol` header.
 *
 * The expected token comes from `agent.authToken` in the config (or the
 * `AGENT_247_AUTH_TOKEN` env override). When no token is configured the agent
 * runs in an insecure, backward-compatible mode (see `server.ts`), so existing
 * installs keep working until they are re-paired with a token.
 */

import { timingSafeEqual } from 'crypto';

const BEARER_PREFIX = 'Bearer ';

/** Subprotocol prefix that carries the token on a WebSocket upgrade. */
export const WS_TOKEN_PROTOCOL_PREFIX = '247.bearer.';

/**
 * The token the agent requires, or `undefined` when authentication is disabled.
 * The env override wins so an operator can rotate without rewriting the config.
 */
export function resolveAuthToken(configured?: string, envValue?: string): string | undefined {
  const token = (envValue ?? configured ?? '').trim();
  return token.length > 0 ? token : undefined;
}

/** Pull the token out of an `Authorization: Bearer <token>` header. */
export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (typeof authorization !== 'string') {
    return undefined;
  }
  // The HTTP auth scheme is case-insensitive (RFC 7235), so accept "bearer"
  // in any case.
  if (authorization.slice(0, BEARER_PREFIX.length).toLowerCase() !== BEARER_PREFIX.toLowerCase()) {
    return undefined;
  }
  const token = authorization.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
}

/**
 * Pull the token out of a `Sec-WebSocket-Protocol` header. The header is a
 * comma-separated list of offered subprotocols; we return the token from the
 * first `247.bearer.<token>` entry, scanning the rest so the client may also
 * offer other subprotocols.
 */
export function extractWebSocketToken(protocolHeader: string | undefined): string | undefined {
  if (typeof protocolHeader !== 'string') {
    return undefined;
  }
  for (const entry of protocolHeader.split(',')) {
    const protocol = entry.trim();
    if (protocol.startsWith(WS_TOKEN_PROTOCOL_PREFIX)) {
      const token = protocol.slice(WS_TOKEN_PROTOCOL_PREFIX.length);
      if (token.length > 0) {
        return token;
      }
    }
  }
  return undefined;
}

/**
 * Compare a presented token against the expected one in constant time. A
 * missing token, or any length mismatch, fails without leaking timing.
 */
export function isAuthTokenValid(provided: string | undefined, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) {
    return false;
  }
  const presented = Buffer.from(provided);
  const want = Buffer.from(expected);
  if (presented.length !== want.length) {
    return false;
  }
  return timingSafeEqual(presented, want);
}

/**
 * Decide whether a request/upgrade carrying `provided` may proceed, given the
 * `expected` token (or `undefined` when auth is disabled). With auth disabled
 * everything is allowed; with auth enabled the tokens must match.
 */
export function isAuthorized(provided: string | undefined, expected: string | undefined): boolean {
  if (expected === undefined) {
    return true;
  }
  return isAuthTokenValid(provided, expected);
}
