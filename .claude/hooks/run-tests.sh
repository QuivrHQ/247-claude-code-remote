#!/bin/bash

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Verify we're in the right project
if [[ ! -f "claude-remote-control/package.json" ]]; then
  # Not in the right project, let it pass
  exit 0
fi

cd claude-remote-control || exit 0

# Run the tests
echo "Running tests before stopping..."
pnpm test 2>&1

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "All tests passed"
  exit 0
else
  echo "Tests failed. Please fix the failing tests before completing." >&2
  exit 2
fi
