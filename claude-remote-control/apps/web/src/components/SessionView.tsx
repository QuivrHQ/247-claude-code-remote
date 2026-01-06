'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, WifiOff } from 'lucide-react';
import { Terminal } from './Terminal';
import { FileExplorer } from './FileExplorer';
import { EditorTerminalTabs, type ActiveTab } from './EditorTerminalTabs';
import { StatusBadge, type SessionStatus } from './ui/status-badge';
import { type SessionInfo } from '@/lib/notifications';
import { cn } from '@/lib/utils';

interface SessionViewProps {
  sessionName: string;
  project: string;
  agentUrl: string;
  sessionInfo?: SessionInfo;
  environmentId?: string;
  onBack: () => void;
  onSessionCreated?: (sessionName: string) => void;
}

export function SessionView({
  sessionName,
  project,
  agentUrl,
  sessionInfo,
  environmentId,
  onBack,
  onSessionCreated,
}: SessionViewProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('terminal');

  // Derive display name from session name
  const displayName = sessionName.split('--')[1] || sessionName;
  const isNewSession = sessionName.endsWith('--new');

  const handleSessionCreated = useCallback(
    (actualSessionName: string) => {
      onSessionCreated?.(actualSessionName);
    },
    [onSessionCreated]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2.5',
          'bg-[#0d0d14]/80 backdrop-blur-xl',
          'border-b border-white/5'
        )}
      >
        {/* Left: Back + Session Info */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'text-white/50 hover:text-white hover:bg-white/5',
              'transition-all group'
            )}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="h-5 w-px bg-white/10" />

          {/* Session name */}
          <div className="flex items-center gap-3">
            {sessionInfo && (
              <StatusBadge
                status={sessionInfo.status as SessionStatus}
                size="md"
                showTooltip
              />
            )}
            <div>
              <h1 className="text-base font-semibold text-white font-mono">
                {isNewSession ? 'New Session' : displayName}
              </h1>
              <p className="text-xs text-white/40">{project}</p>
            </div>
          </div>
        </div>

        {/* Right: Connection status */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs text-emerald-400">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-xs text-red-400">Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <EditorTerminalTabs activeTab={activeTab} onTabChange={setActiveTab} editorEnabled={true} />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'terminal' ? (
          <Terminal
            key={`${project}-${sessionName}`}
            agentUrl={agentUrl}
            project={project}
            sessionName={isNewSession ? undefined : sessionName}
            environmentId={environmentId}
            onConnectionChange={setIsConnected}
            onSessionCreated={handleSessionCreated}
            claudeStatus={sessionInfo?.status}
          />
        ) : (
          <FileExplorer key={`files-${project}`} agentUrl={agentUrl} project={project} />
        )}
      </div>
    </div>
  );
}
