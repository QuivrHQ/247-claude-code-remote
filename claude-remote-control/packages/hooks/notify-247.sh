#!/bin/bash
# 247 Hook Script for Claude Code + Codex
# VERSION: 2.32.0
# Ultra simple: hook called = needs_attention
set -euo pipefail

AGENT_URL="http://${AGENT_247_HOST:-localhost}:${AGENT_247_PORT:-4678}/api/hooks/status"

# Read stdin only if it's not a TTY (Claude/Codex send JSON via stdin)
PAYLOAD=""
if [ $# -gt 0 ] && [ -n "${1:-}" ]; then
  PAYLOAD="$1"
elif [ ! -t 0 ]; then
  PAYLOAD="$(cat)"
fi

# Prefer explicit session env vars (set by 247 when starting session)
SESSION_ID="${AGENT_247_SESSION:-${CODEX_TMUX_SESSION:-${CLAUDE_TMUX_SESSION:-}}}"
if [ -z "$SESSION_ID" ] && [ -n "${TMUX:-}" ]; then
  SESSION_ID="$(tmux display-message -p '#S' 2>/dev/null || true)"
fi
[ -z "$SESSION_ID" ] && exit 0

EVENT_TYPE="hook"
ATTENTION_REASON=""
if [ -n "$PAYLOAD" ]; then
  EVENT_TYPE="$(
    echo "$PAYLOAD" | jq -r '(.event // .eventType // .type // .notification_type // "hook")' 2>/dev/null || echo "hook"
  )"
  ATTENTION_REASON="$(
    echo "$PAYLOAD" | jq -r '(.notification_type // .attention_reason // .attentionReason // .reason // empty)' 2>/dev/null || echo ""
  )"
fi

curl -s -X POST "$AGENT_URL" \
  -H "Content-Type: application/json" \
  -d "$(
    jq -n \
      --arg sid "$SESSION_ID" \
      --arg event "$EVENT_TYPE" \
      --arg reason "$ATTENTION_REASON" \
      '{sessionId:$sid,status:"needs_attention",source:"hook",timestamp:(now*1000|floor),eventType:$event}
       | if $reason != "" then .attentionReason=$reason else . end'
  )" \
  --connect-timeout 2 --max-time 5 > /dev/null 2>&1 || true

echo "[247-hook] $SESSION_ID needs attention" >&2
