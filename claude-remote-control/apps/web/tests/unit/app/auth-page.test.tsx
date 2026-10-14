import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@neondatabase/auth/react/ui', () => ({
  AuthView: ({ pathname }: { pathname: string }) => <div data-testid="auth-view">{pathname}</div>,
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ path: 'sign-in' }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import AuthPage from '@/app/auth/[path]/page';

describe('AuthPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows a not-configured message with a way back when auth is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'false');

    render(<AuthPage />);

    expect(screen.queryByTestId('auth-view')).toBeNull();
    expect(screen.getByText(/isn't configured/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to dashboard/i }).getAttribute('href')).toBe('/');
  });

  it('renders the Neon AuthView for the current path when auth is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_AUTH_ENABLED', 'true');

    render(<AuthPage />);

    expect(screen.getByTestId('auth-view').textContent).toBe('sign-in');
  });
});
