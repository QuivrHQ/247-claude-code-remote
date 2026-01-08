#!/bin/bash
# Code duplication check hook for Claude Code
# Runs jscpd and outputs a report after each task

# Don't fail on errors - we never want to block Claude
set +e

# Read stdin for hook input (contains cwd)
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || echo "")

# If no cwd from hook, use current directory
if [ -z "$CWD" ]; then
  CWD=$(pwd)
fi

# Find the project root (look for .jscpd.json or package.json)
find_project_root() {
  local dir="$1"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/.jscpd.json" ] || [ -f "$dir/package.json" ]; then
      echo "$dir"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

PROJECT_ROOT=$(find_project_root "$CWD")

# If no project root found, skip silently
if [ -z "$PROJECT_ROOT" ]; then
  exit 0
fi

# Check if jscpd config exists
if [ ! -f "$PROJECT_ROOT/.jscpd.json" ]; then
  exit 0
fi

# Check if npx is available
if ! command -v npx &> /dev/null; then
  exit 0
fi

# Create temp directory for report
REPORT_DIR=$(mktemp -d)
trap "rm -rf $REPORT_DIR" EXIT

# Run jscpd with JSON output
cd "$PROJECT_ROOT"
npx jscpd --reporters json --output "$REPORT_DIR" > /dev/null 2>&1 || true

REPORT_FILE="$REPORT_DIR/jscpd-report.json"

# Check if report was generated
if [ ! -f "$REPORT_FILE" ]; then
  exit 0
fi

# Parse the JSON report
DUPLICATES=$(jq '.statistics.clones // 0' "$REPORT_FILE" 2>/dev/null || echo "0")
PERCENTAGE=$(jq -r '.statistics.percentage // "0"' "$REPORT_FILE" 2>/dev/null || echo "0")
TOTAL_LINES=$(jq '.statistics.total.lines // 0' "$REPORT_FILE" 2>/dev/null || echo "0")

# Only show report if there are duplicates
if [ "$DUPLICATES" -gt 0 ]; then
  echo ""
  echo "=========================================="
  echo "       CODE DUPLICATION REPORT"
  echo "=========================================="
  echo ""
  echo "  Duplicate blocks: $DUPLICATES"
  echo "  Duplication: ${PERCENTAGE}% of $TOTAL_LINES lines"
  echo ""
  echo "  Duplicated locations:"
  echo "  ---------------------"

  # Extract and format duplicate locations
  jq -r '.duplicates[] | "  [\(.firstFile.name):\(.firstFile.startLoc.line)-\(.firstFile.endLoc.line)]\n  [\(.secondFile.name):\(.secondFile.startLoc.line)-\(.secondFile.endLoc.line)]\n  Lines: \(.lines) | Tokens: \(.tokens)\n"' "$REPORT_FILE" 2>/dev/null || true

  echo ""
  echo "  TIP: Refactor with:"
  echo "  'Refactor the duplicated code above to follow DRY'"
  echo ""
  echo "=========================================="
  echo ""
fi

exit 0
