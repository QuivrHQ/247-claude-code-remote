import type { SessionStatus, AttentionReason } from '@claude-remote/shared';

export interface SessionInfo {
  name: string;
  project: string;
  createdAt: number;
  status: SessionStatus;
  attentionReason?: AttentionReason;
  statusSource?: 'hook' | 'tmux';
  lastActivity?: string;
  lastEvent?: string;
  lastStatusChange?: number;
  archivedAt?: number; // Timestamp when archived (undefined = active)
  environmentId?: string;
  // Environment metadata for badge display
  environment?: {
    id: string;
    name: string;
    provider: 'anthropic' | 'openrouter';
    icon: string | null;
    isDefault: boolean;
  };
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
  console.log('[Notifications] showSessionNotification called:', { machineId, machineName, session });

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

    notification.onclick = () => {
      const url = `?session=${encodeURIComponent(session.name)}&machine=${machineId}`;

      window.focus();
      window.location.href = url;
      notification.close();
    };

    console.log('[Notifications] Notification created:', notification);
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
  }
}
