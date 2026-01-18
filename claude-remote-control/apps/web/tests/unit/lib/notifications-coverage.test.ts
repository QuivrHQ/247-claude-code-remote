/**
 * Notifications Module Coverage Tests
 *
 * Tests that actually import and test the notifications module functions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  requestNotificationPermission,
  showSessionNotification,
  clearAllNotificationDebounces,
  type SessionInfo,
} from '@/lib/notifications';

describe('Notifications Module', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mockNotification: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Clear notification debounce state between tests
    clearAllNotificationDebounces();

    // Create mock notification instance
    mockNotification = {
      onclick: null,
      close: vi.fn(),
    };

    // Reset Notification mock
    (window.Notification as any).permission = 'granted';
    (window.Notification as any).requestPermission = vi.fn().mockResolvedValue('granted');

    // Mock Notification constructor
    vi.spyOn(window, 'Notification').mockImplementation(function (this: any) {
      Object.assign(this, mockNotification);
      return this;
    } as any);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('requestNotificationPermission', () => {
    it('requests permission when permission is default', () => {
      (window.Notification as any).permission = 'default';

      requestNotificationPermission();

      expect(Notification.requestPermission).toHaveBeenCalled();
    });

    it('does not request permission when already granted', () => {
      (window.Notification as any).permission = 'granted';

      requestNotificationPermission();

      expect(Notification.requestPermission).not.toHaveBeenCalled();
    });

    it('does not request permission when denied', () => {
      (window.Notification as any).permission = 'denied';

      requestNotificationPermission();

      expect(Notification.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe('showSessionNotification', () => {
    const createSession = (
      status: 'needs_attention' | 'working' | 'idle' | 'init',
      attentionReason?: 'permission' | 'input' | 'plan_approval' | 'task_complete'
    ): SessionInfo => ({
      name: 'test-project--brave-lion-42',
      project: 'test-project',
      status,
      attentionReason,
      createdAt: Date.now(),
    });

    it('creates notification when status is needs_attention with permission reason', () => {
      const session = createSession('needs_attention', 'permission');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(window.Notification).toHaveBeenCalledWith('Test Machine - test-project', {
        body: 'Autorisation requise',
        tag: 'test-project--brave-lion-42-needs_attention-permission',
      });
    });

    it('creates notification when status is needs_attention with input reason', () => {
      const session = createSession('needs_attention', 'input');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(window.Notification).toHaveBeenCalledWith('Test Machine - test-project', {
        body: 'En attente de votre réponse',
        tag: 'test-project--brave-lion-42-needs_attention-input',
      });
    });

    it('creates notification when status is needs_attention with plan_approval reason', () => {
      const session = createSession('needs_attention', 'plan_approval');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(window.Notification).toHaveBeenCalledWith('Test Machine - test-project', {
        body: 'Plan à approuver',
        tag: 'test-project--brave-lion-42-needs_attention-plan_approval',
      });
    });

    it('creates notification when status is needs_attention with task_complete reason', () => {
      const session = createSession('needs_attention', 'task_complete');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(window.Notification).toHaveBeenCalledWith('Test Machine - test-project', {
        body: 'Tâche terminée',
        tag: 'test-project--brave-lion-42-needs_attention-task_complete',
      });
    });

    it('uses default message when attentionReason is undefined', () => {
      const session = createSession('needs_attention');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(window.Notification).toHaveBeenCalledWith('Test Machine - test-project', {
        body: 'Claude a besoin de votre attention',
        tag: 'test-project--brave-lion-42-needs_attention-unknown',
      });
    });

    it('does not create notification when status is not needs_attention', () => {
      const session = createSession('working');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(window.Notification).not.toHaveBeenCalled();
    });

    it('does not create notification when status is idle', () => {
      const session = createSession('idle');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(window.Notification).not.toHaveBeenCalled();
    });

    it('does not create notification when permission is not granted', () => {
      (window.Notification as any).permission = 'denied';
      const session = createSession('needs_attention', 'permission');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(window.Notification).not.toHaveBeenCalled();
    });

    it('logs debug information', () => {
      const session = createSession('needs_attention', 'permission');

      showSessionNotification('machine-1', 'Test Machine', session);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('handles notification creation errors gracefully', () => {
      vi.spyOn(window, 'Notification').mockImplementation(() => {
        throw new Error('Notification error');
      });

      const session = createSession('needs_attention', 'permission');

      // Should not throw
      expect(() => {
        showSessionNotification('machine-1', 'Test Machine', session);
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('SessionInfo interface', () => {
    it('accepts valid session with all fields', () => {
      const session: SessionInfo = {
        name: 'test--session-1',
        project: 'test-project',
        status: 'working',
        createdAt: Date.now(),
        attentionReason: 'permission',
        statusSource: 'hook',
        lastActivity: Date.now(),
        lastEvent: 'PreToolUse',
        lastStatusChange: Date.now(),
        archivedAt: undefined,
      };

      expect(session.name).toBe('test--session-1');
      expect(session.status).toBe('working');
    });

    it('accepts minimal session', () => {
      const session: SessionInfo = {
        name: 'test--session-1',
        project: 'test-project',
        status: 'idle',
        createdAt: Date.now(),
      };

      expect(session.name).toBe('test--session-1');
      expect(session.attentionReason).toBeUndefined();
    });
  });
});
