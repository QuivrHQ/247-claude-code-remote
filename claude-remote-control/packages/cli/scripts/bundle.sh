#!/bin/bash
# Bundle script for 247 CLI npm package
# Copies hooks and agent code into the CLI package for distribution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"
MONOREPO_ROOT="$(cd "$CLI_DIR/../.." && pwd)"

echo "Bundling 247 CLI..."
echo "CLI dir: $CLI_DIR"
echo "Monorepo root: $MONOREPO_ROOT"

# Build shared package first (agent depends on it)
echo "Building shared package..."
cd "$MONOREPO_ROOT"
pnpm --filter @vibecompany/247-shared build

# Build agent
echo "Building agent..."
pnpm --filter @vibecompany/247-agent build

# Copy hooks package
echo "Copying hooks..."
cd "$CLI_DIR"
rm -rf hooks
mkdir -p hooks

# Copy the Claude Code plugin structure
if [ -d "../hooks/.claude-plugin" ]; then
  cp -r ../hooks/.claude-plugin hooks/
fi

if [ -d "../hooks/hooks" ]; then
  cp -r ../hooks/hooks hooks/
fi

if [ -d "../hooks/scripts" ]; then
  cp -r ../hooks/scripts hooks/
fi

# Copy agent dist
echo "Copying agent..."
rm -rf agent
mkdir -p agent/dist

if [ -d "../../apps/agent/dist" ]; then
  cp -r ../../apps/agent/dist/* agent/dist/
else
  echo "Warning: Agent dist not found at ../../apps/agent/dist"
  echo "Make sure to build the agent first: pnpm --filter @claude-remote/agent build"
fi

echo "Bundle complete!"
echo "Contents:"
echo "  hooks/: $(ls -la hooks 2>/dev/null | wc -l) items"
echo "  agent/: $(ls -la agent/dist 2>/dev/null | wc -l) items"
