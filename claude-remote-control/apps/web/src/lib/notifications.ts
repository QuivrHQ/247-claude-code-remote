export interface SessionInfo {
  name: string;
  project: string;
  createdAt: number;
  status: 'running' | 'waiting' | 'permission' | 'stopped' | 'ended' | 'idle';
  statusSource?: 'hook' | 'tmux';
  lastActivity?: string;
  lastEvent?: string;
  lastStatusChange?: number;
  environmentId?: string;
  // Environment metadata for badge display
  environment?: {
    id: string;
    name: string;
    provider: 'anthropic' | 'openrouter';
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

  const body =
    session.status === 'permission'
      ? 'Autorisation requise'
      : session.status === 'waiting'
        ? 'Question posée'
        : 'Tâche terminée';

  const title = `${machineName} - ${session.project}`;

  console.log('[Notifications] Creating notification:', { title, body });

  try {
    const notification = new Notification(title, {
      body,
      tag: `${session.name}-${session.status}`,
    });

    notification.onclick = () => {
      const url = `/s/${machineId}/${encodeURIComponent(session.name)}`;

      window.focus();
      window.location.href = url;
      notification.close();
    };

    console.log('[Notifications] Notification created:', notification);
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
  }
}
