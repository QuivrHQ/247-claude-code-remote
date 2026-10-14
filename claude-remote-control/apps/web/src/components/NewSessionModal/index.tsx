'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useFolders, useClone } from './hooks';
import { MachineSelector } from './MachineSelector';
import { SelectFolderTab } from './SelectFolderTab';
import { TabSelector, TabType } from './TabSelector';
import { CloneRepoTab } from './CloneRepoTab';
import { TERMINAL_AT_ROOT } from './ProjectDropdown';
import { resolveSessionLabel } from './sessionLabel';

interface Machine {
  id: string;
  name: string;
  status: string;
  config?: {
    projects: string[];
    agentUrl?: string;
  };
}

interface NewSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machines: Machine[];
  /** Sessions that already exist, used to reject duplicate custom names. */
  existingSessions?: ReadonlyArray<{ name: string; machineId: string }>;
  onStartSession: (
    machineId: string,
    project: string,
    environmentId?: string,
    sessionLabel?: string
  ) => void;
}

const NO_SESSIONS: NonNullable<NewSessionModalProps['existingSessions']> = [];

export function NewSessionModal({
  open,
  onOpenChange,
  machines,
  existingSessions = NO_SESSIONS,
  onStartSession,
}: NewSessionModalProps) {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('existing');
  const [sessionLabel, setSessionLabel] = useState('');

  // Custom hooks
  const { folders, selectedProject, setSelectedProject, loadingFolders, addFolder } =
    useFolders(selectedMachine);
  const { cloneRepo, cloning, cloneError, clearError } = useClone(selectedMachine);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedMachine(null);
      setActiveTab('existing');
      setSessionLabel('');
      clearError();
    }
  }, [open, clearError]);

  // Pass empty string for root, otherwise pass the project name
  const projectName = selectedProject === TERMINAL_AT_ROOT ? '' : selectedProject;

  const takenSessionNames = useMemo(
    () =>
      new Set(
        existingSessions.filter((s) => s.machineId === selectedMachine?.id).map((s) => s.name)
      ),
    [existingSessions, selectedMachine]
  );

  const labelState = useMemo(
    () => resolveSessionLabel(sessionLabel, projectName, takenSessionNames),
    [sessionLabel, projectName, takenSessionNames]
  );

  const canStart = Boolean(selectedMachine && selectedProject) && labelState.status !== 'invalid';

  const handleStartSession = useCallback(() => {
    if (!selectedMachine || !selectedProject || labelState.status === 'invalid') return;
    const label = labelState.status === 'valid' ? labelState.label : undefined;
    onStartSession(selectedMachine.id, projectName, undefined, label);
    onOpenChange(false);
  }, [selectedMachine, selectedProject, labelState, projectName, onStartSession, onOpenChange]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
      // Only handle Enter on existing tab (clone tab has its own Enter handler)
      if (e.key === 'Enter' && activeTab === 'existing' && canStart) {
        handleStartSession();
      }
    },
    [onOpenChange, activeTab, canStart, handleStartSession]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const handleClone = async (url: string) => {
    const result = await cloneRepo(url);
    if (result.success && result.project && selectedMachine) {
      // Add the new folder to the list and start session
      addFolder(result.project);
      onStartSession(selectedMachine.id, result.project);
      onOpenChange(false);
    }
    return result;
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
                  <p className="text-sm text-white/40">Select a machine and project</p>
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
              <MachineSelector
                machines={machines}
                selectedMachine={selectedMachine}
                onSelectMachine={setSelectedMachine}
              />

              {selectedMachine && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

                  {activeTab === 'existing' ? (
                    <SelectFolderTab
                      folders={folders}
                      selectedProject={selectedProject}
                      onSelectProject={setSelectedProject}
                      loadingFolders={loadingFolders}
                      sessionLabel={sessionLabel}
                      onSessionLabelChange={setSessionLabel}
                      labelState={labelState}
                    />
                  ) : (
                    <CloneRepoTab onClone={handleClone} loading={cloning} error={cloneError} />
                  )}
                </motion.div>
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
                  disabled={!canStart}
                  className={cn(
                    'touch-manipulation active:scale-[0.98]',
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium transition-all',
                    canStart
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
