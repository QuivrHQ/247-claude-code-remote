import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import {
  requestNotificationPermission,
  showBrowserNotification,
} from '../../../src/lib/notifications';
import type { AttentionReason } from '247-shared';

describe('Notifications', () => {
  describe('requestNotificationPermission', () => {
    beforeEach(() => {
      // Reset mock implementation for each test
      (window.Notification.requestPermission as Mock).mockClear();
    });

    it('calls Notification.requestPermission when API is available', async () => {
      (window.Notification.requestPermission as Mock).mockResolvedValueOnce('granted');

      const result = await requestNotificationPermission();

      expect(window.Notification.requestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });

    it('returns denied permission state', async () => {
      (window.Notification.requestPermission as Mock).mockResolvedValueOnce('denied');

      const result = await requestNotificationPermission();
      expect(result).toBe('denied');
    });

    it('returns default permission state', async () => {
      (window.Notification.requestPermission as Mock).mockResolvedValueOnce('default');

      const result = await requestNotificationPermission();
      expect(result).toBe('default');
    });
  });

  describe('showBrowserNotification', () => {
    let NotificationSpy: Mock;

    beforeEach(() => {
      // Create a constructor spy
      NotificationSpy = vi.fn();
      Object.defineProperty(window, 'Notification', {
        writable: true,
        value: NotificationSpy,
      });
      // @ts-expect-error - setting permission
      window.Notification.permission = 'granted';
    });

    afterEach(() => {
      // Restore the original mock from setup.ts
      Object.defineProperty(window, 'Notification', {
        writable: true,
        value: class MockNotification {
          static permission = 'default';
          static requestPermission = vi.fn().mockResolvedValue('granted');
          constructor() {}
          close = vi.fn();
        },
      });
    });

    it('does nothing when permission is not granted', () => {
      // @ts-expect-error - setting permission
      window.Notification.permission = 'denied';

      showBrowserNotification('test-project', 'permission');
      expect(NotificationSpy).not.toHaveBeenCalled();
    });

    it('creates notification with correct title and body for permission reason', () => {
      showBrowserNotification('my-project', 'permission');

      expect(NotificationSpy).toHaveBeenCalledWith('Claude - my-project', {
        body: 'Permission requise',
        icon: '/icon-192x192.png',
        tag: 'claude-my-project',
        requireInteraction: true,
      });
    });

    it('creates notification with correct body for input reason', () => {
      showBrowserNotification('my-project', 'input');

      expect(NotificationSpy).toHaveBeenCalledWith('Claude - my-project', {
        body: 'Input attendu',
        icon: '/icon-192x192.png',
        tag: 'claude-my-project',
        requireInteraction: true,
      });
    });

    it('creates notification with correct body for plan_approval reason', () => {
      showBrowserNotification('my-project', 'plan_approval');

      expect(NotificationSpy).toHaveBeenCalledWith('Claude - my-project', {
        body: 'Approbation du plan',
        icon: '/icon-192x192.png',
        tag: 'claude-my-project',
        requireInteraction: true,
      });
    });

    it('creates notification with correct body for task_complete reason', () => {
      showBrowserNotification('my-project', 'task_complete');

      expect(NotificationSpy).toHaveBeenCalledWith('Claude - my-project', {
        body: 'Tâche terminée',
        icon: '/icon-192x192.png',
        tag: 'claude-my-project',
        requireInteraction: true,
      });
    });

    it('creates notification with default body when no reason provided', () => {
      showBrowserNotification('my-project');

      expect(NotificationSpy).toHaveBeenCalledWith('Claude - my-project', {
        body: 'Attention requise',
        icon: '/icon-192x192.png',
        tag: 'claude-my-project',
        requireInteraction: true,
      });
    });

    it('uses project name in tag to prevent duplicates', () => {
      showBrowserNotification('project-a', 'permission');
      showBrowserNotification('project-b', 'permission');

      expect(NotificationSpy).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({ tag: 'claude-project-a' })
      );
      expect(NotificationSpy).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({ tag: 'claude-project-b' })
      );
    });
  });

  describe('AttentionReason labels', () => {
    const REASON_LABELS: Record<AttentionReason, string> = {
      permission: 'Permission requise',
      input: 'Input attendu',
      plan_approval: 'Approbation du plan',
      task_complete: 'Tâche terminée',
    };

    it('has label for all attention reasons', () => {
      const reasons: AttentionReason[] = ['permission', 'input', 'plan_approval', 'task_complete'];

      reasons.forEach((reason) => {
        expect(REASON_LABELS[reason]).toBeDefined();
        expect(typeof REASON_LABELS[reason]).toBe('string');
        expect(REASON_LABELS[reason].length).toBeGreaterThan(0);
      });
    });
  });
});
