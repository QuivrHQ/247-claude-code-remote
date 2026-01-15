'use client';

import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { generateSessionName } from './constants';
import { SearchBar } from './SearchBar';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { MobileKeybar } from './MobileKeybar';
import { KeybarToggleButton } from './KeybarToggleButton';
import { useTerminalConnection, useTerminalSearch } from './hooks';
import { useKeybarVisibility } from '@/hooks/useKeybarVisibility';
import { MinimalSessionHeader } from '@/components/MinimalSessionHeader';
import type { SessionStatus } from '@/components/ui/status-badge';

interface TerminalProps {
  agentUrl: string;
  project: string;
  sessionName?: string;
  environmentId?: string;
  planningProjectId?: string;
  onConnectionChange?: (connected: boolean) => void;
  onSessionCreated?: (sessionName: string) => void;
  claudeStatus?: 'init' | 'working' | 'needs_attention' | 'idle';
  /** Session status for status indicator */
  status?: SessionStatus;
  /** Callback when menu button is clicked (opens sidebar) */
  onMenuClick: () => void;
  /** Mobile mode for responsive styling and smaller font */
  isMobile?: boolean;
  // StatusLine metrics
  model?: string;
  costUsd?: number;
  contextUsage?: number;
}

export function Terminal({
  agentUrl,
  project,
  sessionName,
  environmentId,
  planningProjectId,
  onConnectionChange,
  onSessionCreated,
  claudeStatus,
  status,
  onMenuClick,
  isMobile = false,
  model,
  costUsd,
  contextUsage,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { isVisible: keybarVisible, toggle: toggleKeybar } = useKeybarVisibility();

  // Generate session name ONCE on first render, persisted across re-mounts
  const generatedSessionRef = useRef<string | null>(null);
  if (!sessionName && !generatedSessionRef.current) {
    generatedSessionRef.current = generateSessionName(project);
  }
  const effectiveSessionName = sessionName || generatedSessionRef.current || '';

  const handleCopySuccess = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const {
    connected,
    connectionState,
    isAtBottom,
    xtermRef,
    searchAddonRef,
    scrollToBottom,
    copySelection,
    startClaude,
    sendInput,
    triggerResize,
  } = useTerminalConnection({
    terminalRef,
    agentUrl,
    project,
    sessionName: effectiveSessionName,
    environmentId,
    planningProjectId,
    onSessionCreated,
    onCopySuccess: handleCopySuccess,
    isMobile,
  });

  const {
    searchVisible,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    toggleSearch,
    closeSearch,
    findNext,
    findPrevious,
  } = useTerminalSearch(searchAddonRef, xtermRef);

  // Notify parent of connection changes
  useEffect(() => {
    onConnectionChange?.(connected);
  }, [connected, onConnectionChange]);

  // Trigger terminal resize when keybar visibility changes (mobile only)
  useEffect(() => {
    if (!isMobile) return;
    // Small delay to allow CSS transition to start
    const timer = setTimeout(() => {
      triggerResize();
    }, 50);
    return () => clearTimeout(timer);
  }, [keybarVisible, isMobile, triggerResize]);

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden">
      <MinimalSessionHeader
        sessionName={effectiveSessionName}
        status={status}
        connectionState={connectionState}
        connected={connected}
        copied={copied}
        searchVisible={searchVisible}
        claudeStatus={claudeStatus}
        isMobile={isMobile}
        onMenuClick={onMenuClick}
        onStartClaude={startClaude}
        onCopySelection={copySelection}
        onToggleSearch={toggleSearch}
        model={model}
        costUsd={costUsd}
        contextUsage={contextUsage}
      />

      <SearchBar
        ref={searchInputRef}
        visible={searchVisible}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onFindNext={findNext}
        onFindPrevious={findPrevious}
        onClose={closeSearch}
      />

      {/* Terminal container - NO padding! FitAddon reads offsetHeight which includes padding,
          but xterm renders inside padding box, causing dimension mismatch */}
      {/* touch-action: none is CRITICAL for mobile - prevents browser from intercepting touch events */}
      <div
        ref={terminalRef}
        className="min-h-0 w-full flex-1 overflow-hidden bg-[#0a0a10]"
        style={isMobile ? { touchAction: 'none' } : undefined}
      />

      <ScrollToBottomButton visible={!isAtBottom} onClick={scrollToBottom} />

      {/* Mobile: Keybar toggle button and virtual keyboard */}
      {isMobile && (
        <>
          <KeybarToggleButton isVisible={keybarVisible} onToggle={toggleKeybar} />
          <MobileKeybar onKeyPress={sendInput} visible={keybarVisible} />
        </>
      )}
    </div>
  );
}
