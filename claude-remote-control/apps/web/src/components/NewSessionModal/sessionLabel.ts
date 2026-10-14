import { buildSessionName, isValidSessionLabel, sanitizeSessionLabel } from '247-shared';

export type SessionLabelState =
  | { status: 'empty' }
  | { status: 'valid'; label: string; sessionName: string }
  | { status: 'invalid'; error: string };

/**
 * Validate the optional custom session name typed in the New Session dialog.
 * `takenSessionNames` are the full tmux names already used on the machine.
 */
export function resolveSessionLabel(
  input: string,
  project: string,
  takenSessionNames: ReadonlySet<string>
): SessionLabelState {
  if (input.trim() === '') return { status: 'empty' };

  const label = sanitizeSessionLabel(input);
  if (label === '') {
    return { status: 'invalid', error: 'Use letters, numbers, "-" or "_".' };
  }
  if (!isValidSessionLabel(label)) {
    return { status: 'invalid', error: `"${label}" is reserved. Pick another name.` };
  }

  const sessionName = buildSessionName(project, label);
  if (takenSessionNames.has(sessionName)) {
    return {
      status: 'invalid',
      error: 'A session with this name already exists on this machine.',
    };
  }

  return { status: 'valid', label, sessionName };
}
