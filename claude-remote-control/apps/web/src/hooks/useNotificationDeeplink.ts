'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Hook to handle notification deep links on iOS PWA
 *
 * On iOS PWA, notification clicks may not properly navigate using
 * clients.navigate(). This hook:
 * 1. Listens for postMessage from service worker (NOTIFICATION_CLICK)
 * 2. Checks for cached deeplinks on mount (CHECK_NOTIFICATION_DEEPLINK)
 * 3. Navigates to the URL when received
 */
export function useNotificationDeeplink() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle navigation to deeplink URL
  const handleDeeplink = useCallback(
    (url: string) => {
      console.log('[Deeplink] Navigating to:', url);

      // Parse the URL to extract query params
      try {
        const urlObj = new URL(url, window.location.origin);

        // If we're already on the same path with same params, skip
        const currentPath = window.location.pathname + window.location.search;
        const targetPath = urlObj.pathname + urlObj.search;

        if (currentPath === targetPath) {
          console.log('[Deeplink] Already on target URL, skipping');
          return;
        }

        // Navigate to the URL
        router.push(targetPath);
      } catch (e) {
        console.error('[Deeplink] Invalid URL:', url, e);
        // Fallback: try navigating to the raw URL
        router.push(url);
      }
    },
    [router]
  );

  useEffect(() => {
    // Skip if service worker not supported
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Handle messages from service worker
    const handleMessage = (event: MessageEvent) => {
      const { type, url } = event.data || {};

      if (type === 'NOTIFICATION_CLICK' || type === 'NOTIFICATION_DEEPLINK') {
        console.log(`[Deeplink] Received ${type} message:`, url);
        if (url) {
          handleDeeplink(url);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Check for pending deeplink on mount (iOS fallback)
    const checkPendingDeeplink = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          console.log('[Deeplink] Checking for pending deeplink...');
          registration.active.postMessage({ type: 'CHECK_NOTIFICATION_DEEPLINK' });
        }
      } catch (e) {
        console.error('[Deeplink] Failed to check pending deeplink:', e);
      }
    };

    // Small delay to ensure SW is ready
    const timeoutId = setTimeout(checkPendingDeeplink, 500);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
    };
  }, [handleDeeplink]);

  // Also handle URL params if we have machine/session in the URL
  // This handles the case where the deeplink worked via openWindow
  useEffect(() => {
    const machine = searchParams.get('machine');
    const session = searchParams.get('session');

    if (machine && session) {
      console.log('[Deeplink] URL contains session params:', { machine, session });
      // The main app component should handle this - just log it
    }
  }, [searchParams]);
}
