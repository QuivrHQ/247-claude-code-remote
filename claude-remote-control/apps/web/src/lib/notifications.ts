import type { SessionStatus, AttentionReason, StatusSource } from '247-shared';

// Local extension of WSSessionInfo for web app use
// Mirrors the structure from 247-shared but with optional statusSource
export interface SessionInfo {
  name: string;
  project: string;
  createdAt: number;
  status: SessionStatus;
  attentionReason?: AttentionReason;
  statusSource?: StatusSource;
  lastActivity?: number;
  lastEvent?: string;
  lastStatusChange?: number;
  archivedAt?: number; // Timestamp when archived (undefined = active)
  // Session metrics
  model?: string;
  costUsd?: number;
  contextUsage?: number;
  linesAdded?: number;
  linesRemoved?: number;
  // Git worktree isolation
  worktreePath?: string;
  branchName?: string;
}

// Debounce tracking - prevent notification spam when status oscillates quickly
const lastNotificationTime = new Map<string, number>();
const NOTIFICATION_DEBOUNCE_MS = 30000; // 30 seconds between notifications for same session

/**
 * Clear notification debounce for a session (e.g., when user interacts with it)
 */
export function clearNotificationDebounce(sessionName: string): void {
  lastNotificationTime.delete(sessionName);
}

/**
 * Clear all notification debounces (e.g., on page refresh)
 */
export function clearAllNotificationDebounces(): void {
  lastNotificationTime.clear();
}

export function requestNotificationPermission(): void {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'default'
  ) {
    Notification.requestPermission();
  }
}

// Notification messages for each attention reason
const notificationMessages: Record<AttentionReason, string> = {
  permission: 'Autorisation requise',
  input: 'En attente de votre réponse',
  plan_approval: 'Plan à approuver',
  task_complete: 'Tâche terminée',
};

export function showSessionNotification(
  machineId: string,
  machineName: string,
  session: SessionInfo
): void {
  console.log('[Notifications] showSessionNotification called:', {
    machineId,
    machineName,
    session,
  });

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('[Notifications] Notification API not available');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.log('[Notifications] Permission not granted:', Notification.permission);
    return;
  }

  // Only notify when Claude needs attention
  if (session.status !== 'needs_attention') {
    console.log('[Notifications] Status is not needs_attention, skipping');
    return;
  }

  // Debounce check - avoid spam when status oscillates quickly
  const now = Date.now();
  const lastTime = lastNotificationTime.get(session.name);
  if (lastTime && now - lastTime < NOTIFICATION_DEBOUNCE_MS) {
    console.log(
      `[Notifications] Debounced - last notification was ${Math.round((now - lastTime) / 1000)}s ago (min: ${NOTIFICATION_DEBOUNCE_MS / 1000}s)`
    );
    return;
  }

  // Get appropriate message based on attention reason
  const body = session.attentionReason
    ? notificationMessages[session.attentionReason]
    : 'Claude a besoin de votre attention';

  const title = `${machineName} - ${session.project}`;

  console.log('[Notifications] Creating notification:', { title, body });

  try {
    const notification = new Notification(title, {
      body,
      tag: `${session.name}-${session.status}-${session.attentionReason || 'unknown'}`,
    });

    // Track notification time for debouncing
    lastNotificationTime.set(session.name, now);

    notification.onclick = () => {
      const url = `?session=${encodeURIComponent(session.name)}&machine=${machineId}`;

      // Clear debounce when user interacts
      clearNotificationDebounce(session.name);

      window.focus();
      window.location.href = url;
      notification.close();
    };

    console.log('[Notifications] Notification created:', notification);
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
  }
}
