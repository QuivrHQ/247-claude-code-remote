import { decodeProjectSlug, projectSlug } from './project-path.js';

/** Separates the project from the user-facing label in a session name. */
export const SESSION_NAME_SEPARATOR = '--';

export const MAX_SESSION_LABEL_LENGTH = 40;

/** `<project>--new` marks a session that has not been named yet. */
const RESERVED_SESSION_LABELS: ReadonlySet<string> = new Set(['new']);

const CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/**
 * Turn free-form user input into a label that is safe inside a tmux session
 * name: letters, digits, `_` and `-`, never containing the `--` separator.
 * Russian text is transliterated; anything else unsupported is dropped.
 * Returns an empty string when nothing usable remains.
 */
export function sanitizeSessionLabel(input: string): string {
  const transliterated = Array.from(input, (char) => CYRILLIC_TO_LATIN[char.toLowerCase()] ?? char);

  return transliterated
    .join('')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_SESSION_LABEL_LENGTH)
    .replace(/-+$/, '');
}

/** True when the label is non-empty, already clean, and not reserved. */
export function isValidSessionLabel(label: string): boolean {
  return (
    label !== '' &&
    label === sanitizeSessionLabel(label) &&
    !RESERVED_SESSION_LABELS.has(label.toLowerCase())
  );
}

/**
 * Recover the project from a session name. The project is everything before
 * the last `--` separator (labels never contain `--`), decoded from its slug.
 */
export function projectFromSessionName(sessionName: string): string {
  const separatorIndex = sessionName.lastIndexOf(SESSION_NAME_SEPARATOR);
  const slug = separatorIndex === -1 ? sessionName : sessionName.slice(0, separatorIndex);
  return decodeProjectSlug(slug);
}

/**
 * Build the tmux session name for a project and an already-sanitized label.
 * The project is slug-encoded (see `projectSlug`) so the name only contains
 * letters, digits, `_` and `-`, and distinct projects never collide.
 */
export function buildSessionName(project: string, label: string): string {
  return `${projectSlug(project) || 'root'}${SESSION_NAME_SEPARATOR}${label}`;
}
