#!/bin/bash
set -euo pipefail

# Read stdin for hook input
INPUT=$(cat)

# Extract event details
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"' 2>/dev/null || echo "unknown")
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"' 2>/dev/null || echo "unknown")
NOTIFICATION_TYPE=$(echo "$INPUT" | jq -r '.notification_type // ""' 2>/dev/null || echo "")
STOP_REASON=$(echo "$INPUT" | jq -r '.stop_reason // ""' 2>/dev/null || echo "")
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || echo "")

# Detect tmux session name (primary method: use tmux command - most reliable)
TMUX_SESSION=""
if [ -n "$TMUX" ]; then
  TMUX_SESSION=$(tmux display-message -p '#{session_name}' 2>/dev/null || echo "")
fi

# Fallback: use CLAUDE_TMUX_SESSION env var (set by agent on session creation)
if [ -z "$TMUX_SESSION" ]; then
  TMUX_SESSION="${CLAUDE_TMUX_SESSION:-}"
fi

# Get project name from cwd (last component of path)
PROJECT=$(basename "$CWD" 2>/dev/null || echo "")

# Get current timestamp in milliseconds
TIMESTAMP=$(($(date +%s) * 1000))

# Notify local agent with full event data
curl -s -X POST "http://localhost:4678/api/hooks/status" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"$EVENT\",
    \"session_id\": \"$SESSION_ID\",
    \"tmux_session\": \"$TMUX_SESSION\",
    \"project\": \"$PROJECT\",
    \"cwd\": \"$CWD\",
    \"notification_type\": \"$NOTIFICATION_TYPE\",
    \"stop_reason\": \"$STOP_REASON\",
    \"tool_name\": \"$TOOL_NAME\",
    \"timestamp\": $TIMESTAMP
  }" > /dev/null 2>&1 || true

# Exit successfully (don't block Claude)
exit 0
