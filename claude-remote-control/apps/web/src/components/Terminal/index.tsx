'use client';

import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import type { RalphLoopConfig } from '@vibecompany/247-shared';
import { generateSessionName } from './constants';
import { Toolbar } from './Toolbar';
import { SearchBar } from './SearchBar';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { MobileKeybar } from './MobileKeybar';
import { useTerminalConnection, useTerminalSearch } from './hooks';

interface TerminalProps {
  agentUrl: string;
  project: string;
  sessionName?: string;
  environmentId?: string;
  ralphConfig?: RalphLoopConfig;
  onConnectionChange?: (connected: boolean) => void;
  onSessionCreated?: (sessionName: string) => void;
  claudeStatus?: 'init' | 'working' | 'needs_attention' | 'idle';
  /** Mobile mode for responsive styling and smaller font */
  isMobile?: boolean;
}

export function Terminal({
  agentUrl,
  project,
  sessionName,
  environmentId,
  ralphConfig,
  onConnectionChange,
  onSessionCreated,
  claudeStatus,
  isMobile = false,
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

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
    scrollTerminal,
  } = useTerminalConnection({
    terminalRef,
    agentUrl,
    project,
    sessionName: effectiveSessionName,
    environmentId,
    ralphConfig,
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

  return (
    <div className="relative flex w-full flex-1 flex-col overflow-hidden">
      <Toolbar
        project={project}
        sessionName={effectiveSessionName}
        connectionState={connectionState}
        connected={connected}
        copied={copied}
        searchVisible={searchVisible}
        claudeStatus={claudeStatus}
        onStartClaude={startClaude}
        onCopySelection={copySelection}
        onToggleSearch={toggleSearch}
        isMobile={isMobile}
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

      {/* Mobile virtual keyboard with arrow keys and action buttons */}
      {isMobile && <MobileKeybar onKeyPress={sendInput} onScroll={scrollTerminal} />}
    </div>
  );
}
