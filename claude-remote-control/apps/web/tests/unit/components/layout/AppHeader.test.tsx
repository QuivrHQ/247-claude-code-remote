import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

// Mock only the library boundary so the real auth-client + auth-config guard runs.
vi.mock('@neondatabase/auth/next', () => ({
  createAuthClient: () => ({ getSession, signOut: vi.fn() }),
}));

import { AppHeader } from '@/components/layout/AppHeader';

/** Let the UserMenu's mount-time session lookup settle. */
async function flushSessionLookup() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('AppHeader user menu session lookup', () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('makes no session request and leaves the loading state when auth is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'false');

    const { container } = render(<AppHeader />);
    await flushSessionLookup();

    expect(getSession).not.toHaveBeenCalled();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('requests the session once and shows the user initials when auth is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'true');
    getSession.mockResolvedValue({
      data: { user: { name: 'Ada Lovelace', email: 'ada@example.com' } },
    });

    render(<AppHeader />);

    expect(await screen.findByText('AL')).toBeTruthy();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it('leaves the loading state without crashing when the session request fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'true');
    getSession.mockRejectedValue(new Error('network down'));

    const { container } = render(<AppHeader />);
    await flushSessionLookup();

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});
