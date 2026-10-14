const MAX_PROJECT_PATH_LENGTH = 512;
const MAX_PROJECT_PATH_DEPTH = 8;

/**
 * True when `project` is a safe path relative to the projects base folder:
 * non-empty, `/`-separated, no empty/`.`/`..`/hidden segments, no backslashes
 * or NUL bytes, and within sane length and depth limits. The root terminal
 * (empty string) is handled by callers and is not a "project path".
 */
export function isSafeProjectPath(project: string): boolean {
  if (project === '' || project.length > MAX_PROJECT_PATH_LENGTH) return false;
  if (/[\\\0]/.test(project)) return false;

  const segments = project.split('/');
  if (segments.length > MAX_PROJECT_PATH_DEPTH) return false;
  return segments.every((segment) => segment !== '' && !segment.startsWith('.'));
}

/**
 * Flatten a (possibly nested) project path so it can be embedded in a tmux
 * session name, where `/` is not allowed: `group/app` becomes `group__app`.
 */
export function projectSlug(project: string): string {
  return project.split('/').join('__');
}
