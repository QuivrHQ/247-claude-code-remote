import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test keyboard shortcut detection logic.
 * On Mac, Option+key produces special characters (e.g., Option+1 = ¡),
 * so we must use e.code instead of e.key for detection.
 */

// Helper to create keyboard events
const createKeyboardEvent = (
  code: string,
  key: string,
  modifiers: { altKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {}
): KeyboardEvent => {
  return new KeyboardEvent('keydown', {
    code,
    key,
    altKey: modifiers.altKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    bubbles: true,
  });
};

// Extract the keyboard shortcut detection logic for testing
const detectSessionShortcut = (e: KeyboardEvent): number | null => {
  if (e.altKey && !e.metaKey && !e.ctrlKey) {
    const digitMatch = e.code.match(/^Digit([1-9])$/);
    if (digitMatch) {
      return parseInt(digitMatch[1]) - 1; // 0-based index
    }
  }
  return null;
};

const detectTabShortcut = (e: KeyboardEvent): 'terminal' | 'editor' | null => {
  if (e.altKey && !e.metaKey && !e.ctrlKey) {
    if (e.code === 'KeyT') return 'terminal';
    if (e.code === 'KeyE') return 'editor';
  }
  return null;
};

const detectNavigationShortcut = (e: KeyboardEvent): 'prev' | 'next' | null => {
  if (e.altKey && !e.metaKey && !e.ctrlKey) {
    if (e.code === 'BracketLeft') return 'prev';
    if (e.code === 'BracketRight') return 'next';
  }
  return null;
};

const detectNewSessionShortcut = (e: KeyboardEvent): boolean => {
  return (e.metaKey || e.ctrlKey) && e.key === 'n';
};

describe('Keyboard Shortcuts', () => {
  describe('Session switching (Option + 1-9)', () => {
    it('detects Option+1 using e.code (not e.key)', () => {
      // On Mac, Option+1 produces '¡' as e.key but 'Digit1' as e.code
      const event = createKeyboardEvent('Digit1', '¡', { altKey: true });
      expect(detectSessionShortcut(event)).toBe(0);
    });

    it('detects Option+2 through Option+9', () => {
      for (let i = 2; i <= 9; i++) {
        const event = createKeyboardEvent(`Digit${i}`, String(i), { altKey: true });
        expect(detectSessionShortcut(event)).toBe(i - 1);
      }
    });

    it('ignores Cmd+1 (should not trigger session switch)', () => {
      const event = createKeyboardEvent('Digit1', '1', { metaKey: true });
      expect(detectSessionShortcut(event)).toBeNull();
    });

    it('ignores Ctrl+1', () => {
      const event = createKeyboardEvent('Digit1', '1', { ctrlKey: true });
      expect(detectSessionShortcut(event)).toBeNull();
    });

    it('ignores Option+Cmd+1 (multiple modifiers)', () => {
      const event = createKeyboardEvent('Digit1', '¡', { altKey: true, metaKey: true });
      expect(detectSessionShortcut(event)).toBeNull();
    });

    it('ignores plain number keys without modifiers', () => {
      const event = createKeyboardEvent('Digit1', '1', {});
      expect(detectSessionShortcut(event)).toBeNull();
    });

    it('ignores Option+0 (not in 1-9 range)', () => {
      const event = createKeyboardEvent('Digit0', 'º', { altKey: true });
      expect(detectSessionShortcut(event)).toBeNull();
    });
  });

  describe('Tab switching (Option + T/E)', () => {
    it('detects Option+T for terminal using e.code', () => {
      // On Mac, Option+T produces '†' as e.key
      const event = createKeyboardEvent('KeyT', '†', { altKey: true });
      expect(detectTabShortcut(event)).toBe('terminal');
    });

    it('detects Option+E for editor using e.code', () => {
      // On Mac, Option+E produces '´' as e.key
      const event = createKeyboardEvent('KeyE', '´', { altKey: true });
      expect(detectTabShortcut(event)).toBe('editor');
    });

    it('ignores Cmd+T', () => {
      const event = createKeyboardEvent('KeyT', 't', { metaKey: true });
      expect(detectTabShortcut(event)).toBeNull();
    });

    it('ignores plain T key', () => {
      const event = createKeyboardEvent('KeyT', 't', {});
      expect(detectTabShortcut(event)).toBeNull();
    });

    it('ignores Option+other keys', () => {
      const event = createKeyboardEvent('KeyX', '≈', { altKey: true });
      expect(detectTabShortcut(event)).toBeNull();
    });
  });

  describe('Session navigation (Option + [ / ])', () => {
    it('detects Option+[ for previous session', () => {
      // On Mac, Option+[ produces " (left double quote)
      const event = createKeyboardEvent('BracketLeft', '\u201C', { altKey: true });
      expect(detectNavigationShortcut(event)).toBe('prev');
    });

    it('detects Option+] for next session', () => {
      // On Mac, Option+] produces ' (right single quote)
      const event = createKeyboardEvent('BracketRight', '\u2019', { altKey: true });
      expect(detectNavigationShortcut(event)).toBe('next');
    });

    it('ignores Cmd+[', () => {
      const event = createKeyboardEvent('BracketLeft', '[', { metaKey: true });
      expect(detectNavigationShortcut(event)).toBeNull();
    });

    it('ignores plain bracket keys', () => {
      const event = createKeyboardEvent('BracketLeft', '[', {});
      expect(detectNavigationShortcut(event)).toBeNull();
    });
  });

  describe('New session (Cmd/Ctrl + N)', () => {
    it('detects Cmd+N', () => {
      const event = createKeyboardEvent('KeyN', 'n', { metaKey: true });
      expect(detectNewSessionShortcut(event)).toBe(true);
    });

    it('detects Ctrl+N', () => {
      const event = createKeyboardEvent('KeyN', 'n', { ctrlKey: true });
      expect(detectNewSessionShortcut(event)).toBe(true);
    });

    it('ignores Option+N', () => {
      const event = createKeyboardEvent('KeyN', '˜', { altKey: true });
      expect(detectNewSessionShortcut(event)).toBe(false);
    });

    it('ignores plain N key', () => {
      const event = createKeyboardEvent('KeyN', 'n', {});
      expect(detectNewSessionShortcut(event)).toBe(false);
    });
  });

  describe('No Chrome conflicts', () => {
    it('Cmd+1-9 should NOT trigger session switch (reserved for Chrome tabs)', () => {
      for (let i = 1; i <= 9; i++) {
        const event = createKeyboardEvent(`Digit${i}`, String(i), { metaKey: true });
        expect(detectSessionShortcut(event)).toBeNull();
      }
    });

    it('Option+1-9 triggers session switch (does not conflict with Chrome)', () => {
      for (let i = 1; i <= 9; i++) {
        const event = createKeyboardEvent(`Digit${i}`, String(i), { altKey: true });
        expect(detectSessionShortcut(event)).toBe(i - 1);
      }
    });
  });
});

describe('Mac special character handling', () => {
  // Document the Mac Option key behavior (using Unicode escapes for safety)
  const macOptionCharacters: Record<string, string> = {
    '1': '\u00A1', // ¡
    '2': '\u2122', // ™
    '3': '\u00A3', // £
    '4': '\u00A2', // ¢
    '5': '\u221E', // ∞
    '6': '\u00A7', // §
    '7': '\u00B6', // ¶
    '8': '\u2022', // •
    '9': '\u00AA', // ª
    't': '\u2020', // †
    'e': '\u00B4', // ´
    '[': '\u201C', // "
    ']': '\u2019', // '
  };

  it('correctly handles Option+number producing special chars', () => {
    // Verify our detection works regardless of e.key value
    Object.entries(macOptionCharacters).forEach(([num, specialChar]) => {
      if (num >= '1' && num <= '9') {
        const event = createKeyboardEvent(`Digit${num}`, specialChar, { altKey: true });
        expect(detectSessionShortcut(event)).toBe(parseInt(num) - 1);
      }
    });
  });

  it('correctly handles Option+T producing †', () => {
    const event = createKeyboardEvent('KeyT', macOptionCharacters['t'], { altKey: true });
    expect(detectTabShortcut(event)).toBe('terminal');
  });

  it('correctly handles Option+E producing ´', () => {
    const event = createKeyboardEvent('KeyE', macOptionCharacters['e'], { altKey: true });
    expect(detectTabShortcut(event)).toBe('editor');
  });
});
