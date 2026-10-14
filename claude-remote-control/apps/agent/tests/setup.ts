/**
 * Global vitest setup: keep the agent database hermetic.
 *
 * The agent's SQLite database defaults to ~/.247/data/agent.db (computed from
 * $HOME). Integration tests call createServer(), which opens that real database
 * and runs reconcileWithTmux() — a reconcile pass that DELETES non-archived
 * sessions older than 24h when they are absent from the (mocked, empty) tmux
 * set. Running the suite on a machine with a live agent would silently destroy
 * real session rows.
 *
 * To prevent that, point AGENT_DB_PATH at a throwaway temp file for the whole
 * test run. Any code path that calls initDatabase() without an explicit path
 * (createServer, production entry point) now resolves to this disposable file
 * instead of the developer's real database. See src/db/index.ts#getDefaultDbPath.
 *
 * A developer-provided AGENT_DB_PATH is respected and not overwritten.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Trim-aware so a whitespace-only AGENT_DB_PATH (which getDefaultDbPath() also
// treats as unset and would resolve back to the real database) still gets a
// throwaway temp file here.
if (!process.env.AGENT_DB_PATH?.trim()) {
  const tempDir = mkdtempSync(join(tmpdir(), '247-agent-test-'));
  process.env.AGENT_DB_PATH = join(tempDir, 'agent.db');

  // Best-effort cleanup of the temp DB (and its -wal/-shm siblings) on exit.
  process.once('exit', () => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures — the OS reclaims its temp dir regardless.
    }
  });
}
