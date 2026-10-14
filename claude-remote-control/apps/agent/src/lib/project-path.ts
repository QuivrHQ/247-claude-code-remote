import path from 'path';
import { isSafeProjectPath } from '247-shared';

/**
 * Project a tmux session belongs to. Prefer the project stored when the
 * session was created (the real, possibly nested, path); fall back to the
 * session-name prefix, which is only a flattened slug for nested projects.
 */
export function sessionProject(sessionName: string, storedProject?: string | null): string {
  if (storedProject !== undefined && storedProject !== null && storedProject !== 'unknown') {
    return storedProject;
  }
  return sessionName.split('--')[0];
}

/**
 * Resolve a project path (relative to `basePath`, `/`-separated) to an absolute
 * directory. Returns null when the path is unsafe or would escape `basePath`.
 */
export function resolveProjectPath(basePath: string, project: string): string | null {
  if (!isSafeProjectPath(project)) return null;

  const root = path.resolve(basePath);
  const resolved = path.resolve(root, project);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}
