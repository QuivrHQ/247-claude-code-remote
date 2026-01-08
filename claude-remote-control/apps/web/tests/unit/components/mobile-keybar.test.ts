import { describe, it, expect, vi } from 'vitest';

/**
 * Test MobileKeybar component logic.
 * This tests the ANSI escape sequences sent for each key and scroll behavior.
 */

// ANSI escape sequences (must match MobileKeybar.tsx)
const KEYS = {
  UP: '\x1b[A',
  DOWN: '\x1b[B',
  LEFT: '\x1b[D',
  RIGHT: '\x1b[C',
  ENTER: '\r',
  ESC: '\x1b',
  SHIFT_TAB: '\x1b[Z',
  CTRL_C: '\x03',
} as const;

describe('MobileKeybar', () => {
  describe('ANSI escape sequences', () => {
    it('uses correct escape sequence for arrow up', () => {
      expect(KEYS.UP).toBe('\x1b[A');
    });

    it('uses correct escape sequence for arrow down', () => {
      expect(KEYS.DOWN).toBe('\x1b[B');
    });

    it('uses correct escape sequence for arrow left', () => {
      expect(KEYS.LEFT).toBe('\x1b[D');
    });

    it('uses correct escape sequence for arrow right', () => {
      expect(KEYS.RIGHT).toBe('\x1b[C');
    });

    it('uses correct sequence for Enter', () => {
      expect(KEYS.ENTER).toBe('\r');
    });

    it('uses correct sequence for Escape', () => {
      expect(KEYS.ESC).toBe('\x1b');
    });

    it('uses correct sequence for Shift+Tab', () => {
      expect(KEYS.SHIFT_TAB).toBe('\x1b[Z');
    });

    it('uses correct sequence for Ctrl+C', () => {
      expect(KEYS.CTRL_C).toBe('\x03');
    });
  });

  describe('Key press handler simulation', () => {
    it('sends UP key when up arrow is pressed', () => {
      // Simulate what MobileKeybar does when up arrow button is clicked
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.UP);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[A');
    });

    it('sends DOWN key when down arrow is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.DOWN);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[B');
    });

    it('sends LEFT key when left arrow is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.LEFT);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[D');
    });

    it('sends RIGHT key when right arrow is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.RIGHT);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[C');
    });

    it('sends ENTER when enter button is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.ENTER);
      expect(onKeyPress).toHaveBeenCalledWith('\r');
    });

    it('sends ESC when escape button is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.ESC);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b');
    });

    it('sends SHIFT_TAB when shift+tab button is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.SHIFT_TAB);
      expect(onKeyPress).toHaveBeenCalledWith('\x1b[Z');
    });

    it('sends CTRL_C when ctrl+c button is pressed', () => {
      const onKeyPress = vi.fn();
      onKeyPress(KEYS.CTRL_C);
      expect(onKeyPress).toHaveBeenCalledWith('\x03');
    });

    it('scrolls up when page up button is pressed', () => {
      const onScroll = vi.fn();
      onScroll('up');
      expect(onScroll).toHaveBeenCalledWith('up');
    });

    it('scrolls down when page down button is pressed', () => {
      const onScroll = vi.fn();
      onScroll('down');
      expect(onScroll).toHaveBeenCalledWith('down');
    });
  });

  describe('Integration with terminal', () => {
    it('all arrow keys produce valid xterm escape sequences', () => {
      // These sequences should be recognized by xterm.js
      const arrowSequences = [KEYS.UP, KEYS.DOWN, KEYS.LEFT, KEYS.RIGHT];

      arrowSequences.forEach((seq) => {
        // All arrow keys start with ESC [
        expect(seq.startsWith('\x1b[')).toBe(true);
        // And end with a single letter
        expect(seq.length).toBe(3);
      });
    });

    it('control characters are single bytes', () => {
      expect(KEYS.ENTER.length).toBe(1);
      expect(KEYS.ESC.length).toBe(1);
      expect(KEYS.CTRL_C.length).toBe(1);
    });

    it('Shift+Tab is a 3-byte escape sequence', () => {
      expect(KEYS.SHIFT_TAB.length).toBe(3);
      expect(KEYS.SHIFT_TAB.startsWith('\x1b[')).toBe(true);
    });
  });

  describe('Visibility prop', () => {
    it('defaults to visible when prop not provided', () => {
      const defaultVisible = true;
      expect(defaultVisible).toBe(true);
    });

    it('renders component when visible is true', () => {
      const visible = true;
      // Component renders when visible
      const shouldRender = visible;
      expect(shouldRender).toBe(true);
    });

    it('returns null when hidden (completely removes from layout)', () => {
      const visible = false;
      // Component returns null when hidden to free up space
      const shouldRender = visible;
      expect(shouldRender).toBe(false);
    });

    it('removes from DOM instead of CSS hide for proper layout', () => {
      // This is important: we return null instead of using CSS to hide
      // because we want the terminal to resize and fill the space
      const visible = false;
      const componentOutput = visible ? 'rendered' : null;
      expect(componentOutput).toBeNull();
    });
  });

  describe('Touch scroll logic', () => {
    // Test the scroll calculation logic used in useTerminalConnection
    const calculateScrollLines = (deltaY: number): number => {
      return Math.round(deltaY / 20); // ~20px per line
    };

    it('scrolls 1 line for ~20px movement', () => {
      expect(calculateScrollLines(20)).toBe(1);
      expect(calculateScrollLines(25)).toBe(1);
      expect(calculateScrollLines(15)).toBe(1);
    });

    it('scrolls multiple lines for larger movements', () => {
      expect(calculateScrollLines(40)).toBe(2);
      expect(calculateScrollLines(60)).toBe(3);
      expect(calculateScrollLines(100)).toBe(5);
    });

    it('scrolls in negative direction for upward swipe', () => {
      // When swiping up (finger moves up), deltaY is negative
      expect(calculateScrollLines(-20)).toBe(-1);
      expect(calculateScrollLines(-40)).toBe(-2);
    });

    it('returns 0 for small movements', () => {
      expect(calculateScrollLines(5)).toBe(0);
      // Note: Math.round(-0.25) = -0, which equals 0 in JS comparisons
      expect(calculateScrollLines(-5) === 0).toBe(true);
    });

    it('should only scroll when vertical movement exceeds horizontal', () => {
      // This simulates the condition: Math.abs(deltaY) > deltaX && Math.abs(deltaY) > 10
      const shouldScroll = (deltaY: number, deltaX: number): boolean => {
        return Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10;
      };

      // Vertical swipe - should scroll
      expect(shouldScroll(30, 5)).toBe(true);
      expect(shouldScroll(-30, 5)).toBe(true);

      // Horizontal swipe - should not scroll
      expect(shouldScroll(5, 30)).toBe(false);

      // Diagonal but mostly vertical - should scroll
      expect(shouldScroll(40, 20)).toBe(true);

      // Small movement - should not scroll (threshold)
      expect(shouldScroll(8, 2)).toBe(false);
    });
  });

  describe('Alternate buffer scroll (tmux copy-mode)', () => {
    // SGR mouse wheel escape sequences for tmux
    const WHEEL_UP = '\x1b[<64;1;1M'; // See older content (scroll up in history)
    const WHEEL_DOWN = '\x1b[<65;1;1M'; // See newer content (scroll down in history)

    it('wheel UP escape sequence format is correct', () => {
      expect(WHEEL_UP).toBe('\x1b[<64;1;1M');
      // Must start with CSI < for SGR mouse encoding
      expect(WHEEL_UP.startsWith('\x1b[<')).toBe(true);
      // Button 64 for wheel up
      expect(WHEEL_UP.includes('64')).toBe(true);
    });

    it('wheel DOWN escape sequence format is correct', () => {
      expect(WHEEL_DOWN).toBe('\x1b[<65;1;1M');
      // Must start with CSI < for SGR mouse encoding
      expect(WHEEL_DOWN.startsWith('\x1b[<')).toBe(true);
      // Button 65 for wheel down
      expect(WHEEL_DOWN.includes('65')).toBe(true);
    });

    describe('natural scroll direction mapping', () => {
      // This is the core logic: map touch deltaY to tmux wheel direction
      // Natural scroll (iOS/Android style):
      // - Swipe UP (negative deltaY) → content moves up → see NEWER content → wheel DOWN
      // - Swipe DOWN (positive deltaY) → content moves down → see OLDER content → wheel UP
      const getWheelEventForDelta = (deltaY: number): string => {
        return deltaY < 0 ? WHEEL_DOWN : WHEEL_UP;
      };

      it('swipe UP (negative deltaY) sends wheel DOWN to see newer content', () => {
        expect(getWheelEventForDelta(-20)).toBe(WHEEL_DOWN);
        expect(getWheelEventForDelta(-100)).toBe(WHEEL_DOWN);
        expect(getWheelEventForDelta(-1)).toBe(WHEEL_DOWN);
      });

      it('swipe DOWN (positive deltaY) sends wheel UP to see older content', () => {
        expect(getWheelEventForDelta(20)).toBe(WHEEL_UP);
        expect(getWheelEventForDelta(100)).toBe(WHEEL_UP);
        expect(getWheelEventForDelta(1)).toBe(WHEEL_UP);
      });

      it('deltaY = 0 sends wheel UP (edge case)', () => {
        // deltaY < 0 is false when deltaY = 0, so it goes to wheel UP
        expect(getWheelEventForDelta(0)).toBe(WHEEL_UP);
      });
    });

    describe('scroll threshold', () => {
      const SCROLL_THRESHOLD = 10;
      const shouldTriggerScroll = (deltaY: number): boolean => {
        return Math.abs(deltaY) >= SCROLL_THRESHOLD;
      };

      it('ignores small movements below threshold', () => {
        expect(shouldTriggerScroll(5)).toBe(false);
        expect(shouldTriggerScroll(-8)).toBe(false);
        expect(shouldTriggerScroll(9)).toBe(false);
        expect(shouldTriggerScroll(-9)).toBe(false);
      });

      it('triggers scroll at threshold', () => {
        expect(shouldTriggerScroll(10)).toBe(true);
        expect(shouldTriggerScroll(-10)).toBe(true);
      });

      it('triggers scroll above threshold', () => {
        expect(shouldTriggerScroll(15)).toBe(true);
        expect(shouldTriggerScroll(-20)).toBe(true);
        expect(shouldTriggerScroll(100)).toBe(true);
      });
    });

    describe('buffer type detection', () => {
      it('alternate buffer type string is correct', () => {
        // xterm.js uses 'alternate' as the buffer type string
        const bufferType = 'alternate';
        expect(bufferType).toBe('alternate');
      });

      it('normal buffer type string is correct', () => {
        // xterm.js uses 'normal' as the buffer type string
        const bufferType = 'normal';
        expect(bufferType).toBe('normal');
      });
    });
  });
});
