import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

const STORAGE_KEY_SOUND = '247-notification-sound-enabled';
const STORAGE_KEY_SOUND_CHOICE = '247-notification-sound-choice';

describe('useNotificationPreferences hook', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key: string) => {
      return mockStorage[key] || null;
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key: string, value: string) => {
      mockStorage[key] = value;
    });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key: string) => {
      delete mockStorage[key];
    });
    vi.spyOn(window.localStorage, 'clear').mockImplementation(() => {
      mockStorage = {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should default soundEnabled to false and selectedSound to chime', () => {
      const { result } = renderHook(() => useNotificationPreferences());
      expect(result.current.soundEnabled).toBe(false);
      expect(result.current.selectedSound).toBe('chime');
    });

    it('should load stored sound preference on mount', () => {
      mockStorage[STORAGE_KEY_SOUND] = 'true';
      const { result, rerender } = renderHook(() => useNotificationPreferences());
      rerender();
      expect(result.current.soundEnabled).toBe(true);
    });
  });

  describe('toggleSound function', () => {
    it('should toggle sound from false to true', () => {
      const { result } = renderHook(() => useNotificationPreferences());
      expect(result.current.soundEnabled).toBe(false);

      act(() => {
        result.current.toggleSound();
      });

      expect(result.current.soundEnabled).toBe(true);
      expect(mockStorage[STORAGE_KEY_SOUND]).toBe('true');
    });

    it('should toggle sound from true to false', () => {
      const { result } = renderHook(() => useNotificationPreferences());

      act(() => {
        result.current.toggleSound();
      });
      expect(result.current.soundEnabled).toBe(true);

      act(() => {
        result.current.toggleSound();
      });
      expect(result.current.soundEnabled).toBe(false);
      expect(mockStorage[STORAGE_KEY_SOUND]).toBe('false');
    });
  });

  describe('setSoundPreference function', () => {
    it('should set sound preference to true', () => {
      const { result } = renderHook(() => useNotificationPreferences());

      act(() => {
        result.current.setSoundPreference(true);
      });

      expect(result.current.soundEnabled).toBe(true);
      expect(mockStorage[STORAGE_KEY_SOUND]).toBe('true');
    });

    it('should set sound preference to false', () => {
      const { result } = renderHook(() => useNotificationPreferences());

      act(() => {
        result.current.setSoundPreference(true);
      });
      act(() => {
        result.current.setSoundPreference(false);
      });

      expect(result.current.soundEnabled).toBe(false);
      expect(mockStorage[STORAGE_KEY_SOUND]).toBe('false');
    });
  });

  describe('localStorage persistence', () => {
    it('should persist preferences across hook instances', () => {
      const { result: hook1 } = renderHook(() => useNotificationPreferences());

      act(() => {
        hook1.current.setSoundPreference(true);
      });

      expect(mockStorage[STORAGE_KEY_SOUND]).toBe('true');

      // Create a new hook instance - should read from storage
      const { result: hook2, rerender } = renderHook(() => useNotificationPreferences());
      rerender();

      expect(hook2.current.soundEnabled).toBe(true);
    });
  });

  describe('function stability', () => {
    it('should return stable function references', () => {
      const { result, rerender } = renderHook(() => useNotificationPreferences());

      const {
        toggleSound: toggleSound1,
        setSoundPreference: setSoundPreference1,
        setSelectedSound: setSelectedSound1,
      } = result.current;

      rerender();

      const {
        toggleSound: toggleSound2,
        setSoundPreference: setSoundPreference2,
        setSelectedSound: setSelectedSound2,
      } = result.current;

      expect(toggleSound1).toBe(toggleSound2);
      expect(setSoundPreference1).toBe(setSoundPreference2);
      expect(setSelectedSound1).toBe(setSelectedSound2);
    });
  });

  describe('setSelectedSound function', () => {
    it('should change the selected sound', () => {
      const { result } = renderHook(() => useNotificationPreferences());
      expect(result.current.selectedSound).toBe('chime');

      act(() => {
        result.current.setSelectedSound('bell');
      });

      expect(result.current.selectedSound).toBe('bell');
      expect(mockStorage[STORAGE_KEY_SOUND_CHOICE]).toBe('bell');
    });

    it('should persist selected sound to localStorage', () => {
      const { result } = renderHook(() => useNotificationPreferences());

      act(() => {
        result.current.setSelectedSound('pop');
      });

      expect(mockStorage[STORAGE_KEY_SOUND_CHOICE]).toBe('pop');
    });

    it('should load stored sound choice on mount', () => {
      mockStorage[STORAGE_KEY_SOUND_CHOICE] = 'ding';
      const { result, rerender } = renderHook(() => useNotificationPreferences());
      rerender();
      expect(result.current.selectedSound).toBe('ding');
    });
  });

  describe('getSelectedSoundPath function', () => {
    it('should return the correct path for the default sound', () => {
      const { result } = renderHook(() => useNotificationPreferences());
      expect(result.current.getSelectedSoundPath()).toBe('/sounds/chime.mp3');
    });

    it('should return the correct path for a selected sound', () => {
      const { result } = renderHook(() => useNotificationPreferences());

      act(() => {
        result.current.setSelectedSound('bell');
      });

      expect(result.current.getSelectedSoundPath()).toBe('/sounds/bell.mp3');
    });

    it('should return the correct path for all available sounds', () => {
      const { result } = renderHook(() => useNotificationPreferences());

      const soundPaths: Record<string, string> = {
        chime: '/sounds/chime.mp3',
        pop: '/sounds/pop.mp3',
        bell: '/sounds/bell.mp3',
        ding: '/sounds/ding.mp3',
        soft: '/sounds/soft.mp3',
        default: '/sounds/default.mp3',
      };

      for (const [soundId, expectedPath] of Object.entries(soundPaths)) {
        act(() => {
          result.current.setSelectedSound(
            soundId as 'chime' | 'pop' | 'bell' | 'ding' | 'soft' | 'default'
          );
        });
        expect(result.current.getSelectedSoundPath()).toBe(expectedPath);
      }
    });
  });
});
