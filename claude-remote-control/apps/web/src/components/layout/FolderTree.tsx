'use client';

import { useCallback } from 'react';
import { ChevronRight, Folder, FolderOpen, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { countSessionsUnder, fetchAgentFolders, joinFolderPath } from '@/lib/folders';
import { useFolderTree, type UseFolderTreeReturn } from '@/hooks/useFolderTree';

interface FolderTreeProps {
  agentUrl: string;
  selectedPath?: string | null;
  /** Session counts keyed by project path. */
  sessionCounts?: Readonly<Record<string, number>>;
  onSelectFolder?: (path: string) => void;
  onStartSession?: (path: string) => void;
}

interface FolderListProps extends Omit<FolderTreeProps, 'agentUrl'> {
  parentPath: string;
  depth: number;
  tree: UseFolderTreeReturn;
}

function FolderList({
  parentPath,
  depth,
  tree,
  selectedPath,
  sessionCounts = {},
  onSelectFolder,
  onStartSession,
}: FolderListProps) {
  const node = tree.nodes[parentPath];
  if (!node) return null;

  if (node.status === 'loading' && node.children.length === 0) {
    return (
      <li
        role="none"
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/30"
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Loading…
      </li>
    );
  }

  if (node.status === 'error') {
    return (
      <li role="none" style={{ paddingLeft: 12 + depth * 14 }}>
        <button
          type="button"
          onClick={() => tree.retry(parentPath)}
          className="py-1.5 text-left text-xs text-red-400/80 hover:text-red-300"
        >
          Couldn&apos;t load folders. Retry
        </button>
      </li>
    );
  }

  if (node.children.length === 0) {
    return (
      <li
        role="none"
        className="py-1.5 text-xs text-white/30"
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        {depth === 0 ? 'No folders' : 'No subfolders'}
      </li>
    );
  }

  return (
    <>
      {node.children.map((name) => {
        const path = joinFolderPath(parentPath, name);
        const isExpanded = tree.expanded.has(path);
        const isSelected = selectedPath === path;
        const sessionCount = countSessionsUnder(sessionCounts, path);
        const FolderIcon = isExpanded ? FolderOpen : Folder;

        return (
          <li key={path} role="treeitem" aria-expanded={isExpanded} aria-selected={isSelected}>
            <div
              className={cn(
                'group flex items-center gap-1 rounded-lg pr-1 transition-colors',
                'hover:bg-white/5',
                isSelected && 'bg-primary/10 border-primary border-l-2'
              )}
              style={{ paddingLeft: 4 + depth * 14 }}
            >
              <button
                type="button"
                onClick={() => tree.toggle(path)}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${path}`}
                className="rounded p-1 text-white/30 hover:text-white/70"
              >
                <ChevronRight
                  className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-90')}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() => onSelectFolder?.(path)}
                title={path}
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left active:scale-[0.98]"
              >
                <FolderIcon
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    isSelected ? 'text-primary' : 'text-white/50'
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'truncate text-sm',
                    isSelected ? 'font-medium text-white' : 'text-white/70'
                  )}
                >
                  {name}
                </span>
              </button>

              {sessionCount > 0 && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-white/40">
                  {sessionCount}
                </span>
              )}

              {onStartSession && (
                <button
                  type="button"
                  onClick={() => onStartSession(path)}
                  aria-label={`New session in ${path}`}
                  title="New session here"
                  className={cn(
                    'rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/80',
                    'opacity-0 transition-opacity focus-visible:opacity-100',
                    'group-focus-within:opacity-100 group-hover:opacity-100',
                    '[@media(hover:none)]:opacity-100'
                  )}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {isExpanded && (
              <ul role="group">
                <FolderList
                  parentPath={path}
                  depth={depth + 1}
                  tree={tree}
                  selectedPath={selectedPath}
                  sessionCounts={sessionCounts}
                  onSelectFolder={onSelectFolder}
                  onStartSession={onStartSession}
                />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}

export function FolderTree({ agentUrl, ...rest }: FolderTreeProps) {
  const loadChildren = useCallback(
    (path: string) => fetchAgentFolders(agentUrl, path),
    [agentUrl]
  );
  const tree = useFolderTree(loadChildren);

  return (
    <ul role="tree" aria-label="Folders">
      <FolderList parentPath="" depth={0} tree={tree} {...rest} />
    </ul>
  );
}
