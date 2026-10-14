/**
 * Helpers for talking to tmux.
 *
 * Session names come from untrusted input (the `session` URL parameter of the terminal
 * WebSocket), so tmux is always spawned directly with an argv array. Never build a tmux
 * command string and hand it to a shell.
 */

import { execFile, execFileSync } from 'child_process';

const TMUX = 'tmux';

/** True if a tmux session with this name exists. */
export function tmuxSessionExists(sessionName: string): boolean {
  try {
    execFileSync(TMUX, ['has-session', '-t', sessionName], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Run a tmux command. Resolves with stdout, rejects if tmux exits non-zero. */
export function runTmux(args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(TMUX, [...args], { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Prepare literal text for `tmux send-keys -- <text>`.
 * tmux treats an argument ending in ';' as a command separator and drops the ';';
 * `\;` makes it a literal semicolon again.
 */
export function escapeSendKeysText(text: string): string {
  return text.replace(/;$/, '\\;');
}
