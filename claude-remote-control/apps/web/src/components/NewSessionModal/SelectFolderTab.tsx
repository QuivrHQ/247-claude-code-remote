'use client';

import { GitBranch } from 'lucide-react';
import { EnvironmentSelector } from '../EnvironmentSelector';
import { ToggleSwitch } from '../ui/toggle-switch';
import { ProjectDropdown } from './ProjectDropdown';

interface SelectFolderTabProps {
  folders: string[];
  selectedProject: string;
  onSelectProject: (project: string) => void;
  loadingFolders: boolean;
  agentUrl: string;
  selectedEnvironment: string | null;
  onSelectEnvironment: (id: string | null) => void;
  onManageEnvironments: () => void;
  envRefreshKey: number;
  useWorktree: boolean;
  onUseWorktreeChange: (use: boolean) => void;
}

export function SelectFolderTab({
  folders,
  selectedProject,
  onSelectProject,
  loadingFolders,
  agentUrl,
  selectedEnvironment,
  onSelectEnvironment,
  onManageEnvironments,
  envRefreshKey,
  useWorktree,
  onUseWorktreeChange,
}: SelectFolderTabProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-3 block text-sm font-medium text-white/60">Select Project</label>
        <ProjectDropdown
          folders={folders}
          selectedProject={selectedProject}
          onSelectProject={onSelectProject}
          loading={loadingFolders}
        />
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium text-white/60">Environment</label>
        <EnvironmentSelector
          key={envRefreshKey}
          agentUrl={agentUrl}
          selectedId={selectedEnvironment}
          onSelect={onSelectEnvironment}
          onManageClick={onManageEnvironments}
        />
      </div>

      <div>
        <label className="mb-3 block text-sm font-medium text-white/60">Options</label>
        <div className="space-y-3">
          <ToggleSwitch
            checked={useWorktree}
            onCheckedChange={onUseWorktreeChange}
            label="Git Worktree"
            description="Branche isolée pour cette session"
            icon={<GitBranch className="h-4 w-4" />}
            accentColor="amber"
          />
        </div>
      </div>
    </div>
  );
}
