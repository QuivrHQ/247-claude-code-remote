/**
 * Whether Neon Auth is configured for this build.
 *
 * `NEXT_PUBLIC_AUTH_ENABLED` is derived from `NEON_AUTH_BASE_URL` in
 * `next.config.mjs` and inlined at build time, so client code can tell whether
 * `/api/auth/*` can work. When it can't (local mode: no Neon Auth configured),
 * the auth routes respond 500, so callers must skip auth requests entirely.
 *
 * Kept free of any `@neondatabase/auth` import so it is safe to use anywhere.
 */
export function isAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === 'true';
}
