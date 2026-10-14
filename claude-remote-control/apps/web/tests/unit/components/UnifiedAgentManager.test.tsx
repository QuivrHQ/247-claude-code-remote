/**
 * UnifiedAgentManager — "Test connection" auth wiring.
 *
 * Regression test for a bug where the Test action opened the terminal
 * WebSocket without the bearer-token subprotocol, so every authenticated
 * agent reported a connection failure even with valid credentials. The test
 * drives the "Same Computer" add-agent form and asserts the token is sent on
 * the WebSocket handshake exactly as the real terminal connection sends it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { UnifiedAgentManager } from '@/components/UnifiedAgentManager';
import { WS_TOKEN_PROTOCOL_PREFIX } from '@/lib/agent-auth';

// framer-motion animations do not settle in happy-dom; render children
// synchronously so the add-agent form is immediately present.
vi.mock('framer-motion', () => {
  const passthrough = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(function MotionMock(
      { children, ...props },
      ref
    ) {
      // Drop motion-only props so React does not try to apply them to the DOM.
      const {
        initial: _i,
        animate: _a,
        exit: _e,
        variants: _v,
        transition: _t,
        whileHover: _wh,
        whileTap: _wt,
        ...domProps
      } = props;
      return React.createElement(tag, { ref, ...domProps }, children as React.ReactNode);
    });

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy({}, { get: (_t, key: string) => passthrough(key) }),
  };
});

type WsCall = { url: string; protocols?: string | string[] };

const wsCalls: WsCall[] = [];

class MockWebSocket {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(url: string, protocols?: string | string[]) {
    wsCalls.push({ url, protocols });
  }
}

const baseProps = {
  open: true,
  onClose: vi.fn(),
  connectedAgents: [],
  agentStatuses: new Map(),
  sessionCounts: new Map(),
  onDisconnectAgent: vi.fn(),
  onConnectNewAgent: vi.fn(),
  onEditAgent: vi.fn(),
};

function openLocalAddForm() {
  render(<UnifiedAgentManager {...baseProps} />);
  fireEvent.click(screen.getByText('Same Computer'));
}

describe('UnifiedAgentManager — Test connection', () => {
  beforeEach(() => {
    wsCalls.length = 0;
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends the entered token as the bearer subprotocol on the test WebSocket', () => {
    openLocalAddForm();

    const tokenInput = screen.getByPlaceholderText('Paste the token shown by 247 init');
    fireEvent.change(tokenInput, { target: { value: 'secret-token' } });

    fireEvent.click(screen.getByText('Test'));

    expect(wsCalls).toHaveLength(1);
    expect(wsCalls[0].url).toBe('ws://localhost:4678/terminal?project=test&session=test-connection');
    expect(wsCalls[0].protocols).toEqual([`${WS_TOKEN_PROTOCOL_PREFIX}secret-token`]);
  });

  it('opens the test WebSocket without a subprotocol when no token is entered', () => {
    openLocalAddForm();

    fireEvent.click(screen.getByText('Test'));

    expect(wsCalls).toHaveLength(1);
    expect(wsCalls[0].protocols).toBeUndefined();
  });

  it('trims surrounding whitespace before building the subprotocol', () => {
    openLocalAddForm();

    const tokenInput = screen.getByPlaceholderText('Paste the token shown by 247 init');
    fireEvent.change(tokenInput, { target: { value: '  spaced-token  ' } });

    fireEvent.click(screen.getByText('Test'));

    expect(wsCalls[0].protocols).toEqual([`${WS_TOKEN_PROTOCOL_PREFIX}spaced-token`]);
  });
});
