import { buildApiUrl } from '@/lib/utils';

/** Join a parent folder path and a child name (`''` is the base folder). */
export function joinFolderPath(parent: string, name: string): string {
  return parent === '' ? name : `${parent}/${name}`;
}

/** True when `project` is the filtered folder or lives somewhere below it. */
export function matchesProjectFilter(project: string, folder: string): boolean {
  return project === folder || project.startsWith(`${folder}/`);
}

/**
 * Session counts per project path, grouped by machine id. Uses null-prototype
 * objects so folder/machine names like `__proto__` are ordinary keys and can
 * never write through the prototype chain.
 */
export function countSessionsByMachine(
  sessions: ReadonlyArray<{ machineId: string; project: string }>
): Record<string, Record<string, number>> {
  const byMachine: Record<string, Record<string, number>> = Object.create(null);
  for (const { machineId, project } of sessions) {
    const forMachine = (byMachine[machineId] ??= Object.create(null));
    forMachine[project] = (forMachine[project] ?? 0) + 1;
  }
  return byMachine;
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
