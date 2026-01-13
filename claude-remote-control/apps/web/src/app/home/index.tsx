'use client';

import { useState } from 'react';
import { Zap, Loader2, ArrowDown } from 'lucide-react';
import { HomeSidebar } from '@/components/HomeSidebar';
import { SessionView } from '@/components/SessionView';
import { NewSessionModal } from '@/components/NewSessionModal';
import { AgentConnectionSettings } from '@/components/AgentConnectionSettings';
import { UnifiedAgentManager } from '@/components/UnifiedAgentManager';
import { MobileStatusStrip } from '@/components/mobile';
import { InstallBanner } from '@/components/InstallBanner';
import { SlideOverPanel } from '@/components/ui/SlideOverPanel';
import { ConnectionGuide } from '@/components/ConnectionGuide';
import { EnvironmentsList } from '@/components/EnvironmentsList';
import { DeployAgentModal, type DeployedAgent } from '@/components/DeployAgentModal';
import { CloudConfigPanel } from '@/components/CloudConfigPanel';
import { FlyioLinkModal } from '@/components/FlyioLinkModal';
import { MultiAgentHeader, type ConnectedAgent } from '@/components/MultiAgentHeader';
import { LoadingView } from './LoadingView';
import { NoConnectionView } from './NoConnectionView';
import { CloudWelcomeView } from './CloudWelcomeView';
import { useHomeState } from './useHomeState';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
import { useFlyioStatus } from '@/hooks/useFlyioStatus';
import { useAgents, type CloudAgent } from '@/hooks/useAgents';

// Check if cloud auth is enabled
const isCloudEnabled = !!process.env.NEXT_PUBLIC_PROVISIONING_URL;

// Import useAuth only if cloud is enabled (will be tree-shaken if not used)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const authModule = isCloudEnabled ? require('@/contexts/AuthContext') : null;

// Default auth state when cloud is disabled
const defaultAuthState = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  signInWithGitHub: async () => {},
  signOut: async () => {},
};

const PROVISIONING_URL = process.env.NEXT_PUBLIC_PROVISIONING_URL;

