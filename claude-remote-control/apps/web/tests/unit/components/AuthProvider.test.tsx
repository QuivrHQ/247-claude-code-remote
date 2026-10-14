import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const { NeonAuthUIProvider } = vi.hoisted(() => ({ NeonAuthUIProvider: vi.fn() }));

vi.mock('@neondatabase/auth/react/ui', () => ({ NeonAuthUIProvider }));
vi.mock('@/lib/auth-client', () => ({ authClient: {} }));

import { AuthProvider } from '@/components/AuthProvider';

describe('AuthProvider', () => {
  beforeEach(() => {
    NeonAuthUIProvider.mockReset();
    NeonAuthUIProvider.mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="neon-auth-ui-provider">{children}</div>
    ));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders children without mounting the Neon provider when auth is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'false');

    render(
      <AuthProvider>
        <span>dashboard</span>
      </AuthProvider>
    );

    expect(screen.getByText('dashboard')).toBeTruthy();
    expect(screen.queryByTestId('neon-auth-ui-provider')).toBeNull();
    // The Neon provider subscribes to the session on mount, which is what
    // keeps requesting /api/auth/get-session (500 without Neon Auth).
    expect(NeonAuthUIProvider).not.toHaveBeenCalled();
  });

  it('wraps children in the Neon provider when auth is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'true');

    render(
      <AuthProvider>
        <span>dashboard</span>
      </AuthProvider>
    );

    const provider = screen.getByTestId('neon-auth-ui-provider');
    expect(provider).toBeTruthy();
    expect(provider.textContent).toBe('dashboard');
  });
});
