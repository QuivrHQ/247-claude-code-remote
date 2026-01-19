import type { AttentionReason } from '247-shared';

const REASON_LABELS: Record<AttentionReason, string> = {
  permission: 'Permission requise',
  input: 'Input attendu',
  plan_approval: 'Approbation du plan',
  task_complete: 'Tâche terminée',
};

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

export function showBrowserNotification(project: string, reason?: AttentionReason): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = `Claude - ${project}`;
  const body = reason ? REASON_LABELS[reason] : 'Attention requise';

  new Notification(title, {
    body,
    icon: '/icon-192x192.png',
    tag: `claude-${project}`, // Prevents duplicates per project
    requireInteraction: true,
  });
}
