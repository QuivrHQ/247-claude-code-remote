/**
 * Session status management and WebSocket broadcast utilities.
 * Handles real-time status updates between Claude Code hooks and the dashboard.
 */

import { WebSocket } from 'ws';
import { execSync } from 'child_process';
import type {
  SessionStatus,
  AttentionReason,
  WSSessionInfo,
  WSStatusMessageFromAgent,
} from '247-shared';
import { RETENTION_CONFIG } from './db/index.js';
import * as sessionsDb from './db/sessions.js';

// Store session status from Claude Code statusLine/hooks
export interface HookStatus {
  status: SessionStatus;
  hasBeenWorking?: boolean; // Track if session has ever been working - prevents idle regression
  attentionReason?: AttentionReason;
  lastEvent: string;
  lastActivity: number;
  lastStatusChange: number;
  project?: string;
}

// Store by tmux session name - single source of truth for status
export const tmuxSessionStatus = new Map<string, HookStatus>();

// Track active WebSocket connections per session
export const activeConnections = new Map<string, Set<WebSocket>>();

// Track WebSocket subscribers for status updates (real-time push)
export const statusSubscribers = new Set<WebSocket>();

/**
 * Broadcast status update to all subscribers
 */
export function broadcastStatusUpdate(session: WSSessionInfo): void {
  // Send WebSocket update to connected clients
  if (statusSubscribers.size > 0) {
    const message: WSStatusMessageFromAgent = { type: 'status-update', session };
    const messageStr = JSON.stringify(message);

    for (const ws of statusSubscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
    console.log(
      `[Status WS] Broadcast status update for ${session.name}: ${session.status} to ${statusSubscribers.size} subscribers`
    );
  }
}

/**
 * Broadcast session removed to all subscribers
 */
export function broadcastSessionRemoved(sessionName: string): void {
  if (statusSubscribers.size === 0) return;

  const message: WSStatusMessageFromAgent = { type: 'session-removed', sessionName };
  const messageStr = JSON.stringify(message);

  for (const ws of statusSubscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
  console.log(`[Status WS] Broadcast session removed: ${sessionName}`);
}

/**
 * Broadcast session archived to all subscribers
 */
export function broadcastSessionArchived(sessionName: string, session: WSSessionInfo): void {
  if (statusSubscribers.size === 0) return;

  const message: WSStatusMessageFromAgent = { type: 'session-archived', sessionName, session };
  const messageStr = JSON.stringify(message);

  for (const ws of statusSubscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  }
  console.log(`[Status WS] Broadcast session archived: ${sessionName}`);
}

/**
 * Generate human-readable session names with project prefix
 * @param project - Project name
 * @param prefix - Optional prefix to add after project (e.g., 'spawn' -> project--spawn-adj-noun-num)
 */
export function generateSessionName(project: string, prefix?: string): string {
  // Sanitize project name for tmux session names (no slashes, colons, or dots)
  const sanitizedProject = project.replace(/[/:.]/g, '-');

  const adjectives = [
    'brave',
    'swift',
    'calm',
    'bold',
    'wise',
    'keen',
    'fair',
    'wild',
    'bright',
    'cool',
  ];
  const nouns = ['lion', 'hawk', 'wolf', 'bear', 'fox', 'owl', 'deer', 'lynx', 'eagle', 'tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);

  if (prefix) {
    return `${sanitizedProject}--${prefix}-${adj}-${noun}-${num}`;
  }
  return `${sanitizedProject}--${adj}-${noun}-${num}`;
}

/**
 * Clean up stale status entries (called periodically)
 */
export function cleanupStatusMaps(): void {
  const now = Date.now();
  const STALE_THRESHOLD = RETENTION_CONFIG.sessionMaxAge;

  let cleanedTmux = 0;

  // Get active tmux sessions
  let activeSessions = new Set<string>();
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', {
      encoding: 'utf-8',
    });
    activeSessions = new Set(output.trim().split('\n').filter(Boolean));
  } catch {
    // No tmux sessions exist
  }

  // Clean tmuxSessionStatus - remove if session doesn't exist OR is stale
  for (const [sessionName, status] of tmuxSessionStatus) {
    const sessionExists = activeSessions.has(sessionName);
    const isStale = now - status.lastActivity > STALE_THRESHOLD;

    if (!sessionExists || isStale) {
      tmuxSessionStatus.delete(sessionName);
      cleanedTmux++;
    }
  }

  if (cleanedTmux > 0) {
    console.log(`[Status Cleanup] Removed ${cleanedTmux} stale status entries from memory`);
  }

  // Also cleanup SQLite database
  const dbSessionsCleaned = sessionsDb.cleanupStaleSessions(
    STALE_THRESHOLD,
    RETENTION_CONFIG.archivedMaxAge
  );

  if (dbSessionsCleaned > 0) {
    console.log(`[DB Cleanup] Sessions: ${dbSessionsCleaned}`);
  }
}

/**
 * Get active tmux sessions from the system
 */
export function getActiveTmuxSessions(): Set<string> {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}" 2>/dev/null', {
      encoding: 'utf-8',
    });
    return new Set(output.trim().split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}
