'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Monitor, Plus, ChevronDown, Sparkles, Loader2, GitBranch, FolderOpen, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'select' | 'clone';

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
  onStartSession: (machineId: string, project: string) => void;
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
    } catch (err) {
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
      onStartSession(selectedMachine.id, selectedProject);
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
              'relative w-full max-w-2xl mx-4',
              'bg-[#0d0d14] border border-white/10 rounded-2xl',
              'shadow-2xl shadow-black/50'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">New Session</h2>
                  <p className="text-sm text-white/40">Select a machine and project</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Machine Selection */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-3">
                  Select Machine
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {onlineMachines.map((machine) => (
                    <button
                      key={machine.id}
                      onClick={() => setSelectedMachine(machine)}
                      className={cn(
                        'p-4 rounded-xl text-left transition-all',
                        'border',
                        selectedMachine?.id === machine.id
                          ? 'bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-500/10'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Monitor className={cn(
                          'w-4 h-4',
                          selectedMachine?.id === machine.id ? 'text-orange-400' : 'text-white/50'
                        )} />
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                        )} />
                      </div>
                      <p className={cn(
                        'font-medium truncate',
                        selectedMachine?.id === machine.id ? 'text-white' : 'text-white/80'
                      )}>
                        {machine.name}
                      </p>
                      <p className="text-xs text-white/30 truncate font-mono mt-0.5">
                        {machine.config?.agentUrl || 'localhost:4678'}
                      </p>
                    </button>
                  ))}

                  {/* Offline machines (disabled) */}
                  {offlineMachines.map((machine) => (
                    <div
                      key={machine.id}
                      className={cn(
                        'p-4 rounded-xl',
                        'bg-white/[0.02] border border-white/5',
                        'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Monitor className="w-4 h-4 text-white/30" />
                        <span className="w-2 h-2 rounded-full bg-red-400/50" />
                      </div>
                      <p className="font-medium text-white/40 truncate">
                        {machine.name}
                      </p>
                      <p className="text-xs text-white/20 truncate font-mono mt-0.5">
                        offline
                      </p>
                    </div>
                  ))}
                </div>

                {machines.length === 0 && (
                  <div className="text-center py-8 text-white/30">
                    <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No machines registered</p>
                  </div>
                )}

                {machines.length > 0 && onlineMachines.length === 0 && (
                  <div className="text-center py-8 text-white/30">
                    <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
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
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setActiveTab('select')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        activeTab === 'select'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                      )}
                    >
                      <FolderOpen className="w-4 h-4" />
                      Select Folder
                    </button>
                    <button
                      onClick={() => setActiveTab('clone')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        activeTab === 'clone'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
                      )}
                    >
                      <GitBranch className="w-4 h-4" />
                      Clone Repo
                    </button>
                  </div>

                  {/* Select Folder Tab */}
                  {activeTab === 'select' && (
                    <>
                      <label className="block text-sm font-medium text-white/60 mb-3">
                        Select Project
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl text-left',
                        'bg-white/5 border border-white/10',
                        'hover:bg-white/10 hover:border-white/20',
                        'flex items-center justify-between',
                        'transition-all'
                      )}
                    >
                      <span className={selectedProject ? 'text-white' : 'text-white/40'}>
                        {selectedProject || 'Choose a project...'}
                      </span>
                      <ChevronDown className={cn(
                        'w-4 h-4 text-white/40 transition-transform',
                        projectDropdownOpen && 'rotate-180'
                      )} />
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
                            'absolute top-full left-0 right-0 mt-2 z-10',
                            'bg-[#12121a] border border-white/10 rounded-xl',
                            'shadow-xl shadow-black/50',
                            'max-h-64 overflow-y-auto'
                          )}
                        >
                          {loadingFolders ? (
                            <div className="px-4 py-3 text-white/30 text-sm flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
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
                                  'hover:bg-white/5 transition-colors',
                                  'first:rounded-t-xl last:rounded-b-xl',
                                  selectedProject === folder
                                    ? 'text-orange-400 bg-orange-500/10'
                                    : 'text-white/80'
                                )}
                              >
                                {folder}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-white/30 text-sm">
                              No folders found
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                    </>
                  )}

                  {/* Clone Repo Tab */}
                  {activeTab === 'clone' && (
                    <div className="space-y-4">
                      {/* Success Message */}
                      {cloneSuccess && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          <Check className="w-4 h-4" />
                          <span className="text-sm">Successfully cloned <strong>{cloneSuccess}</strong></span>
                        </div>
                      )}

                      {/* Error Message */}
                      {cloneError && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">{cloneError}</span>
                        </div>
                      )}

                      {/* Repo URL Input */}
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">
                          Repository URL
                        </label>
                        <input
                          type="text"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          placeholder="https://github.com/user/repo or git@github.com:user/repo"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl',
                            'bg-white/5 border border-white/10',
                            'text-white placeholder:text-white/30',
                            'focus:outline-none focus:border-orange-500/50 focus:bg-white/10',
                            'transition-all'
                          )}
                        />
                      </div>

                      {/* Project Name (optional) */}
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">
                          Project Name <span className="text-white/30">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={customProjectName}
                          onChange={(e) => setCustomProjectName(e.target.value)}
                          placeholder={previewedName || 'Auto-detected from URL'}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl',
                            'bg-white/5 border border-white/10',
                            'text-white placeholder:text-white/30',
                            'focus:outline-none focus:border-orange-500/50 focus:bg-white/10',
                            'transition-all'
                          )}
                        />
                        {previewedName && !customProjectName && (
                          <p className="text-xs text-white/40 mt-1.5">
                            Will be cloned as: <span className="text-orange-400">{previewedName}</span>
                          </p>
                        )}
                      </div>

                      {/* Clone Button */}
                      <button
                        onClick={handleClone}
                        disabled={!repoUrl || cloning}
                        className={cn(
                          'w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-all',
                          repoUrl && !cloning
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/25'
                            : 'bg-white/5 text-white/30 cursor-not-allowed'
                        )}
                      >
                        {cloning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Cloning...
                          </>
                        ) : (
                          <>
                            <GitBranch className="w-4 h-4" />
                            Clone Repository
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Footer - only show start button when on select tab */}
            {activeTab === 'select' && (
              <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
                <p className="text-xs text-white/30">
                  Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/50 font-mono">Enter</kbd> to start
                </p>
                <button
                  onClick={handleStartSession}
                  disabled={!selectedMachine || !selectedProject}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                    selectedMachine && selectedProject
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/25'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
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
