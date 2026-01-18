/**
 * Session API routes: list, preview, kill, archive tmux sessions.
 * Simplified version without spawn, worktree, push, or PR features.
 */

import { Router } from 'express';
import type { SessionStatus, AttentionReason, WSSessionInfo } from '247-shared';
import { tmuxSessionStatus, broadcastSessionRemoved, broadcastSessionArchived } from '../status.js';
import * as sessionsDb from '../db/sessions.js';

export function createSessionRoutes(): Router {
  const router = Router();

  // Get session output (terminal scrollback)
  router.get('/:sessionName/output', async (req, res) => {
    const { sessionName } = req.params;
    const lines = parseInt(req.query.lines as string) || 1000;
    const format = (req.query.format as string) || 'plain';
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    // Limit lines to prevent memory issues
    const maxLines = Math.min(lines, 50000);

    try {
      const { stdout } = await execAsync(
        `tmux capture-pane -t "${sessionName}" -p -S -${maxLines} -J 2>/dev/null`
      );

      let output = stdout;

      // Strip ANSI codes if plain format requested
      if (format === 'plain') {
        // eslint-disable-next-line no-control-regex
        output = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
      }

      const outputLines = output.split('\n');

      // Check if session is still running
      let isRunning = true;
      try {
        await execAsync(`tmux has-session -t "${sessionName}" 2>/dev/null`);
      } catch {
        isRunning = false;
      }

      res.json({
        sessionName,
        output,
        totalLines: outputLines.length,
        returnedLines: outputLines.length,
        isRunning,
        capturedAt: Date.now(),
        source: 'live' as const,
      });
    } catch {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  // Send input to a session
  router.post('/:sessionName/input', async (req, res) => {
    const { sessionName } = req.params;
    const { text, sendEnter = true } = req.body as {
      text: string;
      sendEnter?: boolean;
    };
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ success: false, error: 'Invalid session name' });
    }

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    try {
      // Check if session exists
      await execAsync(`tmux has-session -t "${sessionName}" 2>/dev/null`);

      // Escape special characters for tmux send-keys
      const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/;/g, '\\;');

      // Send the text
      if (sendEnter) {
        await execAsync(`tmux send-keys -t "${sessionName}" "${escapedText}" Enter`);
      } else {
        await execAsync(`tmux send-keys -t "${sessionName}" "${escapedText}"`);
      }

      // If session was waiting for input, update status
      const hookData = tmuxSessionStatus.get(sessionName);
      if (hookData?.status === 'needs_attention') {
        hookData.status = 'working';
        hookData.attentionReason = undefined;
        hookData.lastEvent = 'Input sent';
        hookData.lastActivity = Date.now();

        sessionsDb.upsertSession(sessionName, {
          status: 'working',
          attentionReason: null,
          lastEvent: 'Input sent',
        });
      }

      res.json({
        success: true,
        sessionName,
        bytesSent: text.length,
      });
    } catch {
      res.status(404).json({ success: false, error: 'Session not found' });
    }
  });

  // Enhanced sessions endpoint with detailed info
  router.get('/', async (_req, res) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}|#{session_created}" 2>/dev/null'
      );

      const sessions: WSSessionInfo[] = [];

      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const [name, created] = line.split('|');
        const [project] = name.split('--');

        let status: SessionStatus = 'init';
        let attentionReason: AttentionReason | undefined;
        let statusSource: 'hook' | 'tmux' = 'tmux';
        let lastEvent: string | undefined;
        let lastStatusChange: number | undefined;

        // Try in-memory status first (active sessions with heartbeat)
        const hookData = tmuxSessionStatus.get(name);
        // Fallback to DB for persisted data (survives refresh)
        const dbSession = sessionsDb.getSession(name);

        if (hookData) {
          status = hookData.status;
          attentionReason = hookData.attentionReason;
          statusSource = 'hook';
          lastEvent = hookData.lastEvent;
          lastStatusChange = hookData.lastStatusChange;
        } else if (dbSession) {
          // Use DB data if no active hookData
          status = dbSession.status;
          attentionReason = dbSession.attention_reason ?? undefined;
          statusSource = 'hook';
          lastEvent = dbSession.last_event ?? undefined;
          lastStatusChange = dbSession.last_status_change;
        }

        sessions.push({
          name,
          project,
          createdAt: parseInt(created) * 1000,
          status,
          attentionReason,
          statusSource,
          lastActivity: hookData?.lastActivity ?? dbSession?.last_activity,
          lastEvent,
          lastStatusChange,
        });
      }

      res.json(sessions);
    } catch {
      res.json([]);
    }
  });

  // Get archived sessions
  router.get('/archived', (_req, res) => {
    const archivedSessions = sessionsDb.getArchivedSessions();

    const sessions: WSSessionInfo[] = archivedSessions.map((session) => ({
      name: session.name,
      project: session.project,
      createdAt: session.created_at,
      status: session.status,
      attentionReason: session.attention_reason ?? undefined,
      statusSource: 'hook' as const,
      lastEvent: session.last_event ?? undefined,
      lastStatusChange: session.last_status_change,
      archivedAt: session.archived_at ?? undefined,
    }));

    res.json(sessions);
  });

  // Get single session status by name (from DB, works for completed sessions too)
  router.get('/:sessionName/status', (req, res) => {
    const { sessionName } = req.params;

    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    // First check in-memory status (active sessions)
    const hookData = tmuxSessionStatus.get(sessionName);

    // Then check database
    const dbSession = sessionsDb.getSession(sessionName);

    if (!hookData && !dbSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Merge data from both sources, preferring hookData for active sessions
    const sessionInfo: WSSessionInfo = {
      name: sessionName,
      project: dbSession?.project ?? hookData?.project ?? '',
      createdAt: dbSession?.created_at ?? Date.now(),
      status: hookData?.status ?? dbSession?.status ?? 'idle',
      attentionReason: hookData?.attentionReason ?? dbSession?.attention_reason ?? undefined,
      statusSource: hookData ? 'hook' : 'hook',
      lastEvent: hookData?.lastEvent ?? dbSession?.last_event ?? undefined,
      lastStatusChange: hookData?.lastStatusChange ?? dbSession?.last_status_change,
      lastActivity: hookData?.lastActivity ?? dbSession?.last_activity,
      archivedAt: dbSession?.archived_at ?? undefined,
    };

    res.json(sessionInfo);
  });

  // Get terminal preview (last N lines from tmux pane)
  router.get('/:sessionName/preview', async (req, res) => {
    const { sessionName } = req.params;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    try {
      const { stdout } = await execAsync(
        `tmux capture-pane -t "${sessionName}" -p -S -20 2>/dev/null`
      );

      const allLines = stdout.split('\n');
      const lines = allLines
        .slice(-16, -1)
        .filter((line) => line.trim() !== '' || allLines.indexOf(line) > allLines.length - 5);

      res.json({
        lines: lines.length > 0 ? lines : ['(empty terminal)'],
        timestamp: Date.now(),
      });
    } catch {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  // Kill a tmux session
  router.delete('/:sessionName', async (req, res) => {
    const { sessionName } = req.params;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    try {
      await execAsync(`tmux kill-session -t "${sessionName}" 2>/dev/null`);
      console.log(`Killed tmux session: ${sessionName}`);

      sessionsDb.deleteSession(sessionName);
      tmuxSessionStatus.delete(sessionName);
      broadcastSessionRemoved(sessionName);

      res.json({ success: true, message: `Session ${sessionName} killed` });
    } catch {
      res.status(404).json({ error: 'Session not found or already killed' });
    }
  });

  // Archive a session (mark as done and keep in history)
  router.post('/:sessionName/archive', async (req, res) => {
    const { sessionName } = req.params;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    const archivedSession = sessionsDb.archiveSession(sessionName);
    if (!archivedSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    try {
      await execAsync(`tmux kill-session -t "${sessionName}" 2>/dev/null`);
      console.log(`[Archive] Killed tmux session: ${sessionName}`);
    } catch {
      console.log(`[Archive] Tmux session ${sessionName} was already gone`);
    }

    tmuxSessionStatus.delete(sessionName);

    const archivedInfo: WSSessionInfo = {
      name: sessionName,
      project: archivedSession.project,
      createdAt: archivedSession.created_at,
      status: archivedSession.status,
      attentionReason: archivedSession.attention_reason ?? undefined,
      statusSource: 'hook',
      lastEvent: archivedSession.last_event ?? undefined,
      lastStatusChange: archivedSession.last_status_change,
      archivedAt: archivedSession.archived_at ?? undefined,
    };

    broadcastSessionArchived(sessionName, archivedInfo);

    res.json({
      success: true,
      message: `Session ${sessionName} archived`,
      session: archivedInfo,
    });
  });

  return router;
}
