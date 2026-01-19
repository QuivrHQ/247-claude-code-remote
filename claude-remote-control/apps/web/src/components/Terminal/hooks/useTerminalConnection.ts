'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { CanvasAddon } from '@xterm/addon-canvas';
import {
  TERMINAL_THEME,
  WS_RECONNECT_BASE_DELAY,
  WS_RECONNECT_MAX_DELAY,
  WS_PING_INTERVAL,
  WS_PONG_TIMEOUT,
  WS_ACTIVITY_PAUSE,
} from '../constants';
import { buildWebSocketUrl } from '@/lib/utils';

interface UseTerminalConnectionProps {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  agentUrl: string;
  project: string;
  sessionName: string;
  environmentId?: string;
  /** Planning project ID - when set, the agent will inject a planning prompt for Claude */
  planningProjectId?: string;
  onSessionCreated?: (name: string) => void;
  onCopySuccess: () => void;
  /** Mobile mode - use smaller font and handle orientation changes */
  isMobile?: boolean;
}

export function useTerminalConnection({
  terminalRef,
  agentUrl,
  project,
  sessionName,
  environmentId,
  planningProjectId,
  onSessionCreated,
  onCopySuccess,
  isMobile = false,
}: UseTerminalConnectionProps) {
  const [connected, setConnected] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [connectionState, setConnectionState] = useState<
    'connected' | 'disconnected' | 'reconnecting'
  >('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const isSelectingRef = useRef(false);
  const isPastingRef = useRef(false);

  // Reconnection tracking
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef<number>(WS_RECONNECT_BASE_DELAY);
  const intentionalCloseRef = useRef<boolean>(false);
  const isReconnectRef = useRef<boolean>(false);

  // Adaptive heartbeat tracking
  const lastActivityRef = useRef<number>(Date.now());
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const awaitingPongRef = useRef<boolean>(false);

  // Track if we've acknowledged this session (reset needs_attention on first input)
  const hasAcknowledgedRef = useRef<boolean>(false);

  const scrollToBottom = useCallback(() => {
    xtermRef.current?.scrollToBottom();
  }, []);

  const copySelection = useCallback(() => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        onCopySuccess();
      }
    }
  }, [onCopySuccess]);

  const startClaude = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start-claude' }));
    }
  }, []);

  // Send input to terminal (for virtual keyboard)
  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      lastActivityRef.current = Date.now();
      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, []);

  // Scroll terminal programmatically (for mobile scroll buttons)
  const scrollTerminal = useCallback((direction: 'up' | 'down', lines: number = 10) => {
    if (xtermRef.current) {
      xtermRef.current.scrollLines(direction === 'up' ? -lines : lines);
    }
  }, []);

  // Trigger terminal resize (for keybar visibility changes)
  const triggerResize = useCallback(() => {
    const fitAddon = fitAddonRef.current;
    const term = xtermRef.current;
    if (!fitAddon || !term) return;

    fitAddon.fit();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Reset acknowledge flag for new session
    hasAcknowledgedRef.current = false;

    let cancelled = false;
    let term: XTerm | null = null;
    let ws: WebSocket | null = null;
    let handleResize: (() => void) | null = null;
    let handleMouseUp: (() => void) | null = null;
    let handlePaste: ((e: ClipboardEvent) => void) | null = null;
    let handleTouchStart: ((e: TouchEvent) => void) | null = null;
    let handleTouchMove: ((e: TouchEvent) => void) | null = null;
    let handleTouchEnd: (() => void) | null = null;
    let handleTouchCancel: (() => void) | null = null;
    let termElement: HTMLElement | null = null;
    let touchElement: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let viewportQueries: MediaQueryList[] = [];

    const connectTimeout = setTimeout(() => {
      if (cancelled || !terminalRef.current) return;

      // Initialize xterm.js - smaller font for mobile
      const fontSize = isMobile ? 11 : 14;
      term = new XTerm({
        cursorBlink: true,
        fontSize,
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
        fontWeight: '400',
        fontWeightBold: '600',
        letterSpacing: 0,
        lineHeight: isMobile ? 1.15 : 1.2,
        scrollback: 15000,
        scrollSensitivity: isMobile ? 3 : 1, // More sensitive scrolling on mobile
        fastScrollSensitivity: 5,
        fastScrollModifier: 'alt',
        smoothScrollDuration: 100,
        cursorStyle: 'bar',
        cursorWidth: 2,
        allowProposedApi: true,
        theme: TERMINAL_THEME,
      });

      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.loadAddon(searchAddon);
      term.open(terminalRef.current);

      // Copy handler
      const currentTermForKeys = term;
      term.attachCustomKeyEventHandler((event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key === 'c' &&
          currentTermForKeys.hasSelection()
        ) {
          const selection = currentTermForKeys.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
            onCopySuccess();
          }
          return false;
        }
        return true;
      });

      term.loadAddon(new CanvasAddon());
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      // Mouse selection tracking
      const handleMouseDown = () => {
        isSelectingRef.current = true;
      };
      handleMouseUp = () => {
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 100);
      };
      term.element?.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);

      // Paste handler
      handlePaste = (e: ClipboardEvent) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        const hasImage = Array.from(clipboardData.items).some((item) =>
          item.type.startsWith('image/')
        );
        if (hasImage) return;

        const text = clipboardData.getData('text');
        // Use wsRef.current to get the active WebSocket (may have been reconnected)
        const activeWs = wsRef.current;
        if (text && activeWs?.readyState === WebSocket.OPEN) {
          e.preventDefault();
          isPastingRef.current = true;
          lastActivityRef.current = Date.now(); // Track activity for adaptive heartbeat
          activeWs.send(JSON.stringify({ type: 'input', data: text }));
          setTimeout(() => {
            isPastingRef.current = false;
          }, 50);
        }
      };
      termElement = term.element ?? null;
      termElement?.addEventListener('paste', handlePaste);

      // Scroll tracking
      term.onScroll(() => {
        if (!term || isSelectingRef.current) return;
        const buffer = term.buffer.active;
        setIsAtBottom(buffer.viewportY >= buffer.baseY);
      });

      // Touch scroll handler - xterm.js canvas doesn't support native touch scroll
      // We attach handlers unconditionally - they only fire on touch devices
      // See: https://github.com/xtermjs/xterm.js/issues/5377
      if (term.element) {
        const currentTermForTouch = term; // Capture for closure

        // Wait for .xterm-screen to be available (xterm creates it async after CanvasAddon)
        const setupTouchScroll = () => {
          if (cancelled) return;

          const xtermScreen = currentTermForTouch.element?.querySelector(
            '.xterm-screen'
          ) as HTMLElement | null;
          if (!xtermScreen) {
            // Retry after a short delay - xterm.js may still be initializing
            setTimeout(setupTouchScroll, 50);
            return;
          }

          console.log('[Terminal] Setting up touch scroll on .xterm-screen');

          // CRITICAL: Apply touch-action directly to the target element
          // CSS touch-action is NOT inherited, so it must be on the actual touch target
          xtermScreen.style.touchAction = 'none';
          xtermScreen.style.userSelect = 'none';
          (
            xtermScreen.style as CSSStyleDeclaration & { webkitUserSelect?: string }
          ).webkitUserSelect = 'none';

          // Also apply to canvas children if present
          const canvases = xtermScreen.querySelectorAll('canvas');
          canvases.forEach((canvas) => {
            (canvas as HTMLElement).style.touchAction = 'none';
          });

          let lastTouchY: number | null = null;

          handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length > 0) {
              lastTouchY = e.touches[0].clientY;
            }
          };

          handleTouchMove = (e: TouchEvent) => {
            if (lastTouchY === null || e.touches.length === 0) return;

            // Always prevent default to stop browser scroll
            e.preventDefault();
            e.stopPropagation();

            const currentY = e.touches[0].clientY;
            const deltaY = currentY - lastTouchY;

            // Minimum threshold to reduce scroll sensitivity
            // Higher value = less frequent scroll events = smoother feel
            if (Math.abs(deltaY) < 25) {
              return;
            }

            const buffer = currentTermForTouch.buffer.active;

            // Check if we're in alternate buffer (fullscreen apps like Claude Code, vim, etc.)
            // Alternate buffer has NO scrollback - baseY is always 0
            // In this case, we send mouse wheel escape sequences to tmux instead
            const isAlternateBuffer = buffer.type === 'alternate';

            if (isAlternateBuffer && wsRef.current?.readyState === WebSocket.OPEN) {
              // Fullscreen app mode: send mouse wheel escape sequences to PTY
              // tmux with 'mouse on' will intercept these and enter copy-mode
              // SGR mouse encoding: CSI < button ; x ; y M
              // Button 64 = wheel UP (see older), Button 65 = wheel DOWN (see newer)
              //
              // Natural scroll (iOS/Android style):
              // - Swipe UP (deltaY < 0) → content moves up → see NEWER content → wheel DOWN (65)
              // - Swipe DOWN (deltaY > 0) → content moves down → see OLDER content → wheel UP (64)
              const wheelEvent =
                deltaY < 0
                  ? '\x1b[<65;1;1M' // Wheel DOWN (swipe up = see newer)
                  : '\x1b[<64;1;1M'; // Wheel UP (swipe down = see older)

              // Send ONE event per touchmove for smooth scrolling
              // (touchmove fires frequently, no need to multiply events)
              wsRef.current.send(JSON.stringify({ type: 'input', data: wheelEvent }));
              lastTouchY = currentY;
            } else if (!isAlternateBuffer) {
              // Normal buffer: use xterm.js local scroll
              const scrollAmount = Math.round(deltaY / 15);
              if (scrollAmount !== 0) {
                currentTermForTouch.scrollLines(scrollAmount);
                lastTouchY = currentY;
              }
            }
          };

          handleTouchEnd = () => {
            lastTouchY = null;
          };

          handleTouchCancel = () => {
            lastTouchY = null;
          };

          xtermScreen.addEventListener('touchstart', handleTouchStart, { passive: true });
          xtermScreen.addEventListener('touchmove', handleTouchMove, { passive: false });
          xtermScreen.addEventListener('touchend', handleTouchEnd);
          xtermScreen.addEventListener('touchcancel', handleTouchCancel);

          // Store reference for cleanup
          touchElement = xtermScreen;
        };

        // Start trying to set up touch scroll
        setupTouchScroll();
      }

      // WebSocket connection
      // Read create flag from browser URL to determine if this is a new session creation
      const urlParams = new URLSearchParams(window.location.search);
      const isNewSession = urlParams.get('create') === 'true';

      let wsUrl = buildWebSocketUrl(
        agentUrl,
        `/terminal?project=${encodeURIComponent(project)}&session=${encodeURIComponent(sessionName)}`
      );
      if (environmentId) wsUrl += `&environment=${encodeURIComponent(environmentId)}`;
      if (isNewSession) wsUrl += '&create=true';
      if (planningProjectId) wsUrl += `&planningProjectId=${encodeURIComponent(planningProjectId)}`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      const currentTerm = term;
      const currentWs = ws;

      // Adaptive heartbeat - sends pings only when inactive
      const startHeartbeat = () => {
        // Clear any existing interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        // Reset state
        awaitingPongRef.current = false;
        lastActivityRef.current = Date.now();

        pingIntervalRef.current = setInterval(() => {
          const timeSinceActivity = Date.now() - lastActivityRef.current;

          // Don't ping if there was recent activity (we'll detect disconnect on next send)
          if (timeSinceActivity < WS_ACTIVITY_PAUSE) return;

          // Don't ping if already waiting for a pong
          if (awaitingPongRef.current) return;

          const activeWs = wsRef.current;
          if (activeWs?.readyState === WebSocket.OPEN) {
            activeWs.send(JSON.stringify({ type: 'ping' }));
            awaitingPongRef.current = true;

            // Set timeout for pong response
            pongTimeoutRef.current = setTimeout(() => {
              if (awaitingPongRef.current && !intentionalCloseRef.current) {
                console.warn('Pong timeout - forcing reconnection');
                activeWs.close(4000, 'Pong timeout');
              }
            }, WS_PONG_TIMEOUT);
          }
        }, WS_PING_INTERVAL);
      };

      // Stop heartbeat and clear all related timeouts
      const stopHeartbeat = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = null;
        }
        awaitingPongRef.current = false;
      };

      currentWs.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        setConnectionState('connected');
        reconnectDelayRef.current = WS_RECONNECT_BASE_DELAY;

        if (!isReconnectRef.current) {
          currentTerm.write('\x1b[38;5;245m-- Connected to ' + agentUrl + ' --\x1b[0m\r\n\r\n');
        } else {
          currentTerm.write('\x1b[38;5;245m-- Reconnected --\x1b[0m\r\n');
        }

        currentWs.send(
          JSON.stringify({ type: 'resize', cols: currentTerm.cols, rows: currentTerm.rows })
        );

        if (onSessionCreated && sessionName) onSessionCreated(sessionName);

        // Start adaptive heartbeat to detect silent disconnections
        startHeartbeat();
      };

      currentWs.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') {
            // Reset heartbeat state on pong received
            awaitingPongRef.current = false;
            if (pongTimeoutRef.current) {
              clearTimeout(pongTimeoutRef.current);
              pongTimeoutRef.current = null;
            }
            return;
          }
          if (msg.type === 'history') {
            currentTerm.clear();
            currentTerm.write(msg.data);
            currentTerm.scrollToBottom();
            return;
          }
        } catch {
          currentTerm.write(event.data);
        }
      };

      currentWs.onclose = () => {
        if (cancelled) return;
        setConnected(false);

        // Stop heartbeat on disconnect
        stopHeartbeat();

        if (intentionalCloseRef.current) {
          setConnectionState('disconnected');
          currentTerm.write('\r\n\x1b[38;5;245m-- Disconnected --\x1b[0m\r\n');
          return;
        }

        setConnectionState('disconnected');
        currentTerm.write('\r\n\x1b[38;5;245m-- Disconnected --\x1b[0m\r\n');

        const currentDelay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(currentDelay * 2, WS_RECONNECT_MAX_DELAY);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (cancelled || intentionalCloseRef.current) return;
          setConnectionState('reconnecting');
          isReconnectRef.current = true;

          let newWsUrl = buildWebSocketUrl(
            agentUrl,
            `/terminal?project=${encodeURIComponent(project)}&session=${encodeURIComponent(sessionName)}`
          );
          if (environmentId) newWsUrl += `&environment=${encodeURIComponent(environmentId)}`;

          const newWs = new WebSocket(newWsUrl);
          ws = newWs;
          wsRef.current = newWs;
          newWs.onopen = currentWs.onopen;
          newWs.onmessage = currentWs.onmessage;
          newWs.onclose = currentWs.onclose;
          newWs.onerror = currentWs.onerror;
        }, currentDelay);
      };

      currentWs.onerror = (err) => {
        if (cancelled) return;
        console.error('WebSocket error:', err);
        currentTerm.write('\r\n\x1b[31m* Connection error\x1b[0m\r\n');
      };

      currentTerm.onData((data) => {
        if (isPastingRef.current) return;
        // Use wsRef.current to get the active WebSocket (may have been reconnected)
        const activeWs = wsRef.current;
        if (activeWs?.readyState === WebSocket.OPEN) {
          lastActivityRef.current = Date.now(); // Track activity for adaptive heartbeat
          activeWs.send(JSON.stringify({ type: 'input', data }));

          // Acknowledge session on first input (reset needs_attention)
          if (!hasAcknowledgedRef.current && sessionName && agentUrl) {
            hasAcknowledgedRef.current = true;
            fetch(`${agentUrl}/api/sessions/${sessionName}/acknowledge`, {
              method: 'POST',
            }).catch(console.error);
          }
        }
      });

      // Debounced resize handler for better mobile performance
      // Uses requestAnimationFrame to ensure computed styles are updated before measuring
      let resizeTimeout: NodeJS.Timeout | null = null;
      handleResize = () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(
          () => {
            // Wait for next paint cycle to ensure computed styles are current
            // This is critical for Chrome DevTools mobile toggle which changes viewport
            // but doesn't trigger standard resize events
            requestAnimationFrame(() => {
              fitAddon.fit();
              // Use wsRef.current to get the active WebSocket (may have been reconnected)
              const activeWs = wsRef.current;
              if (activeWs?.readyState === WebSocket.OPEN) {
                activeWs.send(
                  JSON.stringify({ type: 'resize', cols: currentTerm.cols, rows: currentTerm.rows })
                );
              }
              // Fallback: fit again after layout fully settles
              // Sometimes getComputedStyle returns stale values on first frame
              setTimeout(() => {
                fitAddon.fit();
                const activeWsFallback = wsRef.current;
                if (activeWsFallback?.readyState === WebSocket.OPEN) {
                  activeWsFallback.send(
                    JSON.stringify({
                      type: 'resize',
                      cols: currentTerm.cols,
                      rows: currentTerm.rows,
                    })
                  );
                }
              }, 50);
            });
          },
          isMobile ? 100 : 50
        ); // Longer debounce on mobile for orientation changes
      };
      window.addEventListener('resize', handleResize);

      // Handle orientation change on mobile devices
      if (isMobile && 'orientation' in screen) {
        screen.orientation.addEventListener('change', handleResize);
      }

      // Also handle visual viewport changes (for mobile keyboard)
      if (isMobile && window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
      }

      // Use ResizeObserver to detect container size changes
      resizeObserver = new ResizeObserver(() => {
        handleResize?.();
      });
      resizeObserver.observe(terminalRef.current);

      // Listen to viewport breakpoint changes via matchMedia
      // This is the KEY fix for Chrome DevTools mobile toggle!
      // DevTools emulation doesn't trigger window.resize but DOES trigger CSS media queries
      viewportQueries = [
        // Mobile device sizes (DevTools presets) - critical for DevTools toggle to work!
        window.matchMedia('(max-width: 375px)'), // iPhone SE, mini
        window.matchMedia('(max-width: 390px)'), // iPhone 12/13/14
        window.matchMedia('(max-width: 414px)'), // iPhone Plus
        window.matchMedia('(max-width: 428px)'), // iPhone Pro Max
        window.matchMedia('(max-width: 480px)'), // Small landscape
        // Tailwind breakpoints
        window.matchMedia('(max-width: 640px)'), // sm
        window.matchMedia('(max-width: 768px)'), // md
        window.matchMedia('(max-width: 1024px)'), // lg
        window.matchMedia('(max-width: 1280px)'), // xl
        window.matchMedia('(max-width: 1536px)'), // 2xl
      ];
      const resizeHandler = handleResize; // Capture non-null reference
      viewportQueries.forEach((mq) => mq.addEventListener('change', resizeHandler));
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(connectTimeout);
      intentionalCloseRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      reconnectDelayRef.current = WS_RECONNECT_BASE_DELAY;
      isReconnectRef.current = false;

      // Clean up heartbeat
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = null;
      }
      awaitingPongRef.current = false;

      if (handleResize) {
        window.removeEventListener('resize', handleResize);
        // Clean up mobile-specific listeners
        if (isMobile && 'orientation' in screen) {
          screen.orientation.removeEventListener('change', handleResize);
        }
        if (isMobile && window.visualViewport) {
          window.visualViewport.removeEventListener('resize', handleResize);
        }
      }
      if (handleMouseUp) window.removeEventListener('mouseup', handleMouseUp);
      if (handlePaste && termElement) termElement.removeEventListener('paste', handlePaste);
      // Clean up touch scroll listeners
      if (touchElement && handleTouchStart) {
        touchElement.removeEventListener('touchstart', handleTouchStart);
      }
      if (touchElement && handleTouchMove) {
        touchElement.removeEventListener('touchmove', handleTouchMove);
      }
      if (touchElement && handleTouchEnd) {
        touchElement.removeEventListener('touchend', handleTouchEnd);
      }
      if (touchElement && handleTouchCancel) {
        touchElement.removeEventListener('touchcancel', handleTouchCancel);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      // Clean up matchMedia listeners
      viewportQueries.forEach((mq) => {
        if (handleResize) mq.removeEventListener('change', handleResize);
      });
      viewportQueries = [];

      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000, 'Component unmounting');
      }

      if (wsRef.current === ws) wsRef.current = null;
      if (term) {
        try {
          term.dispose();
        } catch {
          /* ignore */
        }
      }
      if (xtermRef.current === term) xtermRef.current = null;
      if (fitAddonRef.current) fitAddonRef.current = null;
      if (searchAddonRef.current) searchAddonRef.current = null;
    };
    // Note: onSessionCreated, onCopySuccess, and terminalRef are intentionally excluded
    // from deps - they are refs/callbacks that shouldn't cause reconnection
    // ralphConfig is intentionally excluded - it's only used on initial connection for new sessions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentUrl, project, sessionName, environmentId, planningProjectId]);

  // Separate effect to handle isMobile changes dynamically
  // This updates font size without recreating the terminal (more efficient)
  // Critical for Chrome DevTools mobile toggle which doesn't trigger full re-render
  useEffect(() => {
    const term = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    const newFontSize = isMobile ? 11 : 14;
    const newLineHeight = isMobile ? 1.15 : 1.2;

    // Only update if font size actually changed
    if (term.options.fontSize !== newFontSize) {
      term.options.fontSize = newFontSize;
      term.options.lineHeight = newLineHeight;

      // Force xterm to fully recalculate and redraw
      // 1. Refresh all rows to apply new font
      term.refresh(0, term.rows - 1);

      // 2. Force terminal element to recalculate its size
      // The xterm canvas can have stale dimensions after viewport change
      const doFit = () => {
        // Force the terminal element to re-layout
        if (term.element) {
          const parent = term.element.parentElement;
          if (parent) {
            // Get actual container dimensions
            const { clientWidth, clientHeight } = parent;

            // Force terminal element size
            term.element.style.width = `${clientWidth}px`;
            term.element.style.height = `${clientHeight}px`;
          }
        }

        fitAddon.fit();
        term.refresh(0, term.rows - 1);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      };

      // Multiple fit attempts to catch delayed layout changes
      setTimeout(doFit, 0);
      setTimeout(doFit, 100);
      setTimeout(doFit, 250);
    }
  }, [isMobile]);

  return {
    connected,
    connectionState,
    isAtBottom,
    xtermRef,
    searchAddonRef,
    scrollToBottom,
    copySelection,
    startClaude,
    sendInput,
    scrollTerminal,
    triggerResize,
  };
}
