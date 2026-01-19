// Map attention reason to notification body (front-end decides how to display)
const REASON_LABELS: Record<string, string> = {
  // Claude Code notification_type values
  permission_prompt: 'Permission requise',
  input_request: 'Input attendu',
  plan_mode: 'Approbation du plan',
  task_complete: 'Tâche terminée',
  // Stop hook value
  input: 'Input attendu',
  // Legacy values (for backwards compat)
  permission: 'Permission requise',
  plan_approval: 'Approbation du plan',
};

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.log('[Notifications] API not available');
    return 'denied';
  }
  const permission = await Notification.requestPermission();
  console.log('[Notifications] Permission requested:', permission);
  return permission;
}

export function showBrowserNotification(project: string, reason?: string): void {
  console.log('[Notifications] showBrowserNotification called:', { project, reason });

  if (!('Notification' in window)) {
    console.log('[Notifications] API not available');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.log('[Notifications] Permission not granted:', Notification.permission);
    return;
  }

  const title = `Claude - ${project}`;
  const body = reason ? REASON_LABELS[reason] || `Attention: ${reason}` : 'Attention requise';

  console.log('[Notifications] Creating notification:', { title, body });

  new Notification(title, {
    body,
    icon: '/icon-192x192.png',
    tag: `claude-${project}`, // Prevents duplicates per project
    requireInteraction: true,
  });

  console.log('[Notifications] Notification created successfully');
}
