'use client';

import { NeonAuthUIProvider } from '@neondatabase/auth/react/ui';
import { authClient } from '@/lib/auth-client';
import { isAuthEnabled } from '@/lib/auth-config';
import { useRouter } from 'next/navigation';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Local mode: NeonAuthUIProvider subscribes to the session on mount and keeps
  // re-polling /api/auth/get-session (500 without Neon Auth), so don't mount it.
  if (!isAuthEnabled()) return <>{children}</>;

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      social={{ providers: ['github'] }}
      navigate={(path: string) => router.push(path)}
      redirectTo="/"
      emailOTP
    >
      {children}
    </NeonAuthUIProvider>
  );
}
