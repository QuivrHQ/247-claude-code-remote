'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  BellOff,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { SessionSidebar } from '@/components/SessionSidebar';
import { NewSessionModal } from '@/components/NewSessionModal';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, type SessionStatus } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { useSessionContext } from './SessionContext';

interface SessionLayoutContentProps {
  children: ReactNode;
}

export function SessionLayoutContent({ children }: SessionLayoutContentProps) {
  const {
    agentConnection,
    projects,
    sessions,
    loading,
    error,
    machineId,
    sessionName,
    currentProject,
    currentSessionInfo,
    agentUrl,
    machineName,
    handleSelectSession,
    handleNewSessionClick,
    handleSessionKilled,
    showNewSessionModal,
    setShowNewSessionModal,
    handleNewSession,
  } = useSessionContext();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !agentConnection) {
    return <ErrorState error={error} />;
  }

  // Create machine object for NewSessionModal
  const machine = {
    id: machineId,
    name: machineName,
    status: 'online' as const,
  };

  return (
    <div
      className={cn(
        'h-screen flex flex-col overflow-hidden',
        'bg-gradient-to-br from-[#0a0a10] via-[#0d0d14] to-[#0a0a10]'
      )}
    >
      {/* Top Header */}
      <header
        className={cn(
          'flex items-center justify-between px-4 py-2.5',
          'bg-[#0d0d14]/80 backdrop-blur-xl',
          'border-b border-white/5'
        )}
      >
        {/* Left: Navigation & Session Info */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'text-white/50 hover:text-white hover:bg-white/5',
              'transition-all group'
            )}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </Link>

          <div className="h-5 w-px bg-white/10" />

          {/* Session name - primary */}
          <div className="flex items-center gap-3">
            {currentSessionInfo && (
              <StatusBadge
                status={currentSessionInfo.status as SessionStatus}
                size="md"
                showTooltip
              />
            )}
            <div>
              <h1 className="text-base font-semibold text-white font-mono">
                {sessionName.split('--')[1] || sessionName}
              </h1>
              <p className="text-xs text-white/40">
                {currentProject} <span className="text-white/20">•</span>{' '}
                <span className="text-white/30">{machineName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications Toggle */}
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              notificationsEnabled
                ? 'text-white/60 hover:text-white hover:bg-white/5'
                : 'text-white/30 hover:text-white/50 hover:bg-white/5'
            )}
            title={notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled'}
          >
            {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Session Sidebar */}
        <SessionSidebar
          sessions={sessions}
          projects={projects}
          currentSessionName={sessionName}
          currentProject={currentProject}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSessionClick}
          onSessionKilled={handleSessionKilled}
          agentUrl={agentUrl}
        />

        {/* Terminal/Editor Area (children) */}
        {children}
      </div>

      {/* New Session Modal */}
      <NewSessionModal
        open={showNewSessionModal}
        onOpenChange={setShowNewSessionModal}
        machines={[machine]}
        onStartSession={handleNewSession}
      />
    </div>
  );
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-[#0a0a10]">
      <header className="bg-[#0d0d14] border-b border-white/5">
        <div className="px-4 py-3 flex items-center gap-4">
          <Skeleton className="h-6 w-16 bg-white/5" />
          <div className="h-5 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg bg-white/5" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32 bg-white/5" />
              <Skeleton className="h-3 w-24 bg-white/5" />
            </div>
          </div>
          <div className="flex-1" />
          <Skeleton className="h-8 w-24 rounded-full bg-white/5" />
        </div>
      </header>
      <div className="flex-1 flex">
        <div className="w-80 border-r border-white/5 p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Skeleton className="h-6 w-48 mx-auto bg-white/5" />
            <Skeleton className="h-4 w-32 mx-auto bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Error state
function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0a0a10] p-4">
      <Card className="p-8 text-center max-w-md bg-[#12121a] border-white/10">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Connection Error</h2>
        <p className="text-white/50 mb-6">
          {error || 'Unable to connect to the agent. Please check your connection settings.'}
        </p>
        <Link
          href="/"
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-orange-500 hover:bg-orange-400 text-white font-medium',
            'transition-colors'
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
      </Card>
    </div>
  );
}
