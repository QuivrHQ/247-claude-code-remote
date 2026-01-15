'use client';

import { EnvironmentSelector } from '../EnvironmentSelector';
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
    </div>
  );
}
