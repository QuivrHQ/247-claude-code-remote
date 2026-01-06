'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { WifiOff } from 'lucide-react';
import { Terminal } from '@/components/Terminal';
import { Editor } from '@/components/Editor';
import { EditorTerminalTabs, type ActiveTab } from '@/components/EditorTerminalTabs';
import { cn } from '@/lib/utils';
import { useSessionContext } from '../SessionContext';

export default function SessionPage() {
  const searchParams = useSearchParams();
  const environmentId = searchParams.get('env') || undefined;

  const {
    sessionName,
    currentProject,
    currentSessionInfo,
    agentUrl,
    handleSessionCreated,
  } = useSessionContext();

  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('terminal');

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      {/* Connection Status Banner */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-1.5',
          'border-b border-white/5',
          isConnected ? 'bg-emerald-500/5' : 'bg-red-500/5'
        )}
      >
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs text-emerald-400">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-xs text-red-400">Disconnected</span>
            </>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <EditorTerminalTabs activeTab={activeTab} onTabChange={setActiveTab} editorEnabled={true} />

      {/* Content based on active tab */}
      {activeTab === 'terminal' ? (
        <Terminal
          key={`${currentProject}-${sessionName}`}
          agentUrl={agentUrl}
          project={currentProject}
          sessionName={sessionName.endsWith('--new') ? undefined : sessionName}
          environmentId={environmentId}
          onConnectionChange={setIsConnected}
          onSessionCreated={handleSessionCreated}
          claudeStatus={currentSessionInfo?.status}
        />
      ) : (
        <Editor key={`editor-${currentProject}`} agentUrl={agentUrl} project={currentProject} />
      )}
    </main>
  );
}
