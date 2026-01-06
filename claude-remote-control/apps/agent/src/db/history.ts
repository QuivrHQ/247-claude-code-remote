import { getDatabase } from './index.js';
import type { DbStatusHistory } from './schema.js';
import type { SessionStatus, AttentionReason } from '@claude-remote/shared';

/**
 * Record a status change in history
 */
export function recordStatusChange(
  sessionName: string,
  status: SessionStatus,
  attentionReason: AttentionReason | null,
  event: string | null
): void {
  const db = getDatabase();
  const now = Date.now();

  db.prepare(
    `
    INSERT INTO status_history (session_name, status, attention_reason, event, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(sessionName, status, attentionReason, event, now);
}

/**
 * Get status history for a session
 */
export function getSessionHistory(sessionName: string, limit = 100): DbStatusHistory[] {
  const db = getDatabase();
  return db
    .prepare(
      `
    SELECT * FROM status_history
    WHERE session_name = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `
    )
    .all(sessionName, limit) as DbStatusHistory[];
}

/**
 * Get recent history across all sessions
 */
export function getRecentHistory(limit = 100): DbStatusHistory[] {
  const db = getDatabase();
  return db
    .prepare(
      `
    SELECT * FROM status_history
    ORDER BY timestamp DESC
    LIMIT ?
  `
    )
    .all(limit) as DbStatusHistory[];
}

/**
 * Get history within a time range
 */
export function getHistoryInRange(startTime: number, endTime: number): DbStatusHistory[] {
  const db = getDatabase();
  return db
    .prepare(
      `
    SELECT * FROM status_history
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `
    )
    .all(startTime, endTime) as DbStatusHistory[];
}

/**
 * Cleanup old history entries
 * Returns number of deleted entries
 */
export function cleanupOldHistory(maxAge: number): number {
  const db = getDatabase();
  const cutoff = Date.now() - maxAge;

  const result = db.prepare('DELETE FROM status_history WHERE timestamp < ?').run(cutoff);

  if (result.changes > 0) {
    console.log(`[DB] Cleaned up ${result.changes} old history entries`);
  }

  return result.changes;
}

/**
 * Get statistics about status history
 */
export function getHistoryStats(): {
  totalEntries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  entriesByStatus: Record<string, number>;
} {
  const db = getDatabase();

  const total = db.prepare('SELECT COUNT(*) as count FROM status_history').get() as {
    count: number;
  };

  const oldest = db.prepare('SELECT MIN(timestamp) as ts FROM status_history').get() as {
    ts: number | null;
  };

  const newest = db.prepare('SELECT MAX(timestamp) as ts FROM status_history').get() as {
    ts: number | null;
  };

  const byStatus = db
    .prepare(
      `
    SELECT status, COUNT(*) as count FROM status_history GROUP BY status
  `
    )
    .all() as Array<{ status: string; count: number }>;

  const entriesByStatus: Record<string, number> = {};
  for (const row of byStatus) {
    entriesByStatus[row.status] = row.count;
  }

  return {
    totalEntries: total.count,
    oldestEntry: oldest.ts,
    newestEntry: newest.ts,
    entriesByStatus,
  };
}

/**
 * Delete all history for a session
 */
export function deleteSessionHistory(sessionName: string): number {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM status_history WHERE session_name = ?').run(sessionName);
  return result.changes;
}
