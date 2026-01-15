'use client';

import { SessionPollingProvider } from '@/contexts/SessionPollingContext';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionPollingProvider>{children}</SessionPollingProvider>;
}
