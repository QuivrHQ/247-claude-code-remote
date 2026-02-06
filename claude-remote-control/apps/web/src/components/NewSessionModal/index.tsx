'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Sparkles } from 'lucide-react';
import { cn, buildApiUrl } from '@/lib/utils';

import { SelectFolderTab } from './SelectFolderTab';
import { TabSelector, TabType } from './TabSelector';
import { CloneRepoTab } from './CloneRepoTab';
import { TERMINAL_AT_ROOT } from './ProjectDropdown';

interface NewSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentUrl: string;
  onStartSession: (project: string, environmentId?: string) => void;
}

export function NewSessionModal({
  open,
  onOpenChange,
  agentUrl,
  onStartSession,
}: NewSessionModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('existing');
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  // Fetch folders from agent
  useEffect(() => {
    if (!open || !agentUrl) return;

    setLoadingFolders(true);
    fetch(buildApiUrl(agentUrl, '/api/folders'))
      .then((res) => (res.ok ? res.json() : []))
      .then((data: string[]) => {
        setFolders(data);
        setLoadingFolders(false);
      })
      .catch(() => {
        setFolders([]);
        setLoadingFolders(false);
      });
  }, [open, agentUrl]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setActiveTab('existing');
      setSelectedProject(null);
      setCloneError(null);
    }
  }, [open]);

  const handleStartSession = useCallback(() => {
    if (selectedProject) {
      const project = selectedProject === TERMINAL_AT_ROOT ? '' : selectedProject;
      onStartSession(project);
      onOpenChange(false);
    }
  }, [selectedProject, onStartSession, onOpenChange]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
      if (e.key === 'Enter' && activeTab === 'existing' && selectedProject) {
        handleStartSession();
      }
    },
    [onOpenChange, activeTab, selectedProject, handleStartSession]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const handleClone = async (url: string) => {
    if (!agentUrl) return { success: false, error: 'No agent connected' };

    setCloning(true);
    setCloneError(null);

    try {
      const res = await fetch(buildApiUrl(agentUrl, '/api/clone'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const error = data.error || 'Clone failed';
        setCloneError(error);
        setCloning(false);
        return { success: false, error };
      }

      // Add the new folder to the list and start session
      if (data.project) {
        setFolders((prev) => [...prev, data.project]);
        onStartSession(data.project);
        onOpenChange(false);
      }

      setCloning(false);
      return { success: true, project: data.project };
    } catch {
      const error = 'Failed to connect to agent';
      setCloneError(error);
      setCloning(false);
      return { success: false, error };
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-session-title"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col',
              'rounded-2xl border border-white/10 bg-[#0d0d14]',
              'shadow-2xl shadow-black/50'
            )}
          >
            {/* Header */}
            <div className="flex flex-none items-center justify-between border-b border-white/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                  <Plus className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h2 id="new-session-title" className="text-lg font-semibold text-white">
                    New Session
                  </h2>
                  <p className="text-sm text-white/40">Select a project to start</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-1 focus-visible:ring-orange-500/50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

              {activeTab === 'existing' ? (
                <SelectFolderTab
                  folders={folders}
                  selectedProject={selectedProject ?? ''}
                  onSelectProject={setSelectedProject}
                  loadingFolders={loadingFolders}
                />
              ) : (
                <CloneRepoTab onClone={handleClone} loading={cloning} error={cloneError} />
              )}
            </div>

            {/* Footer - only show on existing tab */}
            {activeTab === 'existing' && (
              <div className="flex flex-none items-center justify-between border-t border-white/5 px-6 py-4">
                <p className="text-xs text-white/30">
                  Press{' '}
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/50">
                    Enter
                  </kbd>{' '}
                  to start
                </p>
                <button
                  onClick={handleStartSession}
                  disabled={!selectedProject}
                  className={cn(
                    'touch-manipulation active:scale-[0.98]',
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium transition-all',
                    selectedProject
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400'
                      : 'cursor-not-allowed bg-white/5 text-white/30'
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Start Session
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
