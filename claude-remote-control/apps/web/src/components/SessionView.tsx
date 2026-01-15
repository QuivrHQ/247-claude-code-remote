'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { SessionStatus } from './ui/status-badge';
import { type SessionInfo } from '@/lib/notifications';

const Terminal = dynamic(() => import('./Terminal').then((mod) => mod.Terminal), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[#0d0d14]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500" />
    </div>
  ),
});

interface SessionViewProps {
  sessionName: string;
  project: string;
  agentUrl: string;
  sessionInfo?: SessionInfo;
  environmentId?: string;
  planningProjectId?: string;
  onSessionCreated?: (sessionName: string) => void;
  /** Callback when menu button is clicked (goes back on desktop) */
  onMenuClick: () => void;
  /** Mobile mode for responsive styling */
  isMobile?: boolean;
}

/**
 * SessionView - Minimalist session container.
 * Renders a Terminal with tmux session.
 */
export function SessionView({
  sessionName,
  project,
  agentUrl,
  sessionInfo,
  environmentId,
  planningProjectId,
  onSessionCreated,
  onMenuClick,
  isMobile = false,
}: SessionViewProps) {
  // Connection state tracked but not displayed (shown in MinimalSessionHeader via Terminal)
  const [_isConnected, setIsConnected] = useState(false);

  const isNewSession = sessionName.endsWith('--new');

  // Use a ref to store the initial key and keep it stable throughout the component's lifecycle.
  // This prevents Terminal remount when sessionName changes from 'project--new' to actual name.
  // Without this, the history clear would happen before Ralph Loop command is written.
  const terminalKeyRef = useRef<string | null>(null);
  if (terminalKeyRef.current === null) {
    terminalKeyRef.current = isNewSession ? `${project}-new-session` : `${project}-${sessionName}`;
  }
  const terminalKey = terminalKeyRef.current;

  const handleSessionCreated = useCallback(
    (actualSessionName: string) => {
      // Notify parent of session creation
      onSessionCreated?.(actualSessionName);
    },
    [onSessionCreated]
  );

  return (
    <Terminal
      key={terminalKey}
      agentUrl={agentUrl}
      project={project}
      sessionName={isNewSession ? undefined : sessionName}
      environmentId={environmentId}
      planningProjectId={planningProjectId}
      onConnectionChange={setIsConnected}
      onSessionCreated={handleSessionCreated}
      claudeStatus={sessionInfo?.status}
      status={sessionInfo?.status as SessionStatus}
      onMenuClick={onMenuClick}
      isMobile={isMobile}
      // StatusLine metrics
      model={sessionInfo?.model}
      costUsd={sessionInfo?.costUsd}
      contextUsage={sessionInfo?.contextUsage}
    />
  );
}
