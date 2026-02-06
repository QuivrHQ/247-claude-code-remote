'use client';

import { cn } from '@/lib/utils';
import { SessionListPanel, type SessionListItem } from './SessionListPanel';
import { AppHeader } from './AppHeader';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AppShellProps {
  children: React.ReactNode;
  // Session list props
  sessions?: SessionListItem[];
  selectedSessionId?: string | null;
  onSelectSession?: (session: SessionListItem) => void;
  onNewSession?: () => void;
  onKillSession?: (session: SessionListItem) => void;
  onArchiveSession?: (session: SessionListItem) => void;
  // Header props
  currentProjectName?: string;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  onOpenNotificationSettings?: () => void;
  onConnectionSettings?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// Resize Handle Component
// ═══════════════════════════════════════════════════════════════════════════

function ResizeHandle({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-1 flex-shrink-0 cursor-col-resize',
        'hover:bg-primary/20 transition-colors duration-150',
        className
      )}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AppShell Component
// ═══════════════════════════════════════════════════════════════════════════

export function AppShell({
  children,
  // Session list props
  sessions = [],
  selectedSessionId,
  onSelectSession,
  onNewSession,
  onKillSession,
  onArchiveSession,
  // Header props
  currentProjectName,
  onToggleFullscreen,
  isFullscreen = false,
  onOpenNotificationSettings,
  onConnectionSettings,
}: AppShellProps) {
  // In fullscreen mode, hide the session list
  if (isFullscreen) {
    return (
      <div className="h-screen-safe bg-background flex flex-col overflow-hidden">
        <AppHeader
          currentProjectName={currentProjectName}
          onNewSession={onNewSession}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={isFullscreen}
          onOpenNotificationSettings={onOpenNotificationSettings}
          onConnectionSettings={onConnectionSettings}
        />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="h-screen-safe bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <AppHeader
        currentProjectName={currentProjectName}
        onNewSession={onNewSession}
        onToggleFullscreen={onToggleFullscreen}
        isFullscreen={isFullscreen}
        onOpenNotificationSettings={onOpenNotificationSettings}
        onConnectionSettings={onConnectionSettings}
      />

      {/* Main Content - 2 Panel Layout */}
      <div className="flex flex-1 gap-1 overflow-hidden p-2">
        {/* Panel 1: Session List - Fixed width */}
        <div className="h-full flex-shrink-0" style={{ width: 320 }}>
          <SessionListPanel
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={onSelectSession}
            onNewSession={onNewSession}
            onKillSession={onKillSession}
            onArchiveSession={onArchiveSession}
          />
        </div>

        <ResizeHandle />

        {/* Panel 2: Main Content (Terminal) - Flex grow */}
        <main className="panel flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
