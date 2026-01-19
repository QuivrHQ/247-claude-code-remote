'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationButtonProps {
  className?: string;
  isMobile?: boolean;
}

export function PushNotificationButton({
  className,
  isMobile = false,
}: PushNotificationButtonProps) {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  // Don't show if not supported
  if (!isSupported) {
    return null;
  }

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const iconClass = isMobile ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white',
        'touch-manipulation disabled:opacity-50',
        isMobile ? 'min-h-[44px] min-w-[44px] p-2.5' : 'p-2',
        isSubscribed && 'text-orange-400 hover:text-orange-300',
        className
      )}
      title={isSubscribed ? 'Disable notifications' : 'Enable notifications'}
    >
      {isLoading ? (
        <Loader2 className={cn(iconClass, 'animate-spin')} />
      ) : isSubscribed ? (
        <Bell className={iconClass} />
      ) : (
        <BellOff className={iconClass} />
      )}
    </button>
  );
}