export function HomeContent() {
  const isMobile = useIsMobile();
  // Call useAuth unconditionally (it's a no-op when cloud is disabled via AuthProvider check)
  const auth = authModule ? authModule.useAuth() : defaultAuthState;

  // Fetch Fly.io connection status when authenticated
  const {
    status: flyioStatus,
    isLoading: flyioLoading,
    refresh: refreshFlyioStatus,
  } = useFlyioStatus(auth.isAuthenticated);

  // Fetch deployed cloud agents when authenticated
  const {
    agents,
    isLoading: agentsLoading,
    refresh: refreshAgents,
    startAgent,
    stopAgent,
    deleteAgent,
  } = useAgents(auth.isAuthenticated);

  // Set CSS variable for viewport height (handles mobile keyboard)
  useViewportHeight();

  const {
    loading,
    agentConnection,
    agentConnections,
    connectionModalOpen,
    setConnectionModalOpen,
    newSessionOpen,
    setNewSessionOpen,
    selectedSession,
    setSelectedSession,
    isFullscreen,
    setIsFullscreen,
    allSessions,
    needsAttention,
    currentMachine,
    machines,
    getArchivedSessions,
    getAgentUrl,
    getSelectedSessionInfo,
    handleSelectSession,
    handleStartSession,
    handleSessionCreated,
    handleSessionKilled,
    handleSessionArchived,
    handleConnectionSaved,
    handleConnectionRemoved,
    handleConnectionCleared,
    clearSessionFromUrl,
  } = useHomeState();

  // Get session count per agent for the header
  const { sessionsByMachine, isWsConnected } = useSessionPolling();

  // Convert agentConnections to ConnectedAgent format for the header
  const connectedAgents: ConnectedAgent[] = agentConnections.map((conn) => {
    const machineData = sessionsByMachine.get(conn.id);
    const wsConnected = isWsConnected(conn.id);
    return {
      id: conn.id,
      name: conn.name,
      url: conn.url,
      method: conn.method,
      status: machineData?.error ? 'offline' : wsConnected ? 'online' : 'connecting',
      sessionCount: machineData?.sessions?.length ?? 0,
    };
  });

  // Slide-over panel states
  const [guideOpen, setGuideOpen] = useState(false);
  const [environmentsOpen, setEnvironmentsOpen] = useState(false);
  const [cloudConfigOpen, setCloudConfigOpen] = useState(false);
  const [flyioLinkModalOpen, setFlyioLinkModalOpen] = useState(false);
  const [unifiedManagerOpen, setUnifiedManagerOpen] = useState(false);

  // Create agent status and session count maps for UnifiedAgentManager
  const agentStatuses = new Map<string, 'online' | 'offline' | 'connecting'>();
  const sessionCountsMap = new Map<string, number>();
  agentConnections.forEach((conn) => {
    const machineData = sessionsByMachine.get(conn.id);
    const wsConnected = isWsConnected(conn.id);
    agentStatuses.set(
      conn.id,
      machineData?.error ? 'offline' : wsConnected ? 'online' : 'connecting'
    );
    sessionCountsMap.set(conn.id, machineData?.sessions?.length ?? 0);
  });

  // Pull-to-refresh for mobile PWA
  const { refreshMachine } = useSessionPolling();
  const { pullDistance, isRefreshing, isPulling, isThresholdReached, handlers } = usePullToRefresh({
    onRefresh: async () => {
      if (currentMachine) {
        await refreshMachine(currentMachine.id);
      }
    },
    disabled: !isMobile,
  });

  // State for deploy modal
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  // Handler for disconnecting Fly.io
  const handleFlyioDisconnect = async () => {
    if (!PROVISIONING_URL) return;
    try {
      await fetch(`${PROVISIONING_URL}/api/flyio/token`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await refreshFlyioStatus();
    } catch (error) {
      console.error('Failed to disconnect Fly.io:', error);
    }
  };

  // Handler for launching cloud agent - opens the deploy modal
  const handleLaunchAgent = () => {
    setDeployModalOpen(true);
  };

  // Handler for successful agent deployment - auto-connect to the new agent
  const handleDeploySuccess = (agent: DeployedAgent) => {
    // Refresh the agents list to show the new agent
    refreshAgents();
    // Save the agent as a connection and connect to it
    // Use 'custom' method since it's a cloud-hosted agent via Fly.io
    handleConnectionSaved({
      url: `wss://${agent.hostname}`,
      name: `Cloud Agent (${agent.region})`,
      method: 'custom',
    });
  };

  // Handler for connecting to an existing cloud agent
  // If the agent is sleeping (stopped), trigger a wake first via API
  // This is faster than waiting for Fly.io proxy auto-wake
  const handleConnectAgent = async (agent: CloudAgent) => {
    // If agent is stopped/sleeping, trigger wake via API (don't wait for it)
    if (agent.status === 'stopped') {
      startAgent(agent.id).catch(() => {
        // Ignore errors - Fly.io proxy will auto-wake anyway
      });
    }
    // Save connection immediately - WebSocket will retry if machine isn't ready yet
    handleConnectionSaved({
      url: `wss://${agent.hostname}`,
      name: `Cloud Agent (${agent.region})`,
      method: 'custom',
    });
  };

  if (loading || auth.isLoading) {
    return <LoadingView />;
  }

  // Show CloudWelcomeView if authenticated but no local agent connected
  // This prompts the user to connect Fly.io to deploy a cloud agent
  if (!agentConnection && auth.isAuthenticated && auth.user) {
    return (
      <>
        <CloudWelcomeView
          user={auth.user}
          flyioStatus={flyioStatus}
          flyioLoading={flyioLoading}
          onSignOut={auth.signOut}
          onConnectionSaved={handleConnectionSaved}
          onFlyioConnected={refreshFlyioStatus}
          onFlyioDisconnect={handleFlyioDisconnect}
          onLaunchAgent={handleLaunchAgent}
          agents={agents}
          agentsLoading={agentsLoading}
          onConnectAgent={handleConnectAgent}
          onStartAgent={startAgent}
          onStopAgent={stopAgent}
          onDeleteAgent={deleteAgent}
        />
        <DeployAgentModal
          open={deployModalOpen}
          onOpenChange={setDeployModalOpen}
          onSuccess={handleDeploySuccess}
        />
      </>
    );
  }

  // Show NoConnectionView if not authenticated and no local agent
  if (!agentConnection) {
    return (
      <NoConnectionView
        modalOpen={connectionModalOpen}
        onModalOpenChange={setConnectionModalOpen}
        onConnectionSaved={handleConnectionSaved}
        onCloudSignIn={isCloudEnabled ? auth.signInWithGitHub : undefined}
      />
    );
  }

  // Handler for menu button in session view (desktop only - goes back to session list)
  const handleMenuClick = () => {
    setSelectedSession(null);
    clearSessionFromUrl();
  };

  // Connected state - Split View Layout
  return (
    <main
      className="h-screen-safe flex flex-col overflow-hidden bg-[#0a0a10]"
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {isMobile && (isPulling || isRefreshing) && (
        <div
          className="pointer-events-none fixed left-0 right-0 z-50 flex justify-center"
          style={{
            top: 0,
            transform: `translateY(${Math.min(pullDistance - 30, 50)}px)`,
            opacity: Math.min(pullDistance / 40, 1),
            transition: isRefreshing ? 'none' : 'opacity 0.1s ease-out',
          }}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isThresholdReached || isRefreshing
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-white/10 text-white/60'
            }`}
            style={{
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowDown
                className="h-5 w-5 transition-transform duration-150"
                style={{
                  transform: isThresholdReached ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile Status Strip - always visible on mobile when connected */}
      {isMobile && (
        <MobileStatusStrip
          sessions={allSessions}
          currentSession={selectedSession}
          onSelectSession={handleSelectSession}
          onNewSession={() => setNewSessionOpen(true)}
          onOpenGuide={() => setGuideOpen(true)}
          onOpenEnvironments={() => setEnvironmentsOpen(true)}
          onConnectionSettingsClick={() => setUnifiedManagerOpen(true)}
          onSessionKilled={handleSessionKilled}
        />
      )}

      {/* Header - always visible on desktop */}
      {!isMobile && (
        <MultiAgentHeader
          agents={connectedAgents}
          totalSessionCount={allSessions.length}
          needsAttention={needsAttention}
          onAddAgent={() => setUnifiedManagerOpen(true)}
          onDisconnectAgent={handleConnectionRemoved}
          onNewSession={() => setNewSessionOpen(true)}
          onOpenGuide={() => setGuideOpen(true)}
          onOpenEnvironments={() => setEnvironmentsOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          isMobile={false}
        />
      )}

      {/* Main Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar - hidden on mobile and in fullscreen */}
        {!isFullscreen && !isMobile && (
          <HomeSidebar
            sessions={allSessions}
            archivedSessions={getArchivedSessions()}
            selectedSession={selectedSession}
            onSelectSession={handleSelectSession}
            onDeselectSession={handleMenuClick}
            onSessionKilled={handleSessionKilled}
            onSessionArchived={handleSessionArchived}
          />
        )}

        {/* Main Content Area */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {selectedSession ? (
            <SessionView
              key={`${selectedSession.machineId}-${selectedSession.project}-${selectedSession.sessionName.endsWith('--new') ? 'new' : selectedSession.sessionName}`}
              sessionName={selectedSession.sessionName}
              project={selectedSession.project}
              agentUrl={getAgentUrl()}
              sessionInfo={getSelectedSessionInfo()}
              environmentId={selectedSession.environmentId}
              ralphConfig={selectedSession.ralphConfig}
              planningProjectId={selectedSession.planningProjectId}
              onMenuClick={handleMenuClick}
              onSessionCreated={handleSessionCreated}
              isMobile={isMobile}
            />
          ) : (
            // Empty state when no session selected
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/10 bg-orange-500/5">
                  <Zap className="h-8 w-8 text-orange-500/30" />
                </div>
                <p className="text-sm text-white/40">Select a session or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Settings Modal (legacy fallback) */}
      <AgentConnectionSettings
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
        onSave={handleConnectionSaved}
        onDisconnect={handleConnectionCleared}
        hasConnection={!!agentConnection}
      />

      {/* Unified Agent Manager */}
      <UnifiedAgentManager
        open={unifiedManagerOpen}
        onClose={() => setUnifiedManagerOpen(false)}
        connectedAgents={agentConnections}
        agentStatuses={agentStatuses}
        sessionCounts={sessionCountsMap}
        onDisconnectAgent={handleConnectionRemoved}
        onConnectNewAgent={handleConnectionSaved}
        isAuthenticated={auth.isAuthenticated}
        flyioStatus={flyioStatus}
        flyioLoading={flyioLoading}
        cloudAgents={agents}
        cloudAgentsLoading={agentsLoading}
        onSignIn={isCloudEnabled ? auth.signInWithGitHub : undefined}
        onFlyioConnect={() => setFlyioLinkModalOpen(true)}
        onFlyioDisconnect={handleFlyioDisconnect}
        onLaunchCloudAgent={() => {
          setUnifiedManagerOpen(false);
          setDeployModalOpen(true);
        }}
        onStartCloudAgent={startAgent}
        onStopCloudAgent={stopAgent}
        onDeleteCloudAgent={deleteAgent}
      />

      {/* New Session Modal */}
      <NewSessionModal
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        machines={machines}
        onStartSession={handleStartSession}
      />

      {/* Guide Slide-Over Panel */}
      <SlideOverPanel open={guideOpen} onClose={() => setGuideOpen(false)} title="Connection Guide">
        <ConnectionGuide />
      </SlideOverPanel>

      {/* Environments Slide-Over Panel */}
      <SlideOverPanel
        open={environmentsOpen}
        onClose={() => setEnvironmentsOpen(false)}
        title="Environments"
      >
        <EnvironmentsList machines={machines} />
      </SlideOverPanel>

      {/* Cloud Config Slide-Over Panel */}
      {isCloudEnabled && (
        <SlideOverPanel
          open={cloudConfigOpen}
          onClose={() => setCloudConfigOpen(false)}
          title="Cloud Configuration"
        >
          <CloudConfigPanel
            isAuthenticated={auth.isAuthenticated}
            flyioStatus={flyioStatus}
            flyioLoading={flyioLoading}
            agents={agents}
            agentsLoading={agentsLoading}
            onSignIn={auth.signInWithGitHub}
            onFlyioDisconnect={handleFlyioDisconnect}
            onLaunchAgent={() => {
              setCloudConfigOpen(false);
              setDeployModalOpen(true);
            }}
            onConnectAgent={(agent) => {
              setCloudConfigOpen(false);
              handleConnectAgent(agent);
            }}
            onStartAgent={startAgent}
            onStopAgent={stopAgent}
            onDeleteAgent={deleteAgent}
            onReconnectFlyio={() => {
              setCloudConfigOpen(false);
              setFlyioLinkModalOpen(true);
            }}
          />
        </SlideOverPanel>
      )}

      {/* Fly.io Link Modal for reconnection */}
      <FlyioLinkModal
        open={flyioLinkModalOpen}
        onOpenChange={setFlyioLinkModalOpen}
        onSuccess={refreshFlyioStatus}
      />

      {/* PWA Install Banner - only on mobile */}
      {isMobile && <InstallBanner />}
    </main>
  );
}
