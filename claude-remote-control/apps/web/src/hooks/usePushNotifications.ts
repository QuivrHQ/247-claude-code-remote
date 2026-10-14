'use client';

import { useState, useEffect, useCallback } from 'react';
import { pushLogger } from '@/lib/logger';

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'default';
  isLoading: boolean;
  error: string | null;
}

/**
 * Convert a base64 string to Uint8Array for applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
    isLoading: true,
    error: null,
  });

  // Check initial state
  useEffect(() => {
    const checkSupport = async () => {
      const hasApis =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

      if (!hasApis) {
        setState((s) => ({ ...s, isSupported: false, isLoading: false }));
        return;
      }

      const permission = Notification.permission;

      // Check if there's already a service worker controller
      const hasController = !!navigator.serviceWorker.controller;

      if (!hasController) {
        // No active service worker (probably dev mode) - still allow notifications
        setState({
          isSupported: true,
          isSubscribed: false,
          permission,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Service worker exists, check subscription
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setState({
          isSupported: true,
          isSubscribed: !!subscription,
          permission,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        pushLogger.error('Error checking subscription', error);
        setState({
          isSupported: true,
          isSubscribed: false,
          permission,
          isLoading: false,
          error: 'Failed to check subscription status',
        });
      }
    };

    checkSupport();
  }, []);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async () => {
    if (!state.isSupported) {
      setState((s) => ({ ...s, error: 'Push notifications not supported' }));
      return false;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Request notification permission
      pushLogger.info('Requesting permission...');
      const permission = await Notification.requestPermission();
      pushLogger.info(`Permission result: ${permission}`);
      if (permission !== 'granted') {
        setState((s) => ({
          ...s,
          permission,
          isLoading: false,
          error: 'Notification permission denied',
        }));
        return false;
      }

      // Get VAPID public key
      pushLogger.info('Fetching VAPID key...');
      const vapidResponse = await fetch('/api/push/vapid-key');
      if (!vapidResponse.ok) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: 'Push notifications are not configured on this server (local mode).',
        }));
        return false;
      }
      const { publicKey } = await vapidResponse.json();
      pushLogger.info('Got VAPID key');

      // Wait for service worker with timeout (15s for iOS)
      pushLogger.info('Waiting for service worker...');
      const swReadyPromise = navigator.serviceWorker.ready;
      const swTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Service worker timeout - try refreshing the page')),
          15000 // 15 seconds for iOS
        )
      );
      const registration = await Promise.race([swReadyPromise, swTimeoutPromise]);
      pushLogger.info('Service worker ready');

      // Subscribe to push manager with timeout (20s - iOS can be slow)
      pushLogger.info('Subscribing to push manager...');
      const subscribePromise = registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const subscribeTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Push subscription timeout - please try again')),
          20000 // 20 seconds timeout
        )
      );
      const subscription = await Promise.race([subscribePromise, subscribeTimeoutPromise]);
      pushLogger.info('Subscribed to push manager');

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      setState({
        isSupported: true,
        isSubscribed: true,
        permission: 'granted',
        isLoading: false,
        error: null,
      });

      pushLogger.info('Successfully subscribed');
      return true;
    } catch (error) {
      pushLogger.error('Subscription error', error);
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      }));
      return false;
    }
  }, [state.isSupported]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setState((s) => ({
        ...s,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      pushLogger.info('Successfully unsubscribed');
      return true;
    } catch (error) {
      pushLogger.error('Unsubscribe error', error);
      setState((s) => ({
        ...s,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      }));
      return false;
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
