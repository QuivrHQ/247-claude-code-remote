'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Zap, Loader2, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/utils';
import { SessionView } from '@/components/SessionView';
import { NewSessionModal } from '@/components/NewSessionModal';
import { AgentConnectionSettings } from '@/components/AgentConnectionSettings';
import { MobileStatusStrip } from '@/components/mobile';
import { InstallBanner } from '@/components/InstallBanner';
import { SlideOverPanel } from '@/components/ui/SlideOverPanel';
import { ConnectionGuide } from '@/components/ConnectionGuide';
import { LoadingView } from './LoadingView';
import { NoConnectionView } from './NoConnectionView';
import { useHomeState } from './useHomeState';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useSoundNotifications } from '@/hooks/useSoundNotifications';
import { NotificationSettingsPanel } from '@/components/NotificationSettingsPanel';
import { useSessionPolling } from '@/contexts/SessionPollingContext';
// Layout components
import { AppShell } from '@/components/layout';
import type { SessionListItem } from '@/components/layout/SessionListPanel';
import type { SessionStatus } from '@/components/ui/status-indicator';

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function mapSessionStatus(session: { status?: string }): SessionStatus {
  if (session.status === 'working') return 'working';
  if (session.status === 'needs_attention') return 'needs_attention';
  if (session.status === 'init') return 'init';
  return 'idle';
}

