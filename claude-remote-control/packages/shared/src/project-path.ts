const MAX_PROJECT_PATH_LENGTH = 512;
const MAX_PROJECT_PATH_DEPTH = 8;

const SLUG_PASSTHROUGH = /^[A-Za-z0-9]$/;
const HEX_PAIR = /^[0-9a-f]{2}$/;
const REPLACEMENT_CHARACTER_BYTES: readonly number[] = [0xef, 0xbf, 0xbd];

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

function utf8Bytes(char: string): readonly number[] {
  if (char.length === 1 && char.charCodeAt(0) < 0x80) return [char.charCodeAt(0)];
  try {
    return encodeURIComponent(char)
      .split('%')
      .slice(1)
      .map((hex) => parseInt(hex, 16));
  } catch {
    return REPLACEMENT_CHARACTER_BYTES;
  }
}

function byteEscape(byte: number): string {
  return `_${byte.toString(16).padStart(2, '0')}`;
}

/**
 * Encode a (possibly nested) project path as a tmux-safe, reversible slug made
 * only of letters, digits, `_` and `-`:
 *
 * - `/` becomes `__`
 * - every other character outside `[A-Za-z0-9]` is written as `_xx` per UTF-8
 *   byte (so `_` itself is `_5f`), which keeps the encoding injective
 * - hyphens are kept unless adjacent to another hyphen or at either end, so
 *   the result never contains the `--` project/label separator
 *
 * `group/app` → `group__app`, `my app` → `my_20app`, `my_app` → `my_5fapp`.
 */
export function projectSlug(project: string): string {
  const chars = Array.from(project);

  return chars
    .map((char, index) => {
      if (char === '/') return '__';
      if (SLUG_PASSTHROUGH.test(char)) return char;

      const isEdge = index === 0 || index === chars.length - 1;
      const isDoubled = chars[index - 1] === '-' || chars[index + 1] === '-';
      if (char === '-' && !isEdge && !isDoubled) return char;

      return utf8Bytes(char).map(byteEscape).join('');
    })
    .join('');
}

/**
 * Reverse of {@link projectSlug}. Input that is not a valid slug (for example a
 * legacy name containing a stray `_ab`) is returned unchanged.
 */
export function decodeProjectSlug(slug: string): string {
  try {
    let result = '';
    let pendingBytes = '';

    for (let i = 0; i < slug.length; ) {
      const char = slug[i];

      if (char === '_') {
        if (slug[i + 1] === '_') {
          result += `${decodeURIComponent(pendingBytes)}/`;
          pendingBytes = '';
          i += 2;
          continue;
        }

        const hex = slug.slice(i + 1, i + 3);
        if (HEX_PAIR.test(hex)) {
          pendingBytes += `%${hex}`;
          i += 3;
          continue;
        }
      }

      result += `${decodeURIComponent(pendingBytes)}${char}`;
      pendingBytes = '';
      i += 1;
    }

    return result + decodeURIComponent(pendingBytes);
  } catch {
    return slug;
  }
}
