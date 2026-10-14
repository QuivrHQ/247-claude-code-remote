/**
 * Project-related API routes: listing, folder scanning, and git clone.
 */

import { Router } from 'express';
import { spawn } from 'child_process';
import { config } from '../config.js';

/**
 * Validates a repository directory name derived from a client-supplied git URL.
 *
 * The name becomes both a path segment under the projects base directory and an
 * argument to `git clone`, so it must not enable path traversal, escape the base
 * directory, or inject extra git options. We reject empty names, the `.`/`..`
 * specials, any name containing a path separator, names beginning with `-`
 * (git option injection) or `.` (hidden/relative), names containing NUL or other
 * control characters, and anything outside a conservative character set.
 */
function isValidRepoName(name: string): boolean {
  if (!name) return false;
  if (name === '.' || name === '..') return false;
  if (name.includes('/') || name.includes('\\')) return false;
  if (name.startsWith('-') || name.startsWith('.')) return false;
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false; // NUL / control chars
  }
  return /^[A-Za-z0-9._-]+$/.test(name);
}

export function createProjectRoutes(): Router {
  const router = Router();

  // List whitelisted projects
  router.get('/projects', (_req, res) => {
    res.json(config.projects.whitelist);
  });

  // Dynamic folder listing - scans basePath for directories
  router.get('/folders', async (_req, res) => {
    try {
      const fs = await import('fs/promises');
      const basePath = config.projects.basePath.replace('~', process.env.HOME!);

      const entries = await fs.readdir(basePath, { withFileTypes: true });
      const folders = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort();

      res.json(folders);
    } catch (err) {
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

    // Reject crafted repo names (path traversal, option injection, odd chars)
    // before the value is used as a path segment and a `git clone` argument.
    if (!isValidRepoName(repoName)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid repository name derived from URL' });
    }

    const fs = await import('fs/promises');
    const path = await import('path');
    const basePath = config.projects.basePath.replace('~', process.env.HOME!);
    const resolvedBase = path.resolve(basePath);
    const targetPath = path.join(resolvedBase, repoName);

    // Defense in depth: the resolved target must stay inside the base directory.
    // Don't double the separator when basePath is the filesystem root ('/'),
    // otherwise a valid child like '/myrepo' would be wrongly rejected.
    const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
    if (targetPath !== resolvedBase && !targetPath.startsWith(baseWithSep)) {
      return res
        .status(400)
        .json({ success: false, error: 'Resolved clone path escapes the projects directory' });
    }

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
      const gitProcess = spawn('git', ['clone', '--', url, repoName], {
        cwd: resolvedBase,
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
