import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyToken, createToken, generateCode, pairingCodes } from '../../src/routes/pair.js';

// Mock the config module
vi.mock('../../src/config.js', () => ({
  config: {
    agent: {
      port: 4678,
      url: 'localhost:4678',
    },
    projects: {
      basePath: '~/Dev',
      whitelist: [],
    },
  },
}));

describe('Pairing Routes', () => {
  beforeEach(() => {
    // Clear pairing codes before each test
    pairingCodes.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createToken', () => {
    it('should create a valid token', () => {
      const payload = { url: 'localhost:4678' };
      const secret = 'test-secret';
      const token = createToken(payload, secret, 10 * 60 * 1000);

      expect(token).toBeDefined();
      expect(token.split('.').length).toBe(2);
    });

    it('should include expiry in token payload', () => {
      const payload = { url: 'localhost:4678' };
      const secret = 'test-secret';
      const token = createToken(payload, secret, 10 * 60 * 1000);

      const [payloadStr] = token.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());

      expect(decodedPayload.exp).toBeDefined();
      expect(decodedPayload.iat).toBeDefined();
      expect(decodedPayload.url).toBe('localhost:4678');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const payload = { url: 'localhost:4678' };
      const secret = 'test-secret';
      const token = createToken(payload, secret, 10 * 60 * 1000);

      const result = verifyToken(token, secret);

      expect(result.valid).toBe(true);
      expect(result.payload?.url).toBe('localhost:4678');
    });

    it('should reject token with wrong secret', () => {
      const payload = { url: 'localhost:4678' };
      const token = createToken(payload, 'correct-secret', 10 * 60 * 1000);

      const result = verifyToken(token, 'wrong-secret');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should reject expired token', async () => {
      const payload = { url: 'localhost:4678' };
      const secret = 'test-secret';
      // Create token that expires immediately (negative expiry)
      const token = createToken(payload, secret, -1000);

      const result = verifyToken(token, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should reject malformed token', () => {
      const result = verifyToken('invalid-token', 'secret');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token format');
    });
  });

  describe('generateCode', () => {
    it('should generate a 6-digit code', () => {
      const code = generateCode();

      expect(code.length).toBe(6);
      expect(/^\d{6}$/.test(code)).toBe(true);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateCode());
      }
      // With 100 attempts, we should have at least 95 unique codes
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  describe('pairingCodes store', () => {
    it('should store and retrieve pairing codes', () => {
      const code = '123456';
      pairingCodes.set(code, {
        code,
        agentUrl: 'localhost:4678',
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      const retrieved = pairingCodes.get(code);

      expect(retrieved).toBeDefined();
      expect(retrieved?.agentUrl).toBe('localhost:4678');
    });

    it('should return undefined for non-existent codes', () => {
      const retrieved = pairingCodes.get('nonexistent');

      expect(retrieved).toBeUndefined();
    });
  });
});
