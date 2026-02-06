'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY_SOUND = '247-notification-sound-enabled';
const STORAGE_KEY_SOUND_CHOICE = '247-notification-sound-choice';

export type NotificationSoundId = 'default' | 'chime' | 'pop' | 'bell' | 'ding' | 'soft';

export interface NotificationSound {
  id: NotificationSoundId;
  name: string;
  path: string;
}

export const NOTIFICATION_SOUNDS: NotificationSound[] = [
  { id: 'chime', name: 'Chime', path: '/sounds/chime.mp3' },
  { id: 'pop', name: 'Pop', path: '/sounds/pop.mp3' },
  { id: 'bell', name: 'Bell', path: '/sounds/bell.mp3' },
  { id: 'ding', name: 'Ding', path: '/sounds/ding.mp3' },
  { id: 'soft', name: 'Soft', path: '/sounds/soft.mp3' },
  { id: 'default', name: 'Default', path: '/sounds/default.mp3' },
];

/**
 * Hook to manage notification preferences with localStorage persistence.
 * Sound on/off toggle with sound choice selector.
 */
export function useNotificationPreferences() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedSound, setSelectedSoundState] = useState<NotificationSoundId>('chime');

  // Load persisted state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedSound = localStorage.getItem(STORAGE_KEY_SOUND);
    if (storedSound !== null) {
      setSoundEnabled(storedSound === 'true');
    }

    const storedSoundChoice = localStorage.getItem(STORAGE_KEY_SOUND_CHOICE);
    if (storedSoundChoice !== null) {
      setSelectedSoundState(storedSoundChoice as NotificationSoundId);
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY_SOUND, String(next));
      return next;
    });
  }, []);

  const setSoundPreference = useCallback((enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem(STORAGE_KEY_SOUND, String(enabled));
  }, []);

  const setSelectedSound = useCallback((soundId: NotificationSoundId) => {
    setSelectedSoundState(soundId);
    localStorage.setItem(STORAGE_KEY_SOUND_CHOICE, soundId);
  }, []);

  const getSelectedSoundPath = useCallback(() => {
    const sound = NOTIFICATION_SOUNDS.find((s) => s.id === selectedSound);
    return sound?.path ?? NOTIFICATION_SOUNDS[0].path;
  }, [selectedSound]);

  return {
    soundEnabled,
    selectedSound,
    toggleSound,
    setSoundPreference,
    setSelectedSound,
    getSelectedSoundPath,
  };
}
