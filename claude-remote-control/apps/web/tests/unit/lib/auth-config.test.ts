import { describe, it, expect, afterEach, vi } from 'vitest';
import { isAuthEnabled } from '@/lib/auth-config';

describe('isAuthEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when NEXT_PUBLIC_AUTH_ENABLED is "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'true');

    expect(isAuthEnabled()).toBe(true);
  });

  it('returns false when NEXT_PUBLIC_AUTH_ENABLED is "false"', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'false');

    expect(isAuthEnabled()).toBe(false);
  });

  it('returns false when NEXT_PUBLIC_AUTH_ENABLED is unset (local mode)', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', undefined);

    expect(isAuthEnabled()).toBe(false);
  });

  it('treats any value other than "true" as disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', '1');

    expect(isAuthEnabled()).toBe(false);
  });
});
