'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnvironmentFormModal } from '../EnvironmentFormModal';
import type { RalphLoopConfig } from '247-shared';

import { useFolders, useClone, useRalphLoop } from './hooks';
import { MachineSelector } from './MachineSelector';
import { TabButtons, type TabType } from './TabButtons';
import { SelectFolderTab } from './SelectFolderTab';
import { CloneRepoTab } from './CloneRepoTab';
import { RalphLoopTab } from './RalphLoopTab';

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
  onStartSession: (
    machineId: string,
    project: string,
    environmentId?: string,
    ralphConfig?: RalphLoopConfig,
    useWorktree?: boolean
  ) => void;
}

export function NewSessionModal({
  open,
  onOpenChange,
  machines,
  onStartSession,
}: NewSessionModalProps) {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('select');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [envRefreshKey, setEnvRefreshKey] = useState(0);
  const [useWorktree, setUseWorktree] = useState(false);

  // Custom hooks
  const { folders, selectedProject, setSelectedProject, loadingFolders, addFolder } =
    useFolders(selectedMachine);
  const clone = useClone(selectedMachine);
  const ralph = useRalphLoop();

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedMachine(null);
      setActiveTab('select');
      setSelectedEnvironment(null);
      setUseWorktree(false);
      clone.resetCloneState();
      ralph.resetRalphState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Handle clone with folder update
  const handleClone = async () => {
    const projectName = await clone.handleClone();
    if (projectName) {
      addFolder(projectName);
      setTimeout(() => {
        setActiveTab('select');
        clone.resetCloneState();
      }, 1500);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
      if (e.key === 'Enter' && selectedMachine && selectedProject && activeTab === 'select') {
        onStartSession(
          selectedMachine.id,
          selectedProject,
          selectedEnvironment || undefined,
          undefined,
          useWorktree
        );
        onOpenChange(false);
      }
    },
    [
      onOpenChange,
      onStartSession,
      selectedMachine,
      selectedProject,
      selectedEnvironment,
      activeTab,
      useWorktree,
    ]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const handleStartSession = () => {
    if (selectedMachine && selectedProject) {
      onStartSession(
        selectedMachine.id,
        selectedProject,
        selectedEnvironment || undefined,
        undefined,
        useWorktree
      );
      onOpenChange(false);
    }
  };

  const handleStartRalphLoop = () => {
    if (selectedMachine && selectedProject && ralph.isValid) {
      onStartSession(
        selectedMachine.id,
        selectedProject,
        selectedEnvironment || undefined,
        ralph.getRalphConfig()
      );
      onOpenChange(false);
    }
  };

  const agentUrl = selectedMachine?.config?.agentUrl || 'localhost:4678';

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
                  <h2 className="text-lg font-semibold text-white">New Session</h2>
                  <p className="text-sm text-white/40">Select a machine and project</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
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
                >
                  <TabButtons activeTab={activeTab} onTabChange={setActiveTab} />

                  {activeTab === 'select' && (
                    <SelectFolderTab
                      folders={folders}
                      selectedProject={selectedProject}
                      onSelectProject={setSelectedProject}
                      loadingFolders={loadingFolders}
                      agentUrl={agentUrl}
                      selectedEnvironment={selectedEnvironment}
                      onSelectEnvironment={setSelectedEnvironment}
                      onManageEnvironments={() => setEnvModalOpen(true)}
                      envRefreshKey={envRefreshKey}
                      useWorktree={useWorktree}
                      onUseWorktreeChange={setUseWorktree}
                    />
                  )}

                  {activeTab === 'clone' && (
                    <CloneRepoTab
                      repoUrl={clone.repoUrl}
                      onRepoUrlChange={clone.setRepoUrl}
                      customProjectName={clone.customProjectName}
                      onCustomProjectNameChange={clone.setCustomProjectName}
                      previewedName={clone.previewedName}
                      cloning={clone.cloning}
                      cloneError={clone.cloneError}
                      cloneSuccess={clone.cloneSuccess}
                      onClone={handleClone}
                    />
                  )}

                  {activeTab === 'ralph' && (
                    <RalphLoopTab
                      folders={folders}
                      selectedProject={selectedProject}
                      onSelectProject={setSelectedProject}
                      loadingFolders={loadingFolders}
                      // Prompt Builder props
                      taskDescription={ralph.taskDescription}
                      onTaskDescriptionChange={ralph.setTaskDescription}
                      successCriteria={ralph.successCriteria}
                      onSuccessCriteriaChange={ralph.setSuccessCriteria}
                      deliverables={ralph.deliverables}
                      onDeliverablesChange={ralph.setDeliverables}
                      customDeliverable={ralph.customDeliverable}
                      onCustomDeliverableChange={ralph.setCustomDeliverable}
                      ralphCompletionPromise={ralph.ralphCompletionPromise}
                      onRalphCompletionPromiseChange={ralph.setRalphCompletionPromise}
                      completionInstruction={ralph.completionInstruction}
                      fullPrompt={ralph.fullPrompt}
                      isPreviewExpanded={ralph.isPreviewExpanded}
                      onPreviewExpandedChange={ralph.setPreviewExpanded}
                      // Other settings
                      ralphMaxIterations={ralph.ralphMaxIterations}
                      onRalphMaxIterationsChange={ralph.setRalphMaxIterations}
                      ralphUseWorktree={ralph.ralphUseWorktree}
                      onRalphUseWorktreeChange={ralph.setRalphUseWorktree}
                      ralphTrustMode={ralph.ralphTrustMode}
                      onRalphTrustModeChange={ralph.setRalphTrustMode}
                      // Environment & actions
                      agentUrl={agentUrl}
                      selectedEnvironment={selectedEnvironment}
                      onSelectEnvironment={setSelectedEnvironment}
                      onManageEnvironments={() => setEnvModalOpen(true)}
                      envRefreshKey={envRefreshKey}
                      onStartRalphLoop={handleStartRalphLoop}
                      isValid={ralph.isValid}
                    />
                  )}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            {activeTab === 'select' && (
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
                  disabled={!selectedMachine || !selectedProject}
                  className={cn(
                    'touch-manipulation active:scale-[0.98]',
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium transition-all',
                    selectedMachine && selectedProject
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

          <EnvironmentFormModal
            open={envModalOpen}
            onOpenChange={setEnvModalOpen}
            agentUrl={agentUrl}
            onSaved={() => setEnvRefreshKey((k) => k + 1)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
