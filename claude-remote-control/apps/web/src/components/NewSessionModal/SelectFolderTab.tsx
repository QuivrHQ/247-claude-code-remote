'use client';

import { MAX_SESSION_LABEL_LENGTH } from '247-shared';
import { cn } from '@/lib/utils';
import { ProjectDropdown } from './ProjectDropdown';
import type { SessionLabelState } from './sessionLabel';

interface SelectFolderTabProps {
  folders: string[];
  selectedProject: string;
  onSelectProject: (project: string) => void;
  loadingFolders: boolean;
  sessionLabel: string;
  onSessionLabelChange: (value: string) => void;
  labelState: SessionLabelState;
}

export function SelectFolderTab({
  folders,
  selectedProject,
  onSelectProject,
  loadingFolders,
  sessionLabel,
  onSessionLabelChange,
  labelState,
}: SelectFolderTabProps) {
  const invalid = labelState.status === 'invalid';

  return (
    <div className="space-y-5">
      <div>
        <span id="project-selector-label" className="mb-3 block text-sm font-medium text-white/60">
          Select Project
        </span>
        <ProjectDropdown
          folders={folders}
          selectedProject={selectedProject}
          onSelectProject={onSelectProject}
          loading={loadingFolders}
        />
      </div>

      <div>
        <label
          htmlFor="session-name-input"
          className="mb-3 block text-sm font-medium text-white/60"
        >
          Session name <span className="text-white/30">(optional)</span>
        </label>
        <input
          id="session-name-input"
          type="text"
          value={sessionLabel}
          onChange={(e) => onSessionLabelChange(e.target.value)}
          placeholder="e.g. api-refactor"
          maxLength={MAX_SESSION_LABEL_LENGTH}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby="session-name-hint"
          className={cn(
            'w-full rounded-xl border bg-white/5 px-4 py-3 text-white',
            'placeholder:text-white/30 focus:outline-none focus:ring-2',
            invalid
              ? 'border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20'
              : 'border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20'
          )}
        />
        <p
          id="session-name-hint"
          role={invalid ? 'alert' : undefined}
          className={cn('mt-2 text-xs', invalid ? 'text-red-400' : 'text-white/30')}
        >
          {labelState.status === 'invalid' && labelState.error}
          {labelState.status === 'valid' && (
            <>
              Will be created as{' '}
              <code className="font-mono text-white/50">{labelState.sessionName}</code>
            </>
          )}
          {labelState.status === 'empty' && 'Leave empty for an auto-generated name.'}
        </p>
      </div>
    </div>
  );
}
