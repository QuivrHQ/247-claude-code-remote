import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Terminal {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onData(callback: (data: string) => void): void;
  onExit(callback: (info: { exitCode: number }) => void): void;
  kill(): void;
  detach(): void;
  captureHistory(lines?: number): Promise<string>;
  isExistingSession(): boolean;
}

export function createTerminal(cwd: string, sessionName: string): Terminal {
  // Check if session already exists before spawning
  let existingSession = false;
  try {
    execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`);
    existingSession = true;
  } catch {
    existingSession = false;
  }

  // Use tmux for session persistence
  // -A = attach if session exists, create if not
  // -s = session name
  // -c = working directory
  // -e = set environment variable (so Claude hooks can identify this session)
  const shell = pty.spawn('tmux', [
    'new-session',
    '-A',
    '-s', sessionName,
    '-c', cwd,
    '-e', `CLAUDE_TMUX_SESSION=${sessionName}`,
  ], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      PATH: `/opt/homebrew/bin:${process.env.PATH}`,
    } as { [key: string]: string },
  });

  // If new session, configure tmux options
  if (!existingSession) {
    setTimeout(() => {
      exec(`tmux set-option -t "${sessionName}" history-limit 10000`);
      exec(`tmux set-option -t "${sessionName}" mouse on`);
    }, 100);
  } else {
    // Also enable mouse for existing sessions
    setTimeout(() => {
      exec(`tmux set-option -t "${sessionName}" mouse on`);
    }, 100);
  }

  return {
    write: (data) => shell.write(data),
    resize: (cols, rows) => shell.resize(cols, rows),
    onData: (callback) => shell.onData(callback),
    onExit: (callback) => shell.onExit(callback),
    kill: () => shell.kill(),
    detach: () => {
      // Send tmux detach command (Ctrl+B, d)
      shell.write('\x02d');
    },
    isExistingSession: () => existingSession,
    captureHistory: async (lines = 10000): Promise<string> => {
      try {
        // Capture scrollback buffer from tmux
        // -p = print to stdout
        // -S -N = start from N lines back (negative = from start of history)
        // -J = preserve trailing spaces for proper formatting
        const { stdout } = await execAsync(
          `tmux capture-pane -t "${sessionName}" -p -S -${lines} -J 2>/dev/null`
        );
        return stdout;
      } catch {
        return '';
      }
    },
  };
}
