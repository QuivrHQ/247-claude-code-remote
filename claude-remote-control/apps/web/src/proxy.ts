import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export default async function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Handle OAuth callback token exchange
  if (searchParams.has('neon_auth_session_verifier')) {
    // Dynamic import to avoid build-time env var requirement
    const { neonAuthMiddleware } = await import('@neondatabase/auth/next/server');
    const callbackMiddleware = neonAuthMiddleware({
      loginUrl: '/__neon_auth_never_match__',
    });
    return callbackMiddleware(request);
  }

  // All routes are public - no auth required
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon-|apple-icon|manifest).*)'],
};
