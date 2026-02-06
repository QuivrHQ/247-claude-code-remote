'use client';

import { Volume2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useNotificationPreferences,
  NOTIFICATION_SOUNDS,
  type NotificationSoundId,
} from '@/hooks/useNotificationPreferences';
import { useSoundNotifications } from '@/hooks/useSoundNotifications';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-[#0d0d14]',
        enabled ? 'bg-orange-500' : 'bg-white/10',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}

export function NotificationSettingsPanel() {
  const {
    soundEnabled,
    setSoundPreference,
    selectedSound,
    setSelectedSound,
    getSelectedSoundPath,
  } = useNotificationPreferences();

  const { previewSound } = useSoundNotifications({ soundPath: getSelectedSoundPath() });

  const handleSoundToggle = () => {
    setSoundPreference(!soundEnabled);
  };

  const handleSoundSelect = (soundId: NotificationSoundId) => {
    setSelectedSound(soundId);
  };

  const handlePreviewSound = async (path: string) => {
    const played = await previewSound(path);
    if (!played) {
      console.warn('Could not play preview sound');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <p className="text-sm text-white/60">
          Configure how you want to be notified when sessions need your attention.
        </p>
      </div>

      {/* Sound Notifications */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-orange-500/10 p-2">
              <Volume2 className="h-5 w-5 text-orange-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-white">Sound Notifications</h3>
              <p className="text-sm text-white/50">
                Play a sound when a session needs your attention.
              </p>
            </div>
          </div>
          <ToggleSwitch enabled={soundEnabled} onChange={handleSoundToggle} />
        </div>

        {/* Sound Selector */}
        {soundEnabled && (
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium text-white/70">Choose a sound</label>
            <div className="grid grid-cols-2 gap-2">
              {NOTIFICATION_SOUNDS.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => handleSoundSelect(sound.id)}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg px-3 py-2',
                    'border transition-colors',
                    selectedSound === sound.id
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <span className="text-sm">{sound.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewSound(sound.path);
                    }}
                    className={cn('rounded-full p-1', 'hover:bg-white/10', 'transition-colors')}
                    aria-label={`Preview ${sound.name} sound`}
                  >
                    <Play className="h-3 w-3" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
