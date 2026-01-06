'use client';

import { SessionProvider } from './SessionContext';
import { SessionLayoutContent } from './SessionLayoutContent';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function SessionLayout({ children }: LayoutProps) {
  return (
    <SessionProvider>
      <SessionLayoutContent>{children}</SessionLayoutContent>
    </SessionProvider>
  );
}
