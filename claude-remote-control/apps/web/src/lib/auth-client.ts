'use client';

import './polyfills';
import { createAuthClient } from '@neondatabase/auth/next';
import { isAuthEnabled } from './auth-config';

export const authClient = createAuthClient();

/**
 * Current session, or `null` without any network request when auth isn't
 * configured (local mode), where `/api/auth/get-session` responds 500.
 */
export async function getAuthSession() {
  if (!isAuthEnabled()) return null;
  return authClient.getSession();
}
