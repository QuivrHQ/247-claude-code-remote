import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock('@neondatabase/auth/next', () => ({
  createAuthClient: () => ({ getSession }),
}));

import { getAuthSession } from '@/lib/auth-client';

describe('getAuthSession', () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null without calling the auth server when auth is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'false');

    const session = await getAuthSession();

    expect(session).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('returns null without calling the auth server when the flag is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', undefined);

    const session = await getAuthSession();

    expect(session).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('delegates to authClient.getSession when auth is enabled', async () => {
    const expected = { data: { user: { name: 'Ada Lovelace', email: 'ada@example.com' } } };
    getSession.mockResolvedValue(expected);
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'true');

    const session = await getAuthSession();

    expect(session).toBe(expected);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('propagates auth server errors when enabled so callers can handle them', async () => {
    getSession.mockRejectedValue(new Error('network down'));
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'true');

    await expect(getAuthSession()).rejects.toThrow('network down');
  });
});
