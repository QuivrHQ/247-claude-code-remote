import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

export interface InitScriptOptions {
  sessionName: string;
  projectName: string;
  customEnvVars?: Record<string, string>;
  /** Shell to use for init script content (prompt, history config). Always 'bash' since bash sources the file. */
  shell?: 'bash' | 'zsh';
  /** Shell to exec into at the end for the interactive session. Defaults to detected user shell. */
  targetShell?: 'bash' | 'zsh';
}

/**
 * Detects the user's default shell from environment or /etc/passwd.
 * Falls back to bash if detection fails.
 */
export function detectUserShell(): 'bash' | 'zsh' {
  // First try environment variable
  const envShell = process.env.SHELL || '';
  if (envShell.includes('zsh')) return 'zsh';
  if (envShell.includes('bash')) return 'bash';

  // If SHELL is not set (e.g., running as a service), read from /etc/passwd
  try {
    const user = process.env.USER || process.env.LOGNAME || os.userInfo().username;
    const result = execSync(`getent passwd ${user} | cut -d: -f7`, {
      encoding: 'utf-8',
      timeout: 1000,
    }).trim();
    if (result.includes('zsh')) return 'zsh';
  } catch {
    // Ignore errors, fall back to bash
  }

  return 'bash';
}

/**
 * Generates a bash/zsh init script for tmux session initialization.
 * Features: adaptive prompt, tmux status bar, useful aliases, welcome message.
 */
