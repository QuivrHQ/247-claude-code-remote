import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface InitScriptOptions {
  sessionName: string;
  projectName: string;
  customEnvVars?: Record<string, string>;
  shell?: 'bash' | 'zsh';
}

/**
 * Detects the user's default shell from environment.
 */
export function detectUserShell(): 'bash' | 'zsh' {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  return 'bash';
}

/**
 * Generates a bash/zsh init script for tmux session initialization.
 * Features: adaptive prompt, tmux status bar, useful aliases, welcome message.
 */
export function generateInitScript(options: InitScriptOptions): string {
  const { sessionName, projectName, customEnvVars = {}, shell = detectUserShell() } = options;

  const escapedSession = escapeForBash(sessionName);
  const escapedProject = escapeForBash(projectName);

  // Build custom env var exports
  const customExports: string[] = [];
  for (const [key, value] of Object.entries(customEnvVars)) {
    if (value && value.trim() !== '') {
      customExports.push(`export ${key}="${escapeForBash(value)}"`);
    }
  }

  // Colors matching xterm theme (256-color codes)
  const colors = {
    orange: '208', // #f97316 - accent
    green: '114', // #4ade80
    cyan: '80', // #22d3ee
    muted: '245', // #52525b
    magenta: '141', // #c084fc - git branch
    red: '203', // #f87171 - error
    white: '255', // #e4e4e7
  };

  // tmux status bar config
  const tmuxStatusConfig = `
# tmux status bar - minimal with project info
tmux set-option -t "${escapedSession}" status on 2>/dev/null
tmux set-option -t "${escapedSession}" status-position bottom 2>/dev/null
tmux set-option -t "${escapedSession}" status-interval 10 2>/dev/null
tmux set-option -t "${escapedSession}" status-style "bg=#1a1a2e,fg=#e4e4e7" 2>/dev/null
tmux set-option -t "${escapedSession}" status-left "#[fg=#f97316,bold] 247 #[fg=#52525b]|#[fg=#e4e4e7] ${escapedProject} " 2>/dev/null
tmux set-option -t "${escapedSession}" status-left-length 40 2>/dev/null
tmux set-option -t "${escapedSession}" status-right "#[fg=#52525b]|#[fg=#4ade80] %H:%M " 2>/dev/null
tmux set-option -t "${escapedSession}" status-right-length 20 2>/dev/null`;

  // Prompt configuration - adapts to terminal width
  // Note: $ doesn't need escaping in JS template literals except before {
  const bashPromptConfig = `
# Adaptive prompt - compact on mobile, full on desktop
_247_prompt_command() {
  local exit_code=$?
  local cols=$(tput cols 2>/dev/null || echo 80)

  # Exit code indicator (red X if failed)
  local exit_ind=""
  if [ $exit_code -ne 0 ]; then
    exit_ind="\\[\\e[38;5;${colors.red}m\\]x \\[\\e[0m\\]"
  fi

  # Git branch (if in git repo)
  local git_branch=""
  if command -v git &>/dev/null; then
    git_branch=$(git symbolic-ref --short HEAD 2>/dev/null)
    if [ -n "$git_branch" ]; then
      git_branch=" \\[\\e[38;5;${colors.magenta}m\\]($git_branch)\\[\\e[0m\\]"
    fi
  fi

  # Short path (last 2 components)
  local short_path="\${PWD##*/}"
  local parent="\${PWD%/*}"
  parent="\${parent##*/}"
  if [ "$parent" != "" ] && [ "$parent" != "$short_path" ]; then
    short_path="$parent/$short_path"
  fi

  # Mobile (<60 cols): ultra-compact
  # Desktop: full info with git branch
  if [ "$cols" -lt 60 ]; then
    PS1="\${exit_ind}\\[\\e[38;5;${colors.orange}m\\]$short_path\\[\\e[0m\\] \\[\\e[38;5;${colors.orange}m\\]>\\[\\e[0m\\] "
  else
    PS1="\${exit_ind}\\[\\e[38;5;${colors.muted}m\\][\\[\\e[38;5;${colors.green}m\\]$short_path\\[\\e[0m\\]\${git_branch}\\[\\e[38;5;${colors.muted}m\\]]\\[\\e[0m\\] \\[\\e[38;5;${colors.orange}m\\]>\\[\\e[0m\\] "
  fi
}

PROMPT_COMMAND="_247_prompt_command"`;

  const zshPromptConfig = `
# Adaptive prompt - compact on mobile, full on desktop
setopt PROMPT_SUBST

_247_precmd() {
  local exit_code=$?
  local cols=$COLUMNS

  # Exit indicator
  local exit_ind=""
  if [[ $exit_code -ne 0 ]]; then
    exit_ind="%F{${colors.red}}x %f"
  fi

  # Git branch
  local git_branch=""
  if command -v git &>/dev/null; then
    git_branch=$(git symbolic-ref --short HEAD 2>/dev/null)
    [[ -n "$git_branch" ]] && git_branch=" %F{${colors.magenta}}($git_branch)%f"
  fi

  # Mobile vs Desktop
  if (( cols < 60 )); then
    PROMPT="\${exit_ind}%F{${colors.orange}}%1~%f %F{${colors.orange}}>%f "
  else
    PROMPT="\${exit_ind}%F{${colors.muted}}[%F{${colors.green}}%2~%f\${git_branch}%F{${colors.muted}}]%f %F{${colors.orange}}>%f "
  fi
}

precmd_functions+=(_247_precmd)`;

  const historyConfig =
    shell === 'zsh'
      ? `
# History configuration (zsh)
HISTSIZE=50000
SAVEHIST=100000
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE
setopt SHARE_HISTORY
setopt EXTENDED_HISTORY`
      : `
# History configuration (bash)
export HISTSIZE=50000
export HISTFILESIZE=100000
export HISTCONTROL=ignoreboth:erasedups
export HISTIGNORE="ls:cd:pwd:exit:clear:history"
shopt -s histappend`;

  const aliases = `
# 247 Aliases
alias c='claude'
alias cc='claude --continue'
alias cr='claude --resume'

# Git shortcuts
alias gs='git status'
alias gd='git diff'
alias gl='git log --oneline -15'
alias gco='git checkout'

# Navigation & dev
alias ll='ls -lah'
alias ..='cd ..'
alias ...='cd ../..'`;

  const welcomeMessage = `
# Welcome message
echo ""
echo -e "\\e[38;5;${colors.muted}m─────────────────────────────────────────────\\e[0m"
echo -e "\\e[38;5;${colors.orange}m\\e[1m 247\\e[0m \\e[38;5;${colors.muted}m|\\e[0m \\e[38;5;${colors.green}m${escapedProject}\\e[0m"
echo -e "\\e[38;5;${colors.muted}m─────────────────────────────────────────────\\e[0m"
echo -e "\\e[38;5;${colors.muted}mSession:\\e[0m \\e[38;5;${colors.cyan}m${escapedSession}\\e[0m"
echo -e "\\e[38;5;${colors.muted}mTips:   \\e[0m \\e[38;5;${colors.muted}mType\\e[0m c \\e[38;5;${colors.muted}mto start Claude Code\\e[0m"
echo -e "\\e[38;5;${colors.muted}m─────────────────────────────────────────────\\e[0m"
echo ""`;

  const promptConfig = shell === 'zsh' ? zshPromptConfig : bashPromptConfig;

  return `#!/bin/bash
# 247 Terminal Init Script - Auto-generated
# Session: ${sessionName}
# Project: ${projectName}
# Shell: ${shell}
# Generated: ${new Date().toISOString()}

# ═══════════════════════════════════════════════════════════════
# SECTION 1: Environment Variables
# ═══════════════════════════════════════════════════════════════
export CLAUDE_TMUX_SESSION="${escapedSession}"
export CLAUDE_PROJECT="${escapedProject}"
export TERM="xterm-256color"
export COLORTERM="truecolor"
export LANG="\${LANG:-en_US.UTF-8}"
export LC_ALL="\${LC_ALL:-en_US.UTF-8}"
${customExports.length > 0 ? customExports.join('\n') : ''}

# ═══════════════════════════════════════════════════════════════
# SECTION 2: tmux Configuration
# ═══════════════════════════════════════════════════════════════
tmux set-option -t "${escapedSession}" history-limit 50000 2>/dev/null
tmux set-option -t "${escapedSession}" mouse on 2>/dev/null
tmux set-option -t "${escapedSession}" focus-events on 2>/dev/null
${tmuxStatusConfig}

# ═══════════════════════════════════════════════════════════════
# SECTION 3: History Configuration
# ═══════════════════════════════════════════════════════════════
${historyConfig}

# ═══════════════════════════════════════════════════════════════
# SECTION 4: Prompt Configuration
# ═══════════════════════════════════════════════════════════════
${promptConfig}

# ═══════════════════════════════════════════════════════════════
# SECTION 5: Useful Aliases
# ═══════════════════════════════════════════════════════════════
${aliases}

# ═══════════════════════════════════════════════════════════════
# SECTION 6: Welcome Message
# ═══════════════════════════════════════════════════════════════
${welcomeMessage}

# ═══════════════════════════════════════════════════════════════
# SECTION 7: Start Interactive Shell
# ═══════════════════════════════════════════════════════════════
exec ${shell} -i
`;
}

/**
 * Escapes a string for safe use in bash double-quoted strings.
 */
function escapeForBash(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
}

/**
 * Writes the init script to a temporary file.
 * @returns The path to the created script file.
 */
export function writeInitScript(sessionName: string, content: string): string {
  const scriptPath = path.join(os.tmpdir(), `247-init-${sessionName}.sh`);
  fs.writeFileSync(scriptPath, content, { mode: 0o755 });
  return scriptPath;
}

/**
 * Removes the init script file.
 */
export function cleanupInitScript(sessionName: string): void {
  const scriptPath = path.join(os.tmpdir(), `247-init-${sessionName}.sh`);
  try {
    fs.unlinkSync(scriptPath);
  } catch {
    // Ignore errors (file might already be deleted)
  }
}

/**
 * Gets the path where an init script would be written.
 */
export function getInitScriptPath(sessionName: string): string {
  return path.join(os.tmpdir(), `247-init-${sessionName}.sh`);
}
