/**
 * Heartbeat timeout monitor.
 * Detects when Claude Code stops sending statusLine updates.
 *
 * Logic:
 * - Heartbeat received → status "working"
 * - No heartbeat for 3s → status "idle" (Claude stopped working, but NOT needs_attention)
 * - tmux session removed → cleanup (handled by cleanupStatusMaps)
 *
 * Note: "needs_attention" should only be set when Claude explicitly needs user input,
 * not just because heartbeats stopped. A timeout means Claude is idle, not blocked.
 */

import { lastHeartbeat } from './routes/heartbeat.js';
import { tmuxSessionStatus, broadcastStatusUpdate } from './status.js';
import * as sessionsDb from './db/sessions.js';
import { getEnvironmentMetadata, getSessionEnvironment } from './db/environments.js';

// Timeout threshold: if no heartbeat for 3 seconds, Claude has stopped working
// Increased from 2s to reduce false-positive "needs_attention" during brief API pauses
const HEARTBEAT_TIMEOUT_MS = 3000;

// Check interval: how often we check for timeouts
const CHECK_INTERVAL_MS = 1000;

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the heartbeat timeout monitor.
 * Checks every second for sessions that haven't sent a heartbeat.
 */
export function startHeartbeatMonitor(): void {
  if (intervalId) {
    console.warn('[HeartbeatMonitor] Already running');
    return;
  }

  intervalId = setInterval(() => {
    const now = Date.now();

    for (const [sessionName, lastBeat] of lastHeartbeat) {
      const timeSinceLastBeat = now - lastBeat;
      const status = tmuxSessionStatus.get(sessionName);

      // Only transition if currently "working", timeout exceeded, AND session has never been working
      // This prevents false idle states during long operations (file reads, agent calls)
      // Once a session has received a heartbeat (hasBeenWorking=true), it should never go back to idle
      if (
        timeSinceLastBeat > HEARTBEAT_TIMEOUT_MS &&
        status?.status === 'working' &&
        !status?.hasBeenWorking
      ) {
        const newStatus = {
          ...status,
          status: 'idle' as const,
          lastEvent: 'HeartbeatTimeout',
          lastStatusChange: now,
        };

        tmuxSessionStatus.set(sessionName, newStatus);

        // Persist to database
        sessionsDb.upsertSession(sessionName, {
          project: status.project || sessionName.split('--')[0] || '',
          status: 'idle',
          lastEvent: 'HeartbeatTimeout',
          lastActivity: status.lastActivity,
          lastStatusChange: now,
        });

        // Get environment info for broadcast
        const envId = getSessionEnvironment(sessionName);
        const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

        // Get actual createdAt from database to prevent card reordering
        const dbSession = sessionsDb.getSession(sessionName);

        // Broadcast status change
        broadcastStatusUpdate({
          name: sessionName,
          project: status.project || '',
          status: 'idle',
          statusSource: 'hook',
          lastEvent: 'HeartbeatTimeout',
          lastStatusChange: now,
          createdAt: dbSession?.created_at || status.lastActivity || now,
          lastActivity: status.lastActivity,
          environmentId: envId,
          environment: envMeta
            ? {
                id: envMeta.id,
                name: envMeta.name,
                provider: envMeta.provider,
                icon: envMeta.icon,
                isDefault: envMeta.isDefault,
              }
            : undefined,
          model: status.model,
          costUsd: status.costUsd,
          contextUsage: status.contextUsage,
          linesAdded: status.linesAdded,
          linesRemoved: status.linesRemoved,
        });

        console.log(
          `[HeartbeatMonitor] ${sessionName} → idle (no heartbeat for ${timeSinceLastBeat}ms)`
        );
      }
    }
  }, CHECK_INTERVAL_MS);

  console.log('[HeartbeatMonitor] Started');
}

/**
 * Stop the heartbeat monitor.
 * Called during graceful shutdown.
 */
export function stopHeartbeatMonitor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[HeartbeatMonitor] Stopped');
  }
}
