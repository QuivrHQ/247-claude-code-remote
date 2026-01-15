/**
 * Session API routes: list, preview, kill, archive tmux sessions.
 */

import { Router } from 'express';
import type { SessionStatus, AttentionReason, WSSessionInfo } from '247-shared';
import {
  tmuxSessionStatus,
  broadcastSessionRemoved,
  broadcastSessionArchived,
  broadcastStatusUpdate,
  generateSessionName,
} from '../status.js';
import * as sessionsDb from '../db/sessions.js';
import {
  getEnvironmentMetadata,
  getSessionEnvironment,
  clearSessionEnvironment,
  setSessionEnvironment,
} from '../db/environments.js';
import { executionManager, worktreeManager } from '../services/index.js';
import { config } from '../config.js';
import { createTerminal, readAndCleanupSpawnOutput, getSpawnOutputPath } from '../terminal.js';
import * as fs from 'fs';
import { isProjectAllowed } from './projects.js';

export function createSessionRoutes(): Router {
  const router = Router();

  // Get execution capacity (max parallel sessions)
  router.get('/capacity', (_req, res) => {
    const capacity = executionManager.getCapacity();
    res.json(capacity);
  });

  // Spawn a new session with a command (for claude -p)
  router.post('/spawn', async (req, res) => {
    const {
      prompt,
      project,
      parentSession,
      taskId,
      worktree,
      branchName,
      environmentId,
      timeout: _timeout,
      trustMode,
      model,
    } = req.body as {
      prompt: string;
      project: string;
      parentSession?: string;
      taskId?: string;
      worktree?: boolean;
      branchName?: string;
      environmentId?: string;
      timeout?: number;
      trustMode?: boolean;
      model?: string;
    };

    // Validate required fields
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }
    if (!project || typeof project !== 'string') {
      return res.status(400).json({ success: false, error: 'Project is required' });
    }

    // Validate project is allowed (whitelist empty = allow any project under basePath)
    if (!isProjectAllowed(project)) {
      return res.status(400).json({
        success: false,
        error: `Project "${project}" is not in whitelist`,
        errorCode: 'PROJECT_NOT_ALLOWED',
      });
    }

    // Check capacity
    if (!executionManager.canStart()) {
      return res.status(429).json({
        success: false,
        error: 'Maximum parallel sessions reached',
        errorCode: 'CAPACITY_EXCEEDED',
      });
    }

    // Generate session name with spawn prefix
    const sessionName = generateSessionName(project, 'spawn');

    // Resolve project path
    const projectPath = `${config.projects.basePath}/${project}`.replace('~', process.env.HOME!);

    try {
      // Create worktree if requested
      let worktreePath: string | undefined;
      let actualBranchName: string | undefined;

      if (worktree) {
        const worktreeResult = await worktreeManager.create(projectPath, sessionName, branchName);
        if (worktreeResult) {
          worktreePath = worktreeResult.worktreePath;
          actualBranchName = worktreeResult.branch;
        }
      }

      // Get custom env vars from environment if specified
      const customEnvVars: Record<string, string> = {};
      if (environmentId) {
        setSessionEnvironment(sessionName, environmentId);
        // Environment variables will be loaded from the environment settings
      }

      const cwd = worktreePath || projectPath;

      // Register with execution manager
      executionManager.register(sessionName, project, worktreePath ?? null);

      // Create DB entry
      sessionsDb.upsertSession(sessionName, {
        project,
        status: 'init',
        lastEvent: 'Spawned',
        worktreePath,
        branchName: actualBranchName,
        spawn_prompt: prompt.substring(0, 1000), // Truncate for storage
        parent_session: parentSession,
        task_id: taskId,
      });

      // Terminal mode: use tmux + node-pty
      const flags: string[] = [];
      if (trustMode) {
        flags.push('--dangerously-skip-permissions');
      }
      if (model) {
        flags.push('--model', model);
      }

      // Sanitize prompt for shell
      const sanitizedPrompt = prompt
        .replace(/'/g, "'\\''") // Escape single quotes
        .replace(/\\/g, '\\\\'); // Escape backslashes

      const spawnCommand = `claude ${flags.join(' ')} -p '${sanitizedPrompt}'`.trim();

      const terminal = createTerminal(cwd, sessionName, {
        customEnvVars,
        spawnCommand,
      });

      // Set up exit handler - read output from tee file
      terminal.onExit(({ exitCode }) => {
        console.log(`[Spawn] Session ${sessionName} exited with code ${exitCode}`);

        // Read output from the tee file (written by the wrapped command)
        const outputContent = readAndCleanupSpawnOutput(sessionName);
        if (outputContent) {
          console.log(
            `[Spawn] Captured ${outputContent.length} bytes of output for ${sessionName}`
          );
        } else {
          console.log(`[Spawn] No output file found for ${sessionName}`);
        }

        // Store output and exit info in database
        sessionsDb.upsertSession(sessionName, {
          status: 'idle',
          lastEvent: `Exited (${exitCode})`,
          exit_code: exitCode,
          exited_at: Date.now(),
          output_content: outputContent,
          output_captured_at: outputContent ? Date.now() : undefined,
        });
        executionManager.unregister(sessionName);
      });

      // Broadcast status
      const sessionInfo: WSSessionInfo = {
        name: sessionName,
        project,
        createdAt: Date.now(),
        status: 'init',
        statusSource: 'hook',
        lastEvent: 'Spawned',
        worktreePath,
        branchName: actualBranchName,
      };
      broadcastStatusUpdate(sessionInfo);

      res.json({
        success: true,
        sessionName,
        taskId,
        worktreePath,
        branchName: actualBranchName,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Spawn] Failed to spawn session:`, errorMessage);
      res.status(500).json({
        success: false,
        error: `Failed to spawn session: ${errorMessage}`,
      });
    }
  });

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
      // Fallback 1: Try reading from spawn output file (tee file)
      const spawnOutputPath = getSpawnOutputPath(sessionName);
      try {
        let output = fs.readFileSync(spawnOutputPath, 'utf-8');

        // Strip ANSI codes if plain format requested
        if (format === 'plain') {
          // eslint-disable-next-line no-control-regex
          output = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        }

        const outputLines = output.split('\n');
        return res.json({
          sessionName,
          output,
          totalLines: outputLines.length,
          returnedLines: outputLines.length,
          isRunning: false,
          capturedAt: Date.now(),
          source: 'file' as const,
        });
      } catch {
        // File doesn't exist, try database
      }

      // Fallback 2: Check database for stored output
      const session = sessionsDb.getSession(sessionName);
      if (session?.output_content) {
        let output = session.output_content;

        // Strip ANSI codes if plain format requested
        if (format === 'plain') {
          // eslint-disable-next-line no-control-regex
          output = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        }

        const outputLines = output.split('\n');
        return res.json({
          sessionName,
          output,
          totalLines: outputLines.length,
          returnedLines: outputLines.length,
          isRunning: false,
          capturedAt: session.output_captured_at ?? session.exited_at ?? Date.now(),
          source: 'database' as const,
        });
      }

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
        // Fallback to DB for persisted metrics (survives refresh)
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

        const envId = getSessionEnvironment(name);
        const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

        // Merge metrics: prefer hookData (fresh), fallback to DB (persisted)
        const model = hookData?.model ?? dbSession?.model ?? undefined;
        const costUsd = hookData?.costUsd ?? dbSession?.cost_usd ?? undefined;
        const contextUsage = hookData?.contextUsage ?? dbSession?.context_usage ?? undefined;
        const linesAdded = hookData?.linesAdded ?? dbSession?.lines_added ?? undefined;
        const linesRemoved = hookData?.linesRemoved ?? dbSession?.lines_removed ?? undefined;

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
          // StatusLine metrics (merged from memory and DB)
          model,
          costUsd,
          contextUsage,
          linesAdded,
          linesRemoved,
          // Git worktree isolation
          worktreePath: dbSession?.worktree_path ?? undefined,
          branchName: dbSession?.branch_name ?? undefined,
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

    const sessions: WSSessionInfo[] = archivedSessions.map((session) => {
      const envId = getSessionEnvironment(session.name);
      const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

      return {
        name: session.name,
        project: session.project,
        createdAt: session.created_at,
        status: session.status,
        attentionReason: session.attention_reason ?? undefined,
        statusSource: 'hook' as const,
        lastEvent: session.last_event ?? undefined,
        lastStatusChange: session.last_status_change,
        archivedAt: session.archived_at ?? undefined,
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
        // StatusLine metrics from DB
        model: session.model ?? undefined,
        costUsd: session.cost_usd ?? undefined,
        contextUsage: session.context_usage ?? undefined,
        linesAdded: session.lines_added ?? undefined,
        linesRemoved: session.lines_removed ?? undefined,
        // Git worktree isolation
        worktreePath: session.worktree_path ?? undefined,
        branchName: session.branch_name ?? undefined,
      };
    });

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

    const envId = getSessionEnvironment(sessionName);
    const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

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
      model: hookData?.model ?? dbSession?.model ?? undefined,
      costUsd: hookData?.costUsd ?? dbSession?.cost_usd ?? undefined,
      contextUsage: hookData?.contextUsage ?? dbSession?.context_usage ?? undefined,
      linesAdded: hookData?.linesAdded ?? dbSession?.lines_added ?? undefined,
      linesRemoved: hookData?.linesRemoved ?? dbSession?.lines_removed ?? undefined,
      worktreePath: dbSession?.worktree_path ?? undefined,
      branchName: dbSession?.branch_name ?? undefined,
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
      // Get session info before deleting to retrieve worktree path
      const session = sessionsDb.getSession(sessionName);

      await execAsync(`tmux kill-session -t "${sessionName}" 2>/dev/null`);
      console.log(`Killed tmux session: ${sessionName}`);

      // Clean up worktree if session had one
      if (session?.worktree_path && session?.project) {
        const projectPath = `${config.projects.basePath}/${session.project}`.replace(
          '~',
          process.env.HOME!
        );
        const removed = await worktreeManager.remove(projectPath, session.worktree_path);
        if (removed) {
          console.log(`[Delete] Removed worktree at ${session.worktree_path}`);
        }
      }

      sessionsDb.deleteSession(sessionName);
      sessionsDb.clearSessionEnvironmentId(sessionName);
      tmuxSessionStatus.delete(sessionName);
      clearSessionEnvironment(sessionName);
      executionManager.unregister(sessionName);
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

    // Get session info before archiving to retrieve worktree path
    const sessionBeforeArchive = sessionsDb.getSession(sessionName);

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

    // Clean up worktree immediately when archiving
    if (sessionBeforeArchive?.worktree_path && sessionBeforeArchive?.project) {
      const projectPath = `${config.projects.basePath}/${sessionBeforeArchive.project}`.replace(
        '~',
        process.env.HOME!
      );
      const removed = await worktreeManager.remove(projectPath, sessionBeforeArchive.worktree_path);
      if (removed) {
        sessionsDb.clearSessionWorktree(sessionName);
        console.log(`[Archive] Removed worktree at ${sessionBeforeArchive.worktree_path}`);
      }
    }

    tmuxSessionStatus.delete(sessionName);
    executionManager.unregister(sessionName);

    const envId = getSessionEnvironment(sessionName);
    const envMeta = envId ? getEnvironmentMetadata(envId) : undefined;

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
    };

    broadcastSessionArchived(sessionName, archivedInfo);

    res.json({
      success: true,
      message: `Session ${sessionName} archived`,
      session: archivedInfo,
    });
  });

  // Push branch to remote (for worktree sessions)
  router.post('/:sessionName/push', async (req, res) => {
    const { sessionName } = req.params;
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    const session = sessionsDb.getSession(sessionName);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.worktree_path || !session.branch_name) {
      return res.status(400).json({ error: 'Session has no worktree' });
    }

    try {
      await execAsync(`git push -u origin "${session.branch_name}"`, {
        cwd: session.worktree_path,
      });

      console.log(`[Push] Pushed branch ${session.branch_name} for session ${sessionName}`);

      res.json({
        success: true,
        branch: session.branch_name,
        message: `Branch ${session.branch_name} pushed to origin`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Push] Failed to push branch for session ${sessionName}:`, errorMessage);
      res.status(500).json({ error: `Failed to push branch: ${errorMessage}` });
    }
  });

  // Create PR via gh CLI (for worktree sessions)
  router.post('/:sessionName/create-pr', async (req, res) => {
    const { sessionName } = req.params;
    const { title, body } = req.body as { title?: string; body?: string };
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (!/^[\w-]+$/.test(sessionName)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    if (!title) {
      return res.status(400).json({ error: 'PR title is required' });
    }

    const session = sessionsDb.getSession(sessionName);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.worktree_path || !session.branch_name) {
      return res.status(400).json({ error: 'Session has no worktree' });
    }

    try {
      // Push branch first
      await execAsync(`git push -u origin "${session.branch_name}"`, {
        cwd: session.worktree_path,
      });

      // Create PR using gh CLI
      const prBody = body || '';
      const { stdout } = await execAsync(
        `gh pr create --title "${title.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}"`,
        { cwd: session.worktree_path }
      );

      const prUrl = stdout.trim();
      console.log(`[PR] Created PR for session ${sessionName}: ${prUrl}`);

      res.json({
        success: true,
        prUrl,
        branch: session.branch_name,
        message: `PR created: ${prUrl}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[PR] Failed to create PR for session ${sessionName}:`, errorMessage);
      res.status(500).json({ error: `Failed to create PR: ${errorMessage}` });
    }
  });

  return router;
}
