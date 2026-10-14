'use client';

import { AuthView } from '@neondatabase/auth/react/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isAuthEnabled } from '@/lib/auth-config';

export default function AuthPage() {
  const params = useParams();
  const path = params.path as string;

  // AuthView needs the NeonAuthUIProvider, which isn't mounted in local mode.
  if (!isAuthEnabled()) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold">247</h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Authentication isn&apos;t configured for this deployment.
          </p>
          <Link href="/" className="text-sm underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8">
        <h1 className="mb-8 text-center text-2xl font-bold">247</h1>
        <AuthView pathname={path} />
      </div>
    </div>
  );
}