export function HomeContent() {
  const isMobile = useIsMobile();

  useViewportHeight();

  const { soundEnabled, getSelectedSoundPath } = useNotificationPreferences();
  const { playSound } = useSoundNotifications({ soundPath: getSelectedSoundPath() });

  const {
    loading,
    agentUrl,
    connectionModalOpen,
    setConnectionModalOpen,
    newSessionOpen,
    setNewSessionOpen,
    selectedSession,
    setSelectedSession,
    isFullscreen,
    setIsFullscreen,
    sessions,
    getSelectedSessionInfo,
    handleSelectSession,
    handleStartSession,
    handleSessionCreated,
    handleSessionKilled,
    handleSessionArchived,
    handleConnectionSaved,
    handleDisconnect,
    clearSessionFromUrl,
  } = useHomeState();

  const { refreshSessions, setOnNeedsAttention } = useSessionPolling();

  useEffect(() => {
    if (soundEnabled) {
      setOnNeedsAttention(() => {
        playSound();
      });
    } else {
      setOnNeedsAttention(undefined);
    }
    return () => setOnNeedsAttention(undefined);
  }, [soundEnabled, playSound, setOnNeedsAttention]);

  const [guideOpen, setGuideOpen] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);

  const sessionListItems: SessionListItem[] = useMemo(
    () =>
      sessions.map((session) => ({
        id: session.name,
        name: session.name,
        project: session.project,
        status: mapSessionStatus(session),
        updatedAt: new Date(session.lastActivity || session.createdAt),
        createdAt: new Date(session.createdAt),
        model: session.model,
        cost: session.costUsd,
      })),
    [sessions]
  );

  const selectedSessionId = selectedSession ? selectedSession.sessionName : null;

  const handleSelectSessionFromList = useCallback(
    (item: SessionListItem) => {
      if (item.status === 'needs_attention' && agentUrl) {
        fetch(
          buildApiUrl(agentUrl, `/api/sessions/${encodeURIComponent(item.name)}/acknowledge`),
          { method: 'POST' }
        ).catch(console.error);
      }
      handleSelectSession(item.name, item.project);
    },
    [handleSelectSession, agentUrl]
  );

  const handleKillSessionFromList = useCallback(
    async (item: SessionListItem) => {
      if (!agentUrl) {
        toast.error('Agent not connected');
        return;
      }

      try {
        const response = await fetch(
          buildApiUrl(agentUrl, `/api/sessions/${encodeURIComponent(item.name)}`),
          { method: 'DELETE' }
        );

        if (response.ok) {
          toast.success('Session terminated');
          handleSessionKilled(item.name);
        } else {
          toast.error('Failed to terminate session');
        }
      } catch (err) {
        console.error('Failed to kill session:', err);
        toast.error('Could not connect to agent');
      }
    },
    [agentUrl, handleSessionKilled]
  );

  const handleArchiveSessionFromList = useCallback(
    async (item: SessionListItem) => {
      if (!agentUrl) {
        toast.error('Agent not connected');
        return;
      }

      try {
        const response = await fetch(
          buildApiUrl(agentUrl, `/api/sessions/${encodeURIComponent(item.name)}/archive`),
          { method: 'POST' }
        );

        if (response.ok) {
          toast.success('Session archived');
          handleSessionArchived(item.name);
        } else {
          toast.error('Failed to archive session');
        }
      } catch (err) {
        console.error('Failed to archive session:', err);
        toast.error('Could not connect to agent');
      }
    },
    [agentUrl, handleSessionArchived]
  );

  const { pullDistance, isRefreshing, isPulling, isThresholdReached, handlers } = usePullToRefresh({
    onRefresh: refreshSessions,
    disabled: !isMobile,
  });

  if (loading) {
    return <LoadingView />;
  }

  if (!agentUrl) {
    return (
      <NoConnectionView
        modalOpen={connectionModalOpen}
        onModalOpenChange={setConnectionModalOpen}
        onConnectionSaved={handleConnectionSaved}
      />
    );
  }

  const handleMenuClick = () => {
    setSelectedSession(null);
    clearSessionFromUrl();
  };

  const modals = (
    <>
      <AgentConnectionSettings
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
        onSave={(url) => {
          handleConnectionSaved(url);
          setConnectionModalOpen(false);
        }}
        onDisconnect={handleDisconnect}
        hasConnection={!!agentUrl}
      />

      <NewSessionModal
        open={newSessionOpen}
        onOpenChange={setNewSessionOpen}
        agentUrl={agentUrl}
        onStartSession={handleStartSession}
      />

      <SlideOverPanel open={guideOpen} onClose={() => setGuideOpen(false)} title="Connection Guide">
        <ConnectionGuide />
      </SlideOverPanel>

      <SlideOverPanel
        open={notificationSettingsOpen}
        onClose={() => setNotificationSettingsOpen(false)}
        title="Notification Settings"
      >
        <NotificationSettingsPanel />
      </SlideOverPanel>
    </>
  );

  if (!isMobile) {
    return (
      <>
        <AppShell
          sessions={sessionListItems}
          selectedSessionId={selectedSessionId}
          onSelectSession={handleSelectSessionFromList}
          onNewSession={() => setNewSessionOpen(true)}
          onKillSession={handleKillSessionFromList}
          onArchiveSession={handleArchiveSessionFromList}
          currentProjectName={selectedSession?.project}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
          onOpenNotificationSettings={() => setNotificationSettingsOpen(true)}
          onConnectionSettings={() => setConnectionModalOpen(true)}
        >
          {selectedSession ? (
            <SessionView
              key={`${selectedSession.project}-${selectedSession.sessionName.endsWith('--new') ? 'new' : selectedSession.sessionName}`}
              sessionName={selectedSession.sessionName}
              project={selectedSession.project}
              agentUrl={agentUrl}
              sessionInfo={getSelectedSessionInfo()}
              environmentId={selectedSession.environmentId}
              planningProjectId={selectedSession.planningProjectId}
              onMenuClick={handleMenuClick}
              onSessionCreated={handleSessionCreated}
              isMobile={false}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/10 bg-orange-500/5">
                  <Zap className="h-8 w-8 text-orange-500/30" />
                </div>
                <p className="text-sm text-white/40">Select a session or create a new one</p>
              </div>
            </div>
          )}
        </AppShell>
        {modals}
      </>
    );
  }

  return (
    <main
      className="h-screen-safe flex flex-col overflow-hidden bg-[#0a0a10]"
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    >
      {(isPulling || isRefreshing) && (
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
            style={{ transition: 'background-color 0.15s, color 0.15s' }}
          >
            {isRefreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowDown
                className="h-5 w-5 transition-transform duration-150"
                style={{ transform: isThresholdReached ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            )}
          </div>
        </div>
      )}

      <MobileStatusStrip
        sessions={sessions}
        currentSession={selectedSession}
        agentUrl={agentUrl}
        onSelectSession={handleSelectSession}
        onNewSession={() => setNewSessionOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onConnectionSettingsClick={() => setConnectionModalOpen(true)}
        onSessionKilled={handleSessionKilled}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        {selectedSession ? (
          <SessionView
            key={`${selectedSession.project}-${selectedSession.sessionName.endsWith('--new') ? 'new' : selectedSession.sessionName}`}
            sessionName={selectedSession.sessionName}
            project={selectedSession.project}
            agentUrl={agentUrl}
            sessionInfo={getSelectedSessionInfo()}
            environmentId={selectedSession.environmentId}
            planningProjectId={selectedSession.planningProjectId}
            onMenuClick={handleMenuClick}
            onSessionCreated={handleSessionCreated}
            isMobile={true}
          />
        ) : (
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

      {modals}
      <InstallBanner />
    </main>
  );
}
