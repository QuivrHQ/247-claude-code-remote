import { projectSlug } from '247-shared';
import { buildApiUrl } from '@/lib/utils';

/** Join a parent folder path and a child name (`''` is the base folder). */
export function joinFolderPath(parent: string, name: string): string {
  return parent === '' ? name : `${parent}/${name}`;
}

/** True when two project references point at the same folder (path or slug form). */
export function isSameProject(a: string, b: string): boolean {
  return projectSlug(a) === projectSlug(b);
}

/**
 * True when `project` is the filtered folder or lives somewhere below it.
 * Compares slugs because sessions created by hooks only know the flattened
 * name prefix (`group__app`), not the real path (`group/app`).
 */
export function matchesProjectFilter(project: string, folder: string): boolean {
  const slug = projectSlug(project);
  const folderSlug = projectSlug(folder);
  return slug === folderSlug || slug.startsWith(`${folderSlug}__`);
}

/** Total sessions for a folder, including everything nested under it. */
export function countSessionsUnder(
  countsByProject: Readonly<Record<string, number>>,
  folder: string
): number {
  return Object.entries(countsByProject).reduce(
    (total, [project, count]) => (matchesProjectFilter(project, folder) ? total + count : total),
    0
  );
}

/** List child folder names of `path` (`''` = base folder) on an agent. */
export async function fetchAgentFolders(agentUrl: string, path: string): Promise<string[]> {
  const query = path === '' ? '' : `?path=${encodeURIComponent(path)}`;
  const response = await fetch(buildApiUrl(agentUrl, `/api/folders${query}`));
  if (!response.ok) {
    throw new Error(`Failed to load folders (${response.status})`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) return [];
  return data.filter((entry): entry is string => typeof entry === 'string');
}
