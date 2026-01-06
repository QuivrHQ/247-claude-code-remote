'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { CanvasAddon } from '@xterm/addon-canvas';
import '@xterm/xterm/css/xterm.css';
import { Search, ChevronUp, ChevronDown, X, ArrowDown, Sparkles, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalProps {
  agentUrl: string;
  project: string;
  sessionName?: string;
  environmentId?: string;
  onConnectionChange?: (connected: boolean) => void;
  onSessionCreated?: (sessionName: string) => void;
  claudeStatus?: 'init' | 'working' | 'needs_attention' | 'idle';
}

// Generate human-readable session names with project prefix (same as agent)
function generateSessionName(project: string): string {
  const adjectives = ['brave', 'swift', 'calm', 'bold', 'wise', 'keen', 'fair', 'wild', 'bright', 'cool'];
  const nouns = ['lion', 'hawk', 'wolf', 'bear', 'fox', 'owl', 'deer', 'lynx', 'eagle', 'tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${project}--${adj}-${noun}-${num}`;
}

export function Terminal({ agentUrl, project, sessionName, environmentId, onConnectionChange, onSessionCreated, claudeStatus }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const isSelectingRef = useRef(false);

  // Generate session name ONCE on first render, persisted across re-mounts
  const generatedSessionRef = useRef<string | null>(null);
  if (!sessionName && !generatedSessionRef.current) {
    generatedSessionRef.current = generateSessionName(project);
  }
  const effectiveSessionName = sessionName || generatedSessionRef.current || '';

  // Notify parent of connection changes
  useEffect(() => {
    onConnectionChange?.(connected);
  }, [connected, onConnectionChange]);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.scrollToBottom();
    }
  }, []);

  // Copy terminal selection
  const copySelection = useCallback(() => {
    if (xtermRef.current) {
      const selection = xtermRef.current.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, []);

  // Search handlers
  const findNext = useCallback(() => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findNext(searchQuery, {
        regex: false,
        caseSensitive: false,
        incremental: true,
      });
    }
  }, [searchQuery]);

  const findPrevious = useCallback(() => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findPrevious(searchQuery, {
        regex: false,
        caseSensitive: false,
      });
    }
  }, [searchQuery]);

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setSearchQuery('');
    if (searchAddonRef.current) {
      searchAddonRef.current.clearDecorations();
    }
    xtermRef.current?.focus();
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + F = Open search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setSearchVisible(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      // Escape = Close search
      if (e.key === 'Escape' && searchVisible) {
        closeSearch();
      }
      // Enter in search = Find next
      if (
        e.key === 'Enter' &&
        searchVisible &&
        document.activeElement === searchInputRef.current
      ) {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible, findNext, findPrevious, closeSearch]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Track cleanup state and resources
    let cancelled = false;
    let term: XTerm | null = null;
    let ws: WebSocket | null = null;
    let handleResize: (() => void) | null = null;
    let handleMouseUp: (() => void) | null = null;

    // Debounce connection to avoid React Strict Mode double-mount issues
    const connectTimeout = setTimeout(() => {
      if (cancelled || !terminalRef.current) return;

      // Initialize xterm.js with enhanced options
      term = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Monaco, "Courier New", monospace',
        fontWeight: '400',
        fontWeightBold: '600',
        letterSpacing: 0,
        lineHeight: 1.2,
        scrollback: 15000,
        scrollSensitivity: 1,
        fastScrollSensitivity: 5,
        fastScrollModifier: 'alt',
        smoothScrollDuration: 100,
        cursorStyle: 'bar',
        cursorWidth: 2,
        allowProposedApi: true,
        theme: {
          background: '#0a0a10',
          foreground: '#e4e4e7',
          cursor: '#f97316',
          cursorAccent: '#0a0a10',
          selectionBackground: 'rgba(249, 115, 22, 0.3)',
          selectionForeground: '#ffffff',
          black: '#18181b',
          red: '#f87171',
          green: '#4ade80',
          yellow: '#fbbf24',
          blue: '#60a5fa',
          magenta: '#c084fc',
          cyan: '#22d3ee',
          white: '#e4e4e7',
          brightBlack: '#52525b',
          brightRed: '#fca5a5',
          brightGreen: '#86efac',
          brightYellow: '#fde047',
          brightBlue: '#93c5fd',
          brightMagenta: '#d8b4fe',
          brightCyan: '#67e8f9',
          brightWhite: '#fafafa',
        },
      });

      // Load addons
      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      term.loadAddon(searchAddon);

      term.open(terminalRef.current);

      // Enable Cmd+C / Ctrl+C to copy when there's a selection
      const currentTermForKeys = term;
      term.attachCustomKeyEventHandler((event) => {
        // Cmd+C (Mac) or Ctrl+C (Windows/Linux) with selection = copy
        if ((event.metaKey || event.ctrlKey) && event.key === 'c' && currentTermForKeys.hasSelection()) {
          const selection = currentTermForKeys.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
          return false; // Prevent terminal from receiving Ctrl+C
        }
        // Cmd+V (Mac) or Ctrl+V (Windows/Linux) = paste
        if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
          navigator.clipboard.readText().then((text) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'input', data: text }));
            }
          });
          return false; // Prevent default paste behavior
        }
        return true; // Let other keys pass through
      });

      // Use Canvas renderer (more reliable for text selection)
      // WebGL can sometimes interfere with mouse selection
      term.loadAddon(new CanvasAddon());

      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      // Track mouse selection to prevent re-renders during selection
      const handleMouseDown = () => {
        isSelectingRef.current = true;
      };
      handleMouseUp = () => {
        // Delay to let xterm finalize selection before allowing re-renders
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 100);
      };
      term.element?.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);

      // Track scroll position (skip during selection to prevent re-render breaking selection)
      term.onScroll(() => {
        if (!term || isSelectingRef.current) return;
        const buffer = term.buffer.active;
        const isBottom = buffer.viewportY >= buffer.baseY;
        setIsAtBottom(isBottom);
      });

      // Connect WebSocket
      const wsProtocol = agentUrl.includes('localhost') ? 'ws' : 'wss';
      let wsUrl = `${wsProtocol}://${agentUrl}/terminal?project=${encodeURIComponent(project)}&session=${encodeURIComponent(effectiveSessionName)}`;
      if (environmentId) {
        wsUrl += `&environment=${encodeURIComponent(environmentId)}`;
      }
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const currentTerm = term;
      const currentWs = ws;

      currentWs.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        currentTerm.write('\x1b[38;5;245m┌─ Connected to ' + agentUrl + ' ─┐\x1b[0m\r\n\r\n');

        currentWs.send(
          JSON.stringify({
            type: 'resize',
            cols: currentTerm.cols,
            rows: currentTerm.rows,
          })
        );

        // Notify parent of the actual session name being used
        if (onSessionCreated && effectiveSessionName) {
          onSessionCreated(effectiveSessionName);
        }
      };

      currentWs.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') return;
          if (msg.type === 'history') {
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
        currentTerm.write('\r\n\x1b[38;5;245m└─ Disconnected ─┘\x1b[0m\r\n');
      };

      currentWs.onerror = (err) => {
        if (cancelled) return;
        console.error('WebSocket error:', err);
        currentTerm.write('\r\n\x1b[31m✗ Connection error\x1b[0m\r\n');
      };

      currentTerm.onData((data) => {
        if (currentWs.readyState === WebSocket.OPEN) {
          currentWs.send(JSON.stringify({ type: 'input', data }));
        }
      });

      handleResize = () => {
        fitAddon.fit();
        if (currentWs.readyState === WebSocket.OPEN) {
          currentWs.send(
            JSON.stringify({
              type: 'resize',
              cols: currentTerm.cols,
              rows: currentTerm.rows,
            })
          );
        }
      };

      window.addEventListener('resize', handleResize);
    }, 150); // 150ms debounce to let React Strict Mode cleanup complete

    // Cleanup
    return () => {
      cancelled = true;
      clearTimeout(connectTimeout);

      if (handleResize) {
        window.removeEventListener('resize', handleResize);
      }
      if (handleMouseUp) {
        window.removeEventListener('mouseup', handleMouseUp);
      }

      // Close WebSocket properly
      if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Component unmounting');
        }
      }

      // Clear WebSocket ref
      if (wsRef.current === ws) {
        wsRef.current = null;
      }

      // Dispose terminal
      if (term) {
        try {
          term.dispose();
        } catch {
          // Ignore disposal errors during cleanup
        }
      }

      // Clear terminal refs
      if (xtermRef.current === term) {
        xtermRef.current = null;
      }
      if (fitAddonRef.current) {
        fitAddonRef.current = null;
      }
      if (searchAddonRef.current) {
        searchAddonRef.current = null;
      }
    };
  }, [agentUrl, project, effectiveSessionName, environmentId]);

  // Search effect
  useEffect(() => {
    if (searchQuery && searchAddonRef.current) {
      findNext();
    }
  }, [searchQuery, findNext]);

  const startClaude = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start-claude' }));
    }
  };

  return (
    <div className="flex flex-col flex-1 relative overflow-hidden">
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2',
          'bg-[#0d0d14]/80 backdrop-blur-sm',
          'border-b border-white/5'
        )}
      >
        {/* Project & Session Info */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/60">{project}</span>
          <span className="text-white/20">/</span>
          <span className="text-sm font-mono text-white/40">
            {effectiveSessionName.split('--')[1] || 'new session'}
          </span>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Start Claude Button - hidden when Claude is working */}
          {claudeStatus !== 'working' && (
            <button
              onClick={startClaude}
              disabled={!connected}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                'text-sm font-medium transition-all',
                connected
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              )}
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Claude</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            onClick={copySelection}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'text-white/40 hover:text-white hover:bg-white/5'
            )}
            title="Copy selection"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Search Button */}
          <button
            onClick={() => {
              setSearchVisible(!searchVisible);
              if (!searchVisible) {
                setTimeout(() => searchInputRef.current?.focus(), 0);
              }
            }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              searchVisible
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            )}
            title="Search (⌘⇧F)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchVisible && (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2',
            'bg-[#0d0d14]/90 backdrop-blur-sm',
            'border-b border-white/5'
          )}
        >
          <Search className="w-4 h-4 text-white/30" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in terminal..."
            className={cn(
              'flex-1 bg-transparent text-sm text-white placeholder:text-white/30',
              'focus:outline-none'
            )}
          />
          <div className="flex items-center gap-1">
            <button
              onClick={findPrevious}
              className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="Previous (⇧↵)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={findNext}
              className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="Next (↵)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={closeSearch}
              className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Terminal */}
      <div
        ref={terminalRef}
        className="flex-1 bg-[#0a0a10] px-2 py-1"
      />

      {/* Scroll to bottom indicator */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-6 right-6 p-3',
            'bg-orange-500/90 hover:bg-orange-400 backdrop-blur-sm',
            'text-white rounded-full shadow-xl shadow-orange-500/30',
            'transition-all hover:scale-105 active:scale-95',
            'animate-bounce'
          )}
          title="Scroll to bottom"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
