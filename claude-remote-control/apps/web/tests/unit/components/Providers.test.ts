import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the useClearAppBadge hook behavior
describe('useClearAppBadge', () => {
  let clearAppBadgeMock: ReturnType<typeof vi.fn>;
  let originalNavigator: Navigator;

  beforeEach(() => {
    clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
    originalNavigator = global.navigator;

    // Mock navigator with clearAppBadge
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        clearAppBadge: clearAppBadgeMock,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('should call clearAppBadge on mount when API is available', async () => {
    // Import dynamically to get fresh module with mocked navigator
    const { Providers } = await import('@/components/Providers');
    const { createElement } = await import('react');

    renderHook(() => null, {
      wrapper: ({ children }) => createElement(Providers, null, children),
    });

    // Wait for useEffect to run
    await vi.waitFor(() => {
      expect(clearAppBadgeMock).toHaveBeenCalled();
    });
  });

  it('should clear badge when document becomes visible', async () => {
    const { Providers } = await import('@/components/Providers');
    const { createElement } = await import('react');

    renderHook(() => null, {
      wrapper: ({ children }) => createElement(Providers, null, children),
    });

    // Reset mock to check for visibility change call
    clearAppBadgeMock.mockClear();

    // Simulate visibility change
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.waitFor(() => {
      expect(clearAppBadgeMock).toHaveBeenCalled();
    });
  });

  it('should not throw when clearAppBadge is not available', async () => {
    // Remove clearAppBadge from navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
      },
      writable: true,
      configurable: true,
    });

    const { Providers } = await import('@/components/Providers');
    const { createElement } = await import('react');

    // Should not throw
    expect(() => {
      renderHook(() => null, {
        wrapper: ({ children }) => createElement(Providers, null, children),
      });
    }).not.toThrow();
  });
});
