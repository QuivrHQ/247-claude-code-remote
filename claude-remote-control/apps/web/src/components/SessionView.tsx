'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { SessionStatus } from './ui/status-badge';
import { type SessionInfo } from '@/lib/notifications';
import type { RalphLoopConfig } from '@vibecompany/247-shared';

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
  ralphConfig?: RalphLoopConfig;
  onSessionCreated?: (sessionName: string) => void;
  /** Callback when menu button is clicked (goes back on desktop) */
  onMenuClick: () => void;
  /** Mobile mode for responsive styling */
  isMobile?: boolean;
}

/**
 * SessionView - Minimalist session container.
 * Renders the Terminal for the selected session.
 */
export function SessionView({
  sessionName,
  project,
  agentUrl,
  sessionInfo,
  environmentId,
  ralphConfig,
  onSessionCreated,
  onMenuClick,
  isMobile = false,
}: SessionViewProps) {
  // Connection state tracked but not displayed (shown in MinimalSessionHeader via Terminal)
  const [_isConnected, setIsConnected] = useState(false);

  const isNewSession = sessionName.endsWith('--new');

  const handleSessionCreated = useCallback(
    (actualSessionName: string) => {
      onSessionCreated?.(actualSessionName);
    },
    [onSessionCreated]
  );

  return (
    <Terminal
      key={`${project}-${sessionName}`}
      agentUrl={agentUrl}
      project={project}
      sessionName={isNewSession ? undefined : sessionName}
      environmentId={environmentId}
      ralphConfig={ralphConfig}
      onConnectionChange={setIsConnected}
      onSessionCreated={handleSessionCreated}
      claudeStatus={sessionInfo?.status}
      status={sessionInfo?.status as SessionStatus}
      onMenuClick={onMenuClick}
      isMobile={isMobile}
    />
  );
}
