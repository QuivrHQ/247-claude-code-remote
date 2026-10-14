'use client';

import { SessionPollingProvider } from '@/contexts/SessionPollingContext';
import { useEffect, type ReactNode } from 'react';

/**
 * Clear the PWA app badge when the app is opened or becomes visible.
 * iOS/iPadOS shows the count of unread notifications as a badge on the app icon.
 */
function useClearAppBadge() {
  useEffect(() => {
    const clearBadge = () => {
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {
          // Ignore errors - badge API may not be available in all contexts
        });
      }
    };

    // Clear badge when app loads
    clearBadge();

    // Clear badge when app becomes visible (user switches back to the app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearBadge();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

/**
 * Register the PWA service worker so push notifications and offline caching
 * work. No-ops in insecure contexts (e.g. plain http on a LAN IP), which is
 * fine for local self-hosted deployments.
 */
function useRegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        // Insecure origins always reject; only surface real failures.
        if (window.isSecureContext) {
          console.error('Service worker registration failed:', error);
        }
      });
    }
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useClearAppBadge();
  useRegisterServiceWorker();
  return <SessionPollingProvider>{children}</SessionPollingProvider>;
}
