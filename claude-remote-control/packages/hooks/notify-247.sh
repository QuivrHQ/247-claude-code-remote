#!/bin/bash
# 247 Hook Script for Claude Code
# VERSION: 2.25.0
# Called by Claude Code on Stop/Notification events to notify the agent
#
# This script receives event JSON from stdin and POSTs to the agent's /api/hooks/status
# endpoint to update session status and trigger browser/push notifications.
#
# Event types:
# - Stop events: session_id, stop_hook_active
# - Notification events: session_id, notification (type, title, body)

set -euo pipefail

# Configuration
AGENT_HOST="${AGENT_247_HOST:-localhost}"
AGENT_PORT="${AGENT_247_PORT:-4678}"
AGENT_URL="http://${AGENT_HOST}:${AGENT_PORT}/api/hooks/status"

# Read event JSON from stdin
EVENT_JSON=$(cat)

# Extract fields using jq (required dependency)
if ! command -v jq &> /dev/null; then
    echo "[247-hook] Error: jq is required but not installed" >&2
    exit 1
fi

# Parse event data
SESSION_ID=$(echo "$EVENT_JSON" | jq -r '.session_id // empty')
HOOK_TYPE=$(echo "$EVENT_JSON" | jq -r 'if .stop_hook_active then "stop" elif .notification then "notification" else "unknown" end')

# Skip if no session ID (shouldn't happen, but be safe)
if [ -z "$SESSION_ID" ]; then
    echo "[247-hook] No session_id in event, skipping" >&2
    exit 0
fi

# Determine status and attention reason based on event type
STATUS="needs_attention"
ATTENTION_REASON=""
EVENT_TYPE="$HOOK_TYPE"

if [ "$HOOK_TYPE" = "notification" ]; then
    NOTIFICATION_TYPE=$(echo "$EVENT_JSON" | jq -r '.notification.type // "unknown"')
    NOTIFICATION_TITLE=$(echo "$EVENT_JSON" | jq -r '.notification.title // ""')

    # Map Claude Code notification types to attention reasons
    case "$NOTIFICATION_TYPE" in
        "permission")
            ATTENTION_REASON="permission"
            ;;
        "input"|"input_request"|"question")
            ATTENTION_REASON="input"
            ;;
        "plan"|"plan_approval"|"plan_mode")
            ATTENTION_REASON="plan_approval"
            ;;
        "complete"|"task_complete"|"done"|"success")
            ATTENTION_REASON="task_complete"
            STATUS="idle"
            ;;
        *)
            # Try to infer from title
            if [[ "$NOTIFICATION_TITLE" == *"permission"* ]] || [[ "$NOTIFICATION_TITLE" == *"Permission"* ]]; then
                ATTENTION_REASON="permission"
            elif [[ "$NOTIFICATION_TITLE" == *"input"* ]] || [[ "$NOTIFICATION_TITLE" == *"question"* ]]; then
                ATTENTION_REASON="input"
            elif [[ "$NOTIFICATION_TITLE" == *"plan"* ]] || [[ "$NOTIFICATION_TITLE" == *"Plan"* ]]; then
                ATTENTION_REASON="plan_approval"
            elif [[ "$NOTIFICATION_TITLE" == *"complete"* ]] || [[ "$NOTIFICATION_TITLE" == *"Complete"* ]]; then
                ATTENTION_REASON="task_complete"
                STATUS="idle"
            else
                ATTENTION_REASON="input"
            fi
            ;;
    esac

    EVENT_TYPE="notification:$NOTIFICATION_TYPE"
elif [ "$HOOK_TYPE" = "stop" ]; then
    # Stop hook means Claude is waiting for input
    ATTENTION_REASON="input"
    EVENT_TYPE="stop"
fi

# Build the payload
TIMESTAMP=$(date +%s000)
PAYLOAD=$(jq -n \
    --arg sessionId "$SESSION_ID" \
    --arg status "$STATUS" \
    --arg attentionReason "$ATTENTION_REASON" \
    --arg source "hook" \
    --argjson timestamp "$TIMESTAMP" \
    --arg eventType "$EVENT_TYPE" \
    '{
        sessionId: $sessionId,
        status: $status,
        attentionReason: (if $attentionReason == "" then null else $attentionReason end),
        source: $source,
        timestamp: $timestamp,
        eventType: $eventType
    }')

# POST to agent (with timeout, non-blocking)
# Use timeout to avoid hanging if agent is not running
if command -v timeout &> /dev/null; then
    TIMEOUT_CMD="timeout 5"
elif command -v gtimeout &> /dev/null; then
    TIMEOUT_CMD="gtimeout 5"
else
    TIMEOUT_CMD=""
fi

$TIMEOUT_CMD curl -s -X POST "$AGENT_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    --connect-timeout 2 \
    --max-time 5 \
    > /dev/null 2>&1 || true

# Log for debugging (to stderr so it doesn't interfere with Claude)
echo "[247-hook] Notified agent: session=$SESSION_ID status=$STATUS reason=$ATTENTION_REASON event=$EVENT_TYPE" >&2
