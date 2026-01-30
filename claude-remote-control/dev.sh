#!/bin/bash
# 247 Development Server Launcher
# Creates a tmux session with web and agent in split panes

SESSION="247-dev"
DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill existing session if it exists
tmux kill-session -t $SESSION 2>/dev/null

# Create new session with web server
tmux new-session -d -s $SESSION -n dev -c "$DIR"
tmux send-keys -t $SESSION "pnpm dev:web" C-m

# Split horizontally and start agent
tmux split-window -h -t $SESSION -c "$DIR"
tmux send-keys -t $SESSION "pnpm dev:agent" C-m

# Select first pane (web)
tmux select-pane -t $SESSION:0.0

# Attach to session
tmux attach-session -t $SESSION
