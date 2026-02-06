t#!/bin/bash

# Tailscale Funnel Helper Script
# This script helps you get your Tailscale Funnel URL for connecting to your agent

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

AGENT_PORT="${1:-4678}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Tailscale Funnel URL Helper${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if Tailscale is installed
if ! command -v tailscale &> /dev/null; then
    echo -e "${RED}❌ Tailscale is not installed${NC}"
    echo ""
    echo "To install Tailscale:"
    echo "  • macOS:   brew install tailscale"
    echo "  • Linux:   curl -fsSL https://tailscale.com/install.sh | sh"
    echo "  • Windows: https://tailscale.com/download/windows"
    exit 1
fi

echo -e "${GREEN}✓ Tailscale is installed${NC}"

# Check if logged in
if ! tailscale status &> /dev/null; then
    echo -e "${RED}❌ You are not logged in to Tailscale${NC}"
    echo ""
    echo "To log in:"
    echo "  tailscale up"
    echo ""
    echo "This will open a browser window for authentication."
    exit 1
fi

echo -e "${GREEN}✓ Logged in to Tailscale${NC}"

# Get machine info
MACHINE_NAME=$(tailscale status --json | grep -o '"Name":"[^"]*"' | cut -d'"' -f4 | head -1)
TAILNET=$(tailscale status --json | grep -o '"TailName":"[^"]*"' | cut -d'"' -f4 | sed 's/[^.]*\.//')

echo -e "${BLUE}Machine:${NC} $MACHINE_NAME"
echo -e "${BLUE}Tailnet:${NC} $TAILNET"
echo ""

# Check if Funnel is enabled
if tailscale funnel --json $AGENT_PORT &> /dev/null 2>&1; then
    FUNNEL_JSON=$(tailscale funnel --json $AGENT_PORT 2>/dev/null || echo "")
    FUNNEL_URL=$(echo "$FUNNEL_JSON" | grep -o '"URL":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$FUNNEL_URL" ]; then
        echo -e "${GREEN}✓ Funnel is enabled for port $AGENT_PORT${NC}"
        echo ""
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}  Your Funnel URL:${NC}"
        echo -e "${GREEN}  $FUNNEL_URL${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "Use this URL in your dashboard connection settings."
        exit 0
    fi
fi

# Funnel not enabled - offer to enable it
echo -e "${YELLOW}⚠ Funnel is not enabled for port $AGENT_PORT${NC}"
echo ""
echo "To enable Tailscale Funnel, run:"
echo ""
echo -e "${GREEN}  tailscale funnel --bg --https=$AGENT_PORT${NC}"
echo ""
echo "This will:"
echo "  • Enable Funnel for your machine"
echo "  • Expose port $AGENT_PORT via HTTPS"
echo "  • Run in the background (--bg flag)"
echo ""
echo "After enabling, run this script again to get your URL."
