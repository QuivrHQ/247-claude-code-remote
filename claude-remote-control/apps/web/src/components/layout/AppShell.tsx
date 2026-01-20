'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/animations';
import { Sidebar, type SidebarMachine, type SidebarProject } from './Sidebar';
import { SessionListPanel, type SessionListItem } from './SessionListPanel';
import { AppHeader } from './AppHeader';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AppShellProps {
  children: React.ReactNode;
  // Sidebar props
  machines?: SidebarMachine[];
  projects?: SidebarProject[];
  selectedMachineId?: string | null;
  onSelectMachine?: (id: string) => void;
  onAddMachine?: () => void;
  onOpenSettings?: () => void;
  onSelectProject?: (projectName: string) => void;
  selectedProjectName?: string | null;
  // Session list props
  sessions?: SessionListItem[];
  selectedSessionId?: string | null;
  onSelectSession?: (session: SessionListItem) => void;
  onNewSession?: () => void;
  onKillSession?: (session: SessionListItem) => void;
  onArchiveSession?: (session: SessionListItem) => void;
  // Header props
  currentMachineName?: string;
  currentProjectName?: string;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
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
  // Sidebar props
  machines = [],
  projects = [],
  selectedMachineId,
  onSelectMachine,
  onAddMachine,
  onOpenSettings,
  onSelectProject,
  selectedProjectName,
  // Session list props
  sessions = [],
  selectedSessionId,
  onSelectSession,
  onNewSession,
  onKillSession,
  onArchiveSession,
  // Header props
  currentMachineName,
  currentProjectName,
  onToggleFullscreen,
  isFullscreen = false,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  // In fullscreen mode, hide the sidebar and session list
  if (isFullscreen) {
    return (
      <div className="h-screen-safe bg-background flex flex-col overflow-hidden">
        <AppHeader
          onSidebarToggle={handleSidebarToggle}
          sidebarCollapsed={sidebarCollapsed}
          currentMachineName={currentMachineName}
          currentProjectName={currentProjectName}
          onNewSession={onNewSession}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={isFullscreen}
        />
        <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="h-screen-safe bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <AppHeader
        onSidebarToggle={handleSidebarToggle}
        sidebarCollapsed={sidebarCollapsed}
        currentMachineName={currentMachineName}
        currentProjectName={currentProjectName}
        onNewSession={onNewSession}
        onToggleFullscreen={onToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Main Content - 3 Panel Layout */}
      <div className="flex flex-1 gap-1 overflow-hidden p-2">
        {/* Panel 1: Sidebar (Machines & Projects) - Fixed width */}
        <AnimatePresence mode="wait">
          <motion.div
            key={sidebarCollapsed ? 'collapsed' : 'expanded'}
            initial={{ width: sidebarCollapsed ? 56 : 240 }}
            animate={{ width: sidebarCollapsed ? 56 : 240 }}
            exit={{ opacity: 0 }}
            transition={spring.snappy}
            className="h-full flex-shrink-0"
          >
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={handleSidebarToggle}
              machines={machines}
              projects={projects}
              selectedMachineId={selectedMachineId}
              onSelectMachine={onSelectMachine}
              onAddMachine={onAddMachine}
              onOpenSettings={onOpenSettings}
              onSelectProject={onSelectProject}
              selectedProjectName={selectedProjectName}
            />
          </motion.div>
        </AnimatePresence>

        <ResizeHandle />

        {/* Panel 2: Session List - Fixed width */}
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

        {/* Panel 3: Main Content (Terminal) - Flex grow */}
        <main className="panel flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
