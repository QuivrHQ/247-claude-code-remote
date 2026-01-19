#!/bin/bash
# 247 Hook Script for Claude Code
# VERSION: 2.28.0
# Ultra simple: hook called = needs_attention
set -euo pipefail

AGENT_URL="http://${AGENT_247_HOST:-localhost}:${AGENT_247_PORT:-4678}/api/hooks/status"
EVENT_JSON=$(cat)

SESSION_ID=$(echo "$EVENT_JSON" | jq -r '.session_id // empty')
[ -z "$SESSION_ID" ] && exit 0

# Simple: hook called = needs_attention
curl -s -X POST "$AGENT_URL" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg sid "$SESSION_ID" '{sessionId:$sid,status:"needs_attention",source:"hook",timestamp:now*1000|floor}')" \
  --connect-timeout 2 --max-time 5 > /dev/null 2>&1 || true

echo "[247-hook] $SESSION_ID needs attention" >&2
