'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Monitor,
  Plus,
  ChevronDown,
  Sparkles,
  Loader2,
  GitBranch,
  FolderOpen,
  AlertCircle,
  Check,
  RefreshCw,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnvironmentSelector } from './EnvironmentSelector';
import { EnvironmentFormModal } from './EnvironmentFormModal';
import type { RalphLoopConfig } from '@vibecompany/247-shared';

type TabType = 'select' | 'clone' | 'ralph';

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
    ralphConfig?: RalphLoopConfig
  ) => void;
}

export function NewSessionModal({
  open,
  onOpenChange,
  machines,
  onStartSession,
}: NewSessionModalProps) {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('select');

  // Clone state
  const [repoUrl, setRepoUrl] = useState('');
  const [customProjectName, setCustomProjectName] = useState('');
  const [previewedName, setPreviewedName] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);

  // Environment state
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [envRefreshKey, setEnvRefreshKey] = useState(0);

  // Ralph Loop state
  const [ralphPrompt, setRalphPrompt] = useState('');
  const [ralphMaxIterations, setRalphMaxIterations] = useState<number>(10);
  const [ralphCompletionPromise, setRalphCompletionPromise] = useState('COMPLETE');
  const [ralphUseWorktree, setRalphUseWorktree] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedMachine(null);
      setSelectedProject('');
      setProjectDropdownOpen(false);
      setFolders([]);
      setActiveTab('select');
      setRepoUrl('');
      setCustomProjectName('');
      setPreviewedName('');
      setCloneError(null);
      setCloneSuccess(null);
      setSelectedEnvironment(null);
      // Reset Ralph Loop state
      setRalphPrompt('');
      setRalphMaxIterations(10);
      setRalphCompletionPromise('COMPLETE');
      setRalphUseWorktree(false);
    }
  }, [open]);

  // Fetch folders dynamically when machine is selected
  useEffect(() => {
    if (!selectedMachine) {
      setFolders([]);
      setSelectedProject('');
      return;
    }

    const fetchFolders = async () => {
      setLoadingFolders(true);
      try {
        const agentUrl = selectedMachine.config?.agentUrl || 'localhost:4678';
        const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
        const response = await fetch(`${protocol}://${agentUrl}/api/folders`);
        if (response.ok) {
          const folderList: string[] = await response.json();
          setFolders(folderList);
          if (folderList.length > 0) {
            setSelectedProject(folderList[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch folders:', err);
        // Fallback to config projects if available
        if (selectedMachine.config?.projects?.length) {
          setFolders(selectedMachine.config.projects);
          setSelectedProject(selectedMachine.config.projects[0]);
        }
      } finally {
        setLoadingFolders(false);
      }
    };

    fetchFolders();
  }, [selectedMachine]);

  // Preview project name from URL
  useEffect(() => {
    if (!repoUrl || !selectedMachine) {
      setPreviewedName('');
      return;
    }

    const previewName = async () => {
      try {
        const agentUrl = selectedMachine.config?.agentUrl || 'localhost:4678';
        const protocol = agentUrl.includes('localhost') ? 'http' : 'https';
        const response = await fetch(
          `${protocol}://${agentUrl}/api/clone/preview?url=${encodeURIComponent(repoUrl)}`
        );
        if (response.ok) {
          const data = await response.json();
          setPreviewedName(data.projectName);
        }
      } catch {
        // Fallback: extract name client-side
        const parts = repoUrl.replace(/\.git$/, '').split('/');
        setPreviewedName(parts[parts.length - 1] || '');
      }
    };

    const timer = setTimeout(previewName, 300);
    return () => clearTimeout(timer);
  }, [repoUrl, selectedMachine]);

  // Handle clone
  const handleClone = async () => {
    if (!selectedMachine || !repoUrl) return;

    setCloning(true);
    setCloneError(null);
    setCloneSuccess(null);

    try {
      const agentUrl = selectedMachine.config?.agentUrl || 'localhost:4678';
      const protocol = agentUrl.includes('localhost') ? 'http' : 'https';

      const response = await fetch(`${protocol}://${agentUrl}/api/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          projectName: customProjectName || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCloneSuccess(data.projectName);
        // Refresh folders and auto-select the new project
        setFolders((prev) => [...prev, data.projectName].sort());
        setSelectedProject(data.projectName);
        // Switch to select tab after successful clone
        setTimeout(() => {
          setActiveTab('select');
          setRepoUrl('');
          setCustomProjectName('');
          setCloneSuccess(null);
        }, 1500);
      } else {
        setCloneError(data.error || 'Clone failed');
      }
    } catch {
      setCloneError('Network error - could not connect to agent');
    } finally {
      setCloning(false);
    }
  };

  // Keyboard shortcut handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
      // Enter to start if ready
      if (e.key === 'Enter' && selectedMachine && selectedProject) {
        onStartSession(selectedMachine.id, selectedProject);
        onOpenChange(false);
      }
    },
    [onOpenChange, onStartSession, selectedMachine, selectedProject]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const onlineMachines = machines.filter((m) => m.status === 'online');
  const offlineMachines = machines.filter((m) => m.status !== 'online');

  const handleStartSession = () => {
    if (selectedMachine && selectedProject) {
      onStartSession(selectedMachine.id, selectedProject, selectedEnvironment || undefined);
      onOpenChange(false);
    }
  };

  const handleStartRalphLoop = () => {
    if (selectedMachine && selectedProject && ralphPrompt.trim()) {
      const ralphConfig: RalphLoopConfig = {
        prompt: ralphPrompt.trim(),
        maxIterations: ralphMaxIterations > 0 ? ralphMaxIterations : undefined,
        completionPromise: ralphCompletionPromise.trim() || undefined,
        useWorktree: ralphUseWorktree,
      };
      onStartSession(
        selectedMachine.id,
        selectedProject,
        selectedEnvironment || undefined,
        ralphConfig
      );
      onOpenChange(false);
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
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => onOpenChange(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
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
              {/* Machine Selection */}
              <div>
                <label className="mb-3 block text-sm font-medium text-white/60">
                  Select Machine
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {onlineMachines.map((machine) => (
                    <button
                      key={machine.id}
                      onClick={() => setSelectedMachine(machine)}
                      className={cn(
                        'rounded-xl p-4 text-left transition-all',
                        'border',
                        selectedMachine?.id === machine.id
                          ? 'border-orange-500/50 bg-orange-500/10 shadow-lg shadow-orange-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Monitor
                          className={cn(
                            'h-4 w-4',
                            selectedMachine?.id === machine.id ? 'text-orange-400' : 'text-white/50'
                          )}
                        />
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                          )}
                        />
                      </div>
                      <p
                        className={cn(
                          'truncate font-medium',
                          selectedMachine?.id === machine.id ? 'text-white' : 'text-white/80'
                        )}
                      >
                        {machine.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-white/30">
                        {machine.config?.agentUrl || 'localhost:4678'}
                      </p>
                    </button>
                  ))}

                  {/* Offline machines (disabled) */}
                  {offlineMachines.map((machine) => (
                    <div
                      key={machine.id}
                      className={cn(
                        'rounded-xl p-4',
                        'border border-white/5 bg-white/[0.02]',
                        'cursor-not-allowed opacity-50'
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-white/30" />
                        <span className="h-2 w-2 rounded-full bg-red-400/50" />
                      </div>
                      <p className="truncate font-medium text-white/40">{machine.name}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-white/20">offline</p>
                    </div>
                  ))}
                </div>

                {machines.length === 0 && (
                  <div className="py-8 text-center text-white/30">
                    <Monitor className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>No machines registered</p>
                  </div>
                )}

                {machines.length > 0 && onlineMachines.length === 0 && (
                  <div className="py-8 text-center text-white/30">
                    <Monitor className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p>All machines are offline</p>
                  </div>
                )}
              </div>

              {/* Tabs + Project Selection / Clone */}
              {selectedMachine && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Tab Buttons */}
                  <div className="mb-4 flex gap-2">
                    <button
                      onClick={() => setActiveTab('select')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                        activeTab === 'select'
                          ? 'border border-orange-500/30 bg-orange-500/20 text-orange-400'
                          : 'border border-transparent bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Select Folder
                    </button>
                    <button
                      onClick={() => setActiveTab('clone')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                        activeTab === 'clone'
                          ? 'border border-orange-500/30 bg-orange-500/20 text-orange-400'
                          : 'border border-transparent bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <GitBranch className="h-4 w-4" />
                      Clone Repo
                    </button>
                    <button
                      onClick={() => setActiveTab('ralph')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                        activeTab === 'ralph'
                          ? 'border border-purple-500/30 bg-purple-500/20 text-purple-400'
                          : 'border border-transparent bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Ralph Loop
                    </button>
                  </div>

                  {/* Select Folder Tab */}
                  {activeTab === 'select' && (
                    <div className="space-y-5">
                      {/* Project Selection */}
                      <div>
                        <label className="mb-3 block text-sm font-medium text-white/60">
                          Select Project
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                            className={cn(
                              'w-full rounded-xl px-4 py-3 text-left',
                              'border border-white/10 bg-white/5',
                              'hover:border-white/20 hover:bg-white/10',
                              'flex items-center justify-between',
                              'transition-all'
                            )}
                          >
                            <span className={selectedProject ? 'text-white' : 'text-white/40'}>
                              {selectedProject || 'Choose a project...'}
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 text-white/40 transition-transform',
                                projectDropdownOpen && 'rotate-180'
                              )}
                            />
                          </button>

                          {/* Dropdown */}
                          <AnimatePresence>
                            {projectDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className={cn(
                                  'absolute left-0 right-0 top-full z-10 mt-2',
                                  'rounded-xl border border-white/10 bg-[#12121a]',
                                  'shadow-xl shadow-black/50',
                                  'max-h-64 overflow-y-auto'
                                )}
                              >
                                {loadingFolders ? (
                                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-white/30">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading folders...
                                  </div>
                                ) : folders.length > 0 ? (
                                  folders.map((folder) => (
                                    <button
                                      key={folder}
                                      onClick={() => {
                                        setSelectedProject(folder);
                                        setProjectDropdownOpen(false);
                                      }}
                                      className={cn(
                                        'w-full px-4 py-2.5 text-left',
                                        'transition-colors hover:bg-white/5',
                                        'first:rounded-t-xl last:rounded-b-xl',
                                        selectedProject === folder
                                          ? 'bg-orange-500/10 text-orange-400'
                                          : 'text-white/80'
                                      )}
                                    >
                                      {folder}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-sm text-white/30">
                                    No folders found
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Environment Selection */}
                      <div>
                        <label className="mb-3 block text-sm font-medium text-white/60">
                          Environment
                        </label>
                        <EnvironmentSelector
                          key={envRefreshKey}
                          agentUrl={selectedMachine?.config?.agentUrl || 'localhost:4678'}
                          selectedId={selectedEnvironment}
                          onSelect={setSelectedEnvironment}
                          onManageClick={() => setEnvModalOpen(true)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Clone Repo Tab */}
                  {activeTab === 'clone' && (
                    <div className="space-y-4">
                      {/* Success Message */}
                      {cloneSuccess && (
                        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-400">
                          <Check className="h-4 w-4" />
                          <span className="text-sm">
                            Successfully cloned <strong>{cloneSuccess}</strong>
                          </span>
                        </div>
                      )}

                      {/* Error Message */}
                      {cloneError && (
                        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm">{cloneError}</span>
                        </div>
                      )}

                      {/* Repo URL Input */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/60">
                          Repository URL
                        </label>
                        <input
                          type="text"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="https://github.com/user/repo or git@github.com:user/repo"
                          className={cn(
                            'w-full rounded-xl px-4 py-3',
                            'border border-white/10 bg-white/5',
                            'text-white placeholder:text-white/30',
                            'focus:border-orange-500/50 focus:bg-white/10 focus:outline-none',
                            'transition-all'
                          )}
                        />
                      </div>

                      {/* Project Name (optional) */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/60">
                          Project Name <span className="text-white/30">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={customProjectName}
                          onChange={(e) => setCustomProjectName(e.target.value)}
                          placeholder={previewedName || 'Auto-detected from URL'}
                          className={cn(
                            'w-full rounded-xl px-4 py-3',
                            'border border-white/10 bg-white/5',
                            'text-white placeholder:text-white/30',
                            'focus:border-orange-500/50 focus:bg-white/10 focus:outline-none',
                            'transition-all'
                          )}
                        />
                        {previewedName && !customProjectName && (
                          <p className="mt-1.5 text-xs text-white/40">
                            Will be cloned as:{' '}
                            <span className="text-orange-400">{previewedName}</span>
                          </p>
                        )}
                      </div>

                      {/* Clone Button */}
                      <button
                        onClick={handleClone}
                        disabled={!repoUrl || cloning}
                        className={cn(
                          'flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-medium transition-all',
                          repoUrl && !cloning
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400'
                            : 'cursor-not-allowed bg-white/5 text-white/30'
                        )}
                      >
                        {cloning ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cloning...
                          </>
                        ) : (
                          <>
                            <GitBranch className="h-4 w-4" />
                            Clone Repository
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Ralph Loop Tab */}
                  {activeTab === 'ralph' && (
                    <div className="space-y-4">
                      {/* Info Banner */}
                      <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-3">
                        <p className="text-sm text-purple-300">
                          <strong>Ralph Loop</strong> iteratively feeds Claude the same prompt until
                          completion. Claude sees its previous work in files and improves each
                          iteration.
                        </p>
                      </div>

                      {/* Project Selection for Ralph */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/60">
                          Project
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                            className={cn(
                              'w-full rounded-xl px-4 py-3 text-left',
                              'border border-white/10 bg-white/5',
                              'hover:border-white/20 hover:bg-white/10',
                              'flex items-center justify-between',
                              'transition-all'
                            )}
                          >
                            <span className={selectedProject ? 'text-white' : 'text-white/40'}>
                              {selectedProject || 'Choose a project...'}
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 text-white/40 transition-transform',
                                projectDropdownOpen && 'rotate-180'
                              )}
                            />
                          </button>

                          {/* Dropdown */}
                          <AnimatePresence>
                            {projectDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className={cn(
                                  'absolute left-0 right-0 top-full z-10 mt-2',
                                  'rounded-xl border border-white/10 bg-[#12121a]',
                                  'shadow-xl shadow-black/50',
                                  'max-h-48 overflow-y-auto'
                                )}
                              >
                                {loadingFolders ? (
                                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-white/30">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading folders...
                                  </div>
                                ) : folders.length > 0 ? (
                                  folders.map((folder) => (
                                    <button
                                      key={folder}
                                      onClick={() => {
                                        setSelectedProject(folder);
                                        setProjectDropdownOpen(false);
                                      }}
                                      className={cn(
                                        'w-full px-4 py-2.5 text-left',
                                        'transition-colors hover:bg-white/5',
                                        'first:rounded-t-xl last:rounded-b-xl',
                                        selectedProject === folder
                                          ? 'bg-purple-500/10 text-purple-400'
                                          : 'text-white/80'
                                      )}
                                    >
                                      {folder}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-sm text-white/30">
                                    No folders found
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Prompt Input */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/60">
                          Task Prompt <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          value={ralphPrompt}
                          onChange={(e) => setRalphPrompt(e.target.value)}
                          placeholder="Implement feature X with tests. Output <promise>COMPLETE</promise> when done."
                          rows={4}
                          className={cn(
                            'w-full rounded-xl px-4 py-3',
                            'border border-white/10 bg-white/5',
                            'text-white placeholder:text-white/30',
                            'focus:border-purple-500/50 focus:bg-white/10 focus:outline-none',
                            'resize-none transition-all'
                          )}
                        />
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Max Iterations */}
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/60">
                            Max Iterations
                          </label>
                          <input
                            type="number"
                            value={ralphMaxIterations}
                            onChange={(e) => setRalphMaxIterations(parseInt(e.target.value) || 0)}
                            min={1}
                            max={100}
                            className={cn(
                              'w-full rounded-xl px-4 py-3',
                              'border border-white/10 bg-white/5',
                              'text-white placeholder:text-white/30',
                              'focus:border-purple-500/50 focus:bg-white/10 focus:outline-none',
                              'transition-all'
                            )}
                          />
                          <p className="mt-1 text-xs text-white/30">Safety limit (recommended)</p>
                        </div>

                        {/* Completion Promise */}
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/60">
                            Completion Promise
                          </label>
                          <input
                            type="text"
                            value={ralphCompletionPromise}
                            onChange={(e) => setRalphCompletionPromise(e.target.value)}
                            placeholder="COMPLETE"
                            className={cn(
                              'w-full rounded-xl px-4 py-3',
                              'border border-white/10 bg-white/5',
                              'text-white placeholder:text-white/30',
                              'focus:border-purple-500/50 focus:bg-white/10 focus:outline-none',
                              'transition-all'
                            )}
                          />
                          <p className="mt-1 text-xs text-white/30">Text that signals completion</p>
                        </div>
                      </div>

                      {/* Worktree Option */}
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <input
                          type="checkbox"
                          id="useWorktree"
                          checked={ralphUseWorktree}
                          onChange={(e) => setRalphUseWorktree(e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-500 focus:ring-purple-500"
                        />
                        <label htmlFor="useWorktree" className="flex-1 cursor-pointer">
                          <span className="block text-sm font-medium text-white">
                            Use Git Worktree
                          </span>
                          <span className="text-xs text-white/40">
                            Create an isolated branch for this loop (recommended for parallel loops)
                          </span>
                        </label>
                      </div>

                      {/* Environment Selection */}
                      <div>
                        <label className="mb-2 block text-sm font-medium text-white/60">
                          Environment
                        </label>
                        <EnvironmentSelector
                          key={`ralph-${envRefreshKey}`}
                          agentUrl={selectedMachine?.config?.agentUrl || 'localhost:4678'}
                          selectedId={selectedEnvironment}
                          onSelect={setSelectedEnvironment}
                          onManageClick={() => setEnvModalOpen(true)}
                        />
                      </div>

                      {/* Start Ralph Loop Button */}
                      <button
                        onClick={handleStartRalphLoop}
                        disabled={!selectedProject || !ralphPrompt.trim()}
                        className={cn(
                          'flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-medium transition-all',
                          selectedProject && ralphPrompt.trim()
                            ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-500/25 hover:from-purple-400 hover:to-violet-400'
                            : 'cursor-not-allowed bg-white/5 text-white/30'
                        )}
                      >
                        <Play className="h-4 w-4" />
                        Start Ralph Loop
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Footer - only show start button when on select tab */}
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

          {/* Environment Form Modal */}
          <EnvironmentFormModal
            open={envModalOpen}
            onOpenChange={setEnvModalOpen}
            agentUrl={selectedMachine?.config?.agentUrl || 'localhost:4678'}
            onSaved={() => setEnvRefreshKey((k) => k + 1)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