export function generateInitScript(options: InitScriptOptions): string {
  const {
    sessionName,
    projectName,
    customEnvVars = {},
    shell = 'bash',
    targetShell = detectUserShell(),
  } = options;

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

  // Animated robot boot loader with starfield
  // Skip animation in CI/test environments for faster startup
  const loaderAnimation = `
# ═══════════════════════════════════════════════════════════════
# Animated Loader: Robot AI boot sequence with starfield
# ═══════════════════════════════════════════════════════════════

# ANSI color codes
C_RESET=$'\\033[0m'
C_ORANGE=$'\\033[38;5;${colors.orange}m'
C_GREEN=$'\\033[38;5;${colors.green}m'
C_CYAN=$'\\033[38;5;${colors.cyan}m'
C_MUTED=$'\\033[38;5;${colors.muted}m'
C_WHITE=$'\\033[38;5;${colors.white}m'
C_MAGENTA=$'\\033[38;5;${colors.magenta}m'
C_BOLD=$'\\033[1m'
C_DIM=$'\\033[2m'

# Skip animation in CI/test environments (set by terminal.ts)
if [ -n "$_247_SKIP_ANIMATION" ]; then
  :  # No output, go straight to welcome message
else

# Hide cursor during animation
printf "\\033[?25l"
clear

# Terminal dimensions
COLS=$(tput cols 2>/dev/null || echo 80)
ROWS=$(tput lines 2>/dev/null || echo 24)

# ─────────────────────────────────────────────────────────────
# MOBILE FALLBACK: Simplified animation for narrow terminals
# ─────────────────────────────────────────────────────────────
if [ "$COLS" -lt 60 ]; then
  # Simple centered animation for mobile
  cx=$((COLS / 2 - 3))

  printf "\\n\\n"
  printf "%*s\\033[38;5;${colors.orange}m\\033[1m247\\033[0m\\n" "$cx" ""
  printf "\\n"
  printf "%*s\\033[38;5;${colors.muted}m┌───┐\\033[0m\\n" "$((cx-1))" ""
  printf "%*s\\033[38;5;${colors.muted}m│\\033[38;5;${colors.cyan}m- -\\033[38;5;${colors.muted}m│\\033[0m\\n" "$((cx-1))" ""
  printf "%*s\\033[38;5;${colors.muted}m└───┘\\033[0m\\n" "$((cx-1))" ""
  sleep 0.3

  # Wake up
  printf "\\033[5;$((cx-1))H\\033[38;5;${colors.white}m┌───┐\\033[0m"
  printf "\\033[6;$((cx-1))H\\033[38;5;${colors.white}m│\\033[38;5;${colors.cyan}m◕ ◕\\033[38;5;${colors.white}m│\\033[0m"
  printf "\\033[7;$((cx-1))H\\033[38;5;${colors.white}m└───┘\\033[0m"
  sleep 0.4

  # Progress - simple version for mobile
  for p in 25 50 75 100; do
    filled=$((p / 10))
    empty=$((10 - filled))
    printf "\\033[9;$((cx-5))H\\033[K"
    printf "\\033[38;5;${colors.orange}m"
    j=0; while [ $j -lt $filled ]; do printf "█"; j=$((j+1)); done
    printf "\\033[38;5;${colors.muted}m"
    j=0; while [ $j -lt $empty ]; do printf "░"; j=$((j+1)); done
    printf "\\033[0m %d%%" "$p"
    sleep 0.2
  done

  sleep 0.3
  printf "\\033[?25h"
  clear
else

# ─────────────────────────────────────────────────────────────
# STARFIELD: Twinkling stars background
# ─────────────────────────────────────────────────────────────
declare -a STAR_X STAR_Y STAR_CHAR
STAR_CHARS=("." "·" "+" "*" "✦" "✧")
NUM_STARS=25

init_stars() {
  for i in $(seq 0 $((NUM_STARS - 1))); do
    STAR_X[$i]=$((RANDOM % (COLS - 2) + 1))
    STAR_Y[$i]=$((RANDOM % (ROWS - 6) + 1))
    STAR_CHAR[$i]=\${STAR_CHARS[$((RANDOM % \${#STAR_CHARS[@]}))]}
  done
}

draw_stars() {
  local frame=$1
  for i in $(seq 0 $((NUM_STARS - 1))); do
    local x=\${STAR_X[$i]}
    local y=\${STAR_Y[$i]}
    local char_idx=$(( (frame + i) % \${#STAR_CHARS[@]} ))
    local char=\${STAR_CHARS[$char_idx]}
    # Twinkle effect: some stars dim/bright
    if [ $(( (frame + i) % 3 )) -eq 0 ]; then
      printf "\\033[\${y};\${x}H\\033[38;5;${colors.muted}m$char\\033[0m"
    else
      printf "\\033[\${y};\${x}H\\033[38;5;${colors.white}m$char\\033[0m"
    fi
  done
}

# ─────────────────────────────────────────────────────────────
# ROBOT: Cute AI robot with expressions
# ─────────────────────────────────────────────────────────────
draw_robot() {
  local state=$1  # boot, think, happy
  local cx=$((COLS / 2 - 4))
  local cy=8

  # Clear robot area
  for row in $(seq $cy $((cy + 5))); do
    printf "\\033[$row;$((cx-2))H                    "
  done

  case $state in
    boot)
      printf "\\033[$cy;\${cx}H\\033[38;5;${colors.muted}m  ┌───┐\\033[0m"
      printf "\\033[$((cy+1));\${cx}H\\033[38;5;${colors.muted}m  │\\033[38;5;${colors.cyan}m- -\\033[38;5;${colors.muted}m│\\033[0m"
      printf "\\033[$((cy+2));\${cx}H\\033[38;5;${colors.muted}m  │ \\033[38;5;${colors.white}m▽\\033[38;5;${colors.muted}m │\\033[0m"
      printf "\\033[$((cy+3));\${cx}H\\033[38;5;${colors.muted}m  └─┬─┘\\033[0m"
      printf "\\033[$((cy+4));\${cx}H\\033[38;5;${colors.muted}m   /|\\\\\\033[0m"
      ;;
    think)
      printf "\\033[$cy;\${cx}H\\033[38;5;${colors.white}m  ┌───┐\\033[0m"
      printf "\\033[$((cy+1));\${cx}H\\033[38;5;${colors.white}m  │\\033[38;5;${colors.cyan}m◔ ◔\\033[38;5;${colors.white}m│\\033[0m"
      printf "\\033[$((cy+2));\${cx}H\\033[38;5;${colors.white}m  │ \\033[38;5;${colors.orange}m○\\033[38;5;${colors.white}m │\\033[0m"
      printf "\\033[$((cy+3));\${cx}H\\033[38;5;${colors.white}m  └─┬─┘\\033[0m"
      printf "\\033[$((cy+4));\${cx}H\\033[38;5;${colors.white}m   /|\\\\\\033[0m"
      # Thinking sparkle
      printf "\\033[$((cy-1));$((cx+8))H\\033[38;5;${colors.magenta}m✦\\033[0m"
      ;;
    happy)
      printf "\\033[$cy;\${cx}H\\033[38;5;${colors.white}m  ┌───┐\\033[0m"
      printf "\\033[$((cy+1));\${cx}H\\033[38;5;${colors.white}m  │\\033[38;5;${colors.cyan}m◕ ◕\\033[38;5;${colors.white}m│\\033[0m"
      printf "\\033[$((cy+2));\${cx}H\\033[38;5;${colors.white}m  │ \\033[38;5;${colors.green}m◡\\033[38;5;${colors.white}m │\\033[0m"
      printf "\\033[$((cy+3));\${cx}H\\033[38;5;${colors.white}m  └─┬─┘\\033[0m"
      printf "\\033[$((cy+4));\${cx}H\\033[38;5;${colors.white}m  \\\\|/\\033[0m"
      # Happy sparkles
      printf "\\033[$((cy-1));$((cx-1))H\\033[38;5;${colors.orange}m✧\\033[0m"
      printf "\\033[$cy;$((cx+9))H\\033[38;5;${colors.green}m✦\\033[0m"
      printf "\\033[$((cy+2));$((cx-2))H\\033[38;5;${colors.cyan}m·\\033[0m"
      ;;
  esac
}

# ─────────────────────────────────────────────────────────────
# LOGO: 247 with scan effect
# ─────────────────────────────────────────────────────────────
draw_logo() {
  local scan_pos=$1
  local lx=$((COLS / 2 - 12))
  local ly=2

  # Logo lines
  local L1="  ██████  ██  ██ ███████"
  local L2="      ██  ██  ██      ██"
  local L3="  █████   ██████      ██"
  local L4="  ██          ██      ██"
  local L5="  ███████     ██      ██"

  # Draw with optional scan highlight
  local lines=("$L1" "$L2" "$L3" "$L4" "$L5")
  for i in $(seq 0 4); do
    printf "\\033[$((ly + i));\${lx}H"
    if [ "$scan_pos" -eq "$i" ]; then
      printf "\\033[38;5;${colors.white}m\\033[1m\${lines[$i]}\\033[0m"
    else
      printf "\\033[38;5;${colors.orange}m\${lines[$i]}\\033[0m"
    fi
  done
}

# ─────────────────────────────────────────────────────────────
# PROGRESS BAR: Animated with gradient
# ─────────────────────────────────────────────────────────────
show_progress() {
  local steps=("⚡ Booting up..." "🔧 Loading config..." "🌐 Connecting..." "✨ Ready!")
  local total=\${#steps[@]}
  local bar_width=30
  local bx=$((COLS / 2 - bar_width / 2 - 3))
  local by=16

  for i in "\${!steps[@]}"; do
    local step=\${steps[$i]}
    local progress=$(( (i + 1) * 100 / total ))
    local filled=$(( progress * bar_width / 100 ))
    local empty=$(( bar_width - filled ))

    # Draw starfield frame
    draw_stars $i

    # Progress bar with rounded corners
    printf "\\033[$by;\${bx}H\\033[K"
    printf "\\033[38;5;${colors.muted}m╭\\033[0m"
    printf "\\033[38;5;${colors.orange}m%*s\\033[0m" "$filled" "" | tr ' ' '█'
    printf "\\033[38;5;${colors.muted}m%*s\\033[0m" "$empty" "" | tr ' ' '░'
    printf "\\033[38;5;${colors.muted}m╮\\033[0m"
    printf " \\033[38;5;${colors.cyan}m%3d%%\\033[0m" "$progress"

    # Status message
    printf "\\033[$((by + 1));\${bx}H\\033[K"
    printf "\\033[38;5;${colors.muted}m  $step\\033[0m"

    sleep 0.35
  done
}

# ─────────────────────────────────────────────────────────────
# MAIN ANIMATION SEQUENCE (~3s)
# ─────────────────────────────────────────────────────────────
init_stars

# Phase 1: Starfield appears (0.2s)
for f in $(seq 0 2); do
  draw_stars $f
  sleep 0.07
done

# Phase 2: Logo with scan effect (0.6s)
for scan in $(seq 0 5); do
  draw_logo $((scan % 6))
  draw_stars $scan
  sleep 0.1
done
draw_logo -1  # Final state (no highlight)

# Phase 3: Robot boot sequence (0.8s)
draw_robot "boot"
sleep 0.25
draw_stars 7
draw_robot "think"
sleep 0.35
draw_stars 8

# Phase 4: Progress bar (1.0s)
show_progress

# Phase 5: Robot happy (0.4s)
draw_robot "happy"
for f in $(seq 9 12); do
  draw_stars $f
  sleep 0.08
done

# Show cursor
printf "\\033[?25h"
sleep 0.3
clear

fi  # End of desktop/mobile conditional

fi  # End of animation conditional`;

  const welcomeMessage = `
${loaderAnimation}

# Welcome message
printf "\\n"
printf "  \${C_MUTED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${C_RESET}\\n"
printf "  \${C_ORANGE}\${C_BOLD}247\${C_RESET} \${C_MUTED}│\${C_RESET} \${C_GREEN}${escapedProject}\${C_RESET}\\n"
printf "  \${C_MUTED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${C_RESET}\\n"
printf "  \${C_MUTED}Session:\${C_RESET} \${C_CYAN}${escapedSession}\${C_RESET}\\n"
printf "  \${C_MUTED}Tips:   \${C_RESET} \${C_DIM}Type\${C_RESET} \${C_ORANGE}claude\${C_RESET} \${C_DIM}to start Claude Code\${C_RESET}\\n"
printf "  \${C_MUTED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${C_RESET}\\n"
printf "\\n"`;

  const promptConfig = shell === 'zsh' ? zshPromptConfig : bashPromptConfig;

  return `#!/bin/bash
# 247 Terminal Init Script - Auto-generated
# Session: ${sessionName}
# Project: ${projectName}
# Init Shell: ${shell} (for script content)
# Target Shell: ${targetShell} (interactive session)
# Generated: ${new Date().toISOString()}

# ═══════════════════════════════════════════════════════════════
# SECTION 1: Environment Variables
# ═══════════════════════════════════════════════════════════════
export AGENT_247_SESSION="${escapedSession}"
export CLAUDE_TMUX_SESSION="${escapedSession}"
export CODEX_TMUX_SESSION="${escapedSession}"
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
# SECTION 7: Start Session
# ═══════════════════════════════════════════════════════════════
exec ${targetShell} -i
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
