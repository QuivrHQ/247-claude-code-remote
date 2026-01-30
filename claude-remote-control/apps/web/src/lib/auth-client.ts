'use client';

import './polyfills';
import { createAuthClient } from '@neondatabase/auth/next';

export const authClient = createAuthClient();
