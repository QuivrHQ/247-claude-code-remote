import { getDatabase } from './index.js';
import { recordStatusChange } from './history.js';
import type { DbSession, UpsertSessionInput } from './schema.js';
import type { SessionStatus, AttentionReason } from '@claude-remote/shared';

/**
 * Get a session by name
 */
export function getSession(name: string): DbSession | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM sessions WHERE name = ?').get(name) as DbSession | undefined;
  return row ?? null;
}

/**
 * Get all sessions
 */
export function getAllSessions(): DbSession[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM sessions ORDER BY last_activity DESC').all() as DbSession[];
}

/**
 * Get sessions by project
 */
export function getSessionsByProject(project: string): DbSession[] {
  const db = getDatabase();
  return db
    .prepare('SELECT * FROM sessions WHERE project = ? ORDER BY last_activity DESC')
    .all(project) as DbSession[];
}

/**
 * Upsert a session (insert or update)
 * Records status history if status changed
 */
export function upsertSession(name: string, input: UpsertSessionInput): DbSession {
  const db = getDatabase();
  const now = Date.now();

  // Check existing session for status change detection
  const existing = getSession(name);
  const statusChanged = !existing || existing.status !== input.status;

  const stmt = db.prepare(`
    INSERT INTO sessions (
      name, project, status, attention_reason, last_event,
      last_activity, last_status_change, environment_id, created_at, updated_at
    )
    VALUES (
      @name, @project, @status, @attentionReason, @lastEvent,
      @lastActivity, @lastStatusChange, @environmentId, @createdAt, @updatedAt
    )
    ON CONFLICT(name) DO UPDATE SET
      status = @status,
      attention_reason = @attentionReason,
      last_event = @lastEvent,
      last_activity = @lastActivity,
      last_status_change = @lastStatusChange,
      environment_id = COALESCE(@environmentId, environment_id),
      updated_at = @updatedAt
  `);

  stmt.run({
    name,
    project: input.project,
    status: input.status,
    attentionReason: input.attentionReason ?? null,
    lastEvent: input.lastEvent ?? null,
    lastActivity: input.lastActivity,
    lastStatusChange: statusChanged ? now : (existing?.last_status_change ?? now),
    environmentId: input.environmentId ?? null,
    createdAt: existing?.created_at ?? now,
    updatedAt: now,
  });

  // Record status history if status changed
  if (statusChanged) {
    recordStatusChange(name, input.status, input.attentionReason ?? null, input.lastEvent ?? null);
  }

  return getSession(name)!;
}

/**
 * Update session status only
 */
export function updateSessionStatus(
  name: string,
  status: SessionStatus,
  attentionReason?: AttentionReason | null,
  lastEvent?: string | null
): boolean {
  const db = getDatabase();
  const now = Date.now();

  const existing = getSession(name);
  if (!existing) {
    return false;
  }

  const statusChanged = existing.status !== status;

  const stmt = db.prepare(`
    UPDATE sessions SET
      status = ?,
      attention_reason = ?,
      last_event = COALESCE(?, last_event),
      last_activity = ?,
      last_status_change = ?,
      updated_at = ?
    WHERE name = ?
  `);

  stmt.run(
    status,
    attentionReason ?? null,
    lastEvent,
    now,
    statusChanged ? now : existing.last_status_change,
    now,
    name
  );

  // Record status history if status changed
  if (statusChanged) {
    recordStatusChange(name, status, attentionReason ?? null, lastEvent ?? null);
  }

  return true;
}

/**
 * Delete a session
 */
export function deleteSession(name: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM sessions WHERE name = ?').run(name);
  return result.changes > 0;
}

/**
 * Cleanup stale sessions (older than maxAge)
 * Returns number of deleted sessions
 */
export function cleanupStaleSessions(maxAge: number): number {
  const db = getDatabase();
  const cutoff = Date.now() - maxAge;

  const result = db.prepare('DELETE FROM sessions WHERE last_activity < ?').run(cutoff);

  if (result.changes > 0) {
    console.log(`[DB] Cleaned up ${result.changes} stale sessions`);
  }

  return result.changes;
}

/**
 * Reconcile sessions with active tmux sessions
 * - Sessions in DB but not in tmux: mark as idle or delete if old
 * - Sessions in tmux but not in DB: create with idle status
 */
export function reconcileWithTmux(activeTmuxSessions: Set<string>): void {
  const dbSessions = getAllSessions();
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  console.log(
    `[DB] Reconciling ${dbSessions.length} DB sessions with ${activeTmuxSessions.size} tmux sessions`
  );

  // Handle sessions in DB but not in tmux
  for (const session of dbSessions) {
    if (!activeTmuxSessions.has(session.name)) {
      const age = now - session.last_activity;

      if (age > maxAge) {
        // Delete old sessions
        deleteSession(session.name);
        console.log(`[DB] Deleted stale session: ${session.name}`);
      } else if (session.status !== 'idle') {
        // Mark as idle since tmux session is gone
        updateSessionStatus(session.name, 'idle', null, 'session_ended');
        console.log(`[DB] Marked session as idle: ${session.name}`);
      }
    }
  }

  // Handle sessions in tmux but not in DB
  // These will be created when they receive their first status update
  // We don't create them here because we don't have project info
}

/**
 * Get session environment mapping
 */
export function getSessionEnvironmentId(sessionName: string): string | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT environment_id FROM session_environments WHERE session_name = ?')
    .get(sessionName) as { environment_id: string } | undefined;
  return row?.environment_id ?? null;
}

/**
 * Set session environment mapping
 */
export function setSessionEnvironmentId(sessionName: string, environmentId: string): void {
  const db = getDatabase();
  db.prepare(
    `
    INSERT OR REPLACE INTO session_environments (session_name, environment_id)
    VALUES (?, ?)
  `
  ).run(sessionName, environmentId);
}

/**
 * Clear session environment mapping
 */
export function clearSessionEnvironmentId(sessionName: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM session_environments WHERE session_name = ?').run(sessionName);
}

/**
 * Convert DbSession to HookStatus format (for compatibility with existing code)
 */
export function toHookStatus(session: DbSession): {
  status: SessionStatus;
  attentionReason?: AttentionReason;
  lastEvent: string;
  lastActivity: number;
  lastStatusChange: number;
  project?: string;
} {
  return {
    status: session.status,
    attentionReason: session.attention_reason ?? undefined,
    lastEvent: session.last_event ?? '',
    lastActivity: session.last_activity,
    lastStatusChange: session.last_status_change,
    project: session.project,
  };
}
