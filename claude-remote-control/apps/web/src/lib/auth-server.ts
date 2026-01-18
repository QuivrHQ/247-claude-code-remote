import { createAuthServer, neonAuth, authApiHandler } from '@neondatabase/auth/next/server';

// Lazy initialization to avoid errors during build when env vars aren't available
let _authServer: ReturnType<typeof createAuthServer> | null = null;

export function getAuthServer() {
  if (!_authServer) {
    _authServer = createAuthServer();
  }
  return _authServer;
}

// For backwards compatibility - will throw at runtime if env vars missing
export const authServer = new Proxy({} as ReturnType<typeof createAuthServer>, {
  get(_target, prop) {
    return getAuthServer()[prop as keyof ReturnType<typeof createAuthServer>];
  },
});

export { neonAuth, authApiHandler };
