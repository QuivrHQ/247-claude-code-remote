/**
 * Project-related API routes: listing, folder scanning, and git clone.
 */

import { Router } from 'express';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { resolveRealProjectPath } from '../lib/project-path.js';

function isMissingDirectoryError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

export function createProjectRoutes(): Router {
  const router = Router();

  // List whitelisted projects
  router.get('/projects', (_req, res) => {
    res.json(config.projects.whitelist);
  });

  // Dynamic folder listing - scans basePath (or basePath/<path>) for directories
  router.get('/folders', async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const basePath = config.projects.basePath.replace('~', process.env.HOME!);

      const relativePath = typeof req.query.path === 'string' ? req.query.path : '';
      let directory = basePath;
      if (relativePath !== '') {
        // Follows symlinks so a link under basePath can't escape the root.
        const resolved = await resolveRealProjectPath(basePath, relativePath);
        if (!resolved) {
          return res.status(400).json({ error: 'Invalid path' });
        }
        directory = resolved;
      }

      const entries = await fs.readdir(directory, { withFileTypes: true });
      const folders = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();

      res.json(folders);
    } catch (err) {
      if (isMissingDirectoryError(err)) {
        return res.status(404).json({ error: 'Folder not found' });
      }
      console.error('Failed to list folders:', err);
      res.status(500).json({ error: 'Failed to list folders' });
    }
  });

  // Clone a git repository
  router.post('/clone', async (req, res) => {
    const { url } = req.body as { url?: string };

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // Validate URL format (https:// or git@)
    const httpsPattern = /^https:\/\/.+\/.+/;
    const sshPattern = /^git@.+:.+/;
    if (!httpsPattern.test(url) && !sshPattern.test(url)) {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    // Extract repo name from URL
    let repoName: string;
    try {
      if (url.startsWith('git@')) {
        // git@github.com:user/repo.git -> repo
        const match = url.match(/:([^/]+\/)?(.+?)(\.git)?$/);
        repoName = match?.[2] || '';
      } else {
        // https://github.com/user/repo.git -> repo
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        repoName = pathParts[pathParts.length - 1]?.replace(/\.git$/, '') || '';
      }

      if (!repoName) {
        return res
          .status(400)
          .json({ success: false, error: 'Could not extract repo name from URL' });
      }
    } catch (_err) {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    const fs = await import('fs/promises');
    const path = await import('path');
    const basePath = config.projects.basePath.replace('~', process.env.HOME!);
    const targetPath = path.join(basePath, repoName);

    // Check if folder already exists
    try {
      await fs.access(targetPath);
      return res.status(400).json({
        success: false,
        error: `Folder "${repoName}" already exists`,
      });
    } catch (_err) {
      // Folder doesn't exist, good to proceed
    }

    // Clone the repository
    return new Promise<void>((resolve) => {
      const gitProcess = spawn('git', ['clone', url, repoName], {
        cwd: basePath,
        env: process.env,
      });

      let stderr = '';

      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`Successfully cloned ${url} to ${targetPath}`);
          res.json({
            success: true,
            project: repoName,
            path: targetPath,
          });
        } else {
          console.error(`Git clone failed: ${stderr}`);
          res.status(500).json({
            success: false,
            error: stderr.trim() || 'Git clone failed',
          });
        }
        resolve();
      });

      gitProcess.on('error', (err) => {
        console.error('Failed to spawn git:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to execute git command',
        });
        resolve();
      });
    });
  });

  return router;
}
