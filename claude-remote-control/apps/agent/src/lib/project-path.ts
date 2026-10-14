import path from 'path';
import { realpath } from 'fs/promises';
import { isSafeProjectPath, projectFromSessionName } from '247-shared';

/**
 * Project a tmux session belongs to. Prefer the project stored when the
 * session was created (the real, possibly nested, path); fall back to decoding
 * it from the session name.
 */
export function sessionProject(sessionName: string, storedProject?: string | null): string {
  if (storedProject !== undefined && storedProject !== null && storedProject !== 'unknown') {
    return storedProject;
  }
  return projectFromSessionName(sessionName);
}

/** True when `child` is `root` itself or lives somewhere beneath it. */
function isWithin(root: string, child: string): boolean {
  const relative = path.relative(root, child);
  return (
    relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  );
}

/**
 * Resolve a project path (relative to `basePath`, `/`-separated) to an absolute
 * directory. Returns null when the path is unsafe or would lexically escape
 * `basePath`. Does not follow symlinks — use {@link resolveRealProjectPath}
 * before touching the filesystem.
 */
export function resolveProjectPath(basePath: string, project: string): string | null {
  if (!isSafeProjectPath(project)) return null;

  const root = path.resolve(basePath);
  const resolved = path.resolve(root, project);
  // Reject the root itself (project must name a child) and anything outside it.
  if (resolved === root || !isWithin(root, resolved)) return null;
  return resolved;
}

/**
 * Like {@link resolveProjectPath}, but also follows symlinks and verifies the
 * real target stays within the real base path, so a symlink under `basePath`
 * cannot point the agent at a directory outside the configured root.
 *
 * Returns null when the path is unsafe or its real target escapes the root.
 * Filesystem errors (e.g. ENOENT for a missing directory) propagate so callers
 * can distinguish "not found" from "not allowed".
 */
export async function resolveRealProjectPath(
  basePath: string,
  project: string
): Promise<string | null> {
  const resolved = resolveProjectPath(basePath, project);
  if (resolved === null) return null;

  const realRoot = await realpath(path.resolve(basePath));
  const realTarget = await realpath(resolved);
  return isWithin(realRoot, realTarget) ? resolved : null;
}
