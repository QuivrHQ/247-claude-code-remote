import { describe, it, expect } from 'vitest';
import {
  resolveAuthToken,
  extractBearerToken,
  extractWebSocketToken,
  isAuthTokenValid,
  isAuthorized,
  WS_TOKEN_PROTOCOL_PREFIX,
} from '../../src/lib/auth.js';

describe('agent auth', () => {
  describe('resolveAuthToken', () => {
    it('returns the configured token when no env override', () => {
      expect(resolveAuthToken('abc')).toBe('abc');
    });

    it('prefers the env override over the configured token', () => {
      expect(resolveAuthToken('configured', 'fromenv')).toBe('fromenv');
    });

    it('trims surrounding whitespace', () => {
      expect(resolveAuthToken('  spaced  ')).toBe('spaced');
    });

    it('returns undefined when nothing is set (auth disabled)', () => {
      expect(resolveAuthToken()).toBeUndefined();
      expect(resolveAuthToken('')).toBeUndefined();
      expect(resolveAuthToken('   ')).toBeUndefined();
      expect(resolveAuthToken('', '')).toBeUndefined();
    });
  });

  describe('extractBearerToken', () => {
    it('extracts the token after the Bearer prefix', () => {
      expect(extractBearerToken('Bearer secret-token')).toBe('secret-token');
    });

    it('returns undefined for a missing or malformed header', () => {
      expect(extractBearerToken(undefined)).toBeUndefined();
      expect(extractBearerToken('')).toBeUndefined();
      expect(extractBearerToken('secret-token')).toBeUndefined();
      expect(extractBearerToken('Basic secret-token')).toBeUndefined();
      expect(extractBearerToken('Bearer ')).toBeUndefined();
      expect(extractBearerToken('Bearer    ')).toBeUndefined();
    });

    it('accepts the scheme name case-insensitively (RFC 7235)', () => {
      expect(extractBearerToken('bearer secret')).toBe('secret');
      expect(extractBearerToken('BEARER secret')).toBe('secret');
    });
  });

  describe('extractWebSocketToken', () => {
    it('extracts the token from the 247.bearer.<token> subprotocol', () => {
      expect(extractWebSocketToken(`${WS_TOKEN_PROTOCOL_PREFIX}abc123`)).toBe('abc123');
    });

    it('finds the token among several offered subprotocols', () => {
      expect(extractWebSocketToken(`other, ${WS_TOKEN_PROTOCOL_PREFIX}xyz , more`)).toBe('xyz');
    });

    it('returns undefined when no bearer subprotocol is present', () => {
      expect(extractWebSocketToken(undefined)).toBeUndefined();
      expect(extractWebSocketToken('')).toBeUndefined();
      expect(extractWebSocketToken('graphql-ws, json')).toBeUndefined();
      expect(extractWebSocketToken(WS_TOKEN_PROTOCOL_PREFIX)).toBeUndefined();
    });
  });

  describe('isAuthTokenValid', () => {
    it('accepts an exact match', () => {
      expect(isAuthTokenValid('token', 'token')).toBe(true);
    });

    it('rejects a mismatch, a length difference, or a missing token', () => {
      expect(isAuthTokenValid('token', 'other')).toBe(false);
      expect(isAuthTokenValid('token', 'token-longer')).toBe(false);
      expect(isAuthTokenValid('', 'token')).toBe(false);
      expect(isAuthTokenValid(undefined, 'token')).toBe(false);
    });
  });

  describe('isAuthorized', () => {
    it('allows anything when auth is disabled (no expected token)', () => {
      expect(isAuthorized(undefined, undefined)).toBe(true);
      expect(isAuthorized('whatever', undefined)).toBe(true);
    });

    it('requires a matching token when auth is enabled', () => {
      expect(isAuthorized('right', 'right')).toBe(true);
      expect(isAuthorized('wrong', 'right')).toBe(false);
      expect(isAuthorized(undefined, 'right')).toBe(false);
    });
  });
});
