'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface FolderNodeState {
  status: 'loading' | 'loaded' | 'error';
  children: readonly string[];
}

export interface UseFolderTreeReturn {
  /** Loaded state per folder path; the base folder is keyed by `''`. */
  nodes: Readonly<Record<string, FolderNodeState>>;
  expanded: ReadonlySet<string>;
  toggle: (path: string) => void;
  retry: (path: string) => void;
}

/**
 * Lazy folder-tree state: the base folder loads on mount, deeper folders load
 * the first time they are expanded. Switching `loadChildren` (e.g. to another
 * machine) discards the old tree and ignores any responses still in flight.
 */
export function useFolderTree(
  loadChildren: (path: string) => Promise<string[]>
): UseFolderTreeReturn {
  const [nodes, setNodes] = useState<Record<string, FolderNodeState>>({});
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const generationRef = useRef(0);

  const load = useCallback(
    async (path: string) => {
      const generation = generationRef.current;
      setNodes((prev) => ({
        ...prev,
        [path]: { status: 'loading', children: prev[path]?.children ?? [] },
      }));

      try {
        const children = await loadChildren(path);
        if (generation !== generationRef.current) return;
        setNodes((prev) => ({ ...prev, [path]: { status: 'loaded', children } }));
      } catch {
        if (generation !== generationRef.current) return;
        setNodes((prev) => ({ ...prev, [path]: { status: 'error', children: [] } }));
      }
    },
    [loadChildren]
  );

  useEffect(() => {
    generationRef.current += 1;
    setNodes({});
    setExpanded(new Set());
    void load('');
  }, [load]);

  const toggle = useCallback(
    (path: string) => {
      const wasExpanded = expanded.has(path);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (wasExpanded) next.delete(path);
        else next.add(path);
        return next;
      });

      const node = nodes[path];
      if (!wasExpanded && (node === undefined || node.status === 'error')) {
        void load(path);
      }
    },
    [expanded, nodes, load]
  );

  const retry = useCallback((path: string) => void load(path), [load]);

  return { nodes, expanded, toggle, retry };
}
