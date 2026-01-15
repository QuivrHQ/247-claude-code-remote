/**
 * Project-related API routes: listing and folder scanning.
 */

import { Router } from 'express';
import { config } from '../config.js';

// Helper to check if project is allowed (whitelist empty = allow any)
export function isProjectAllowed(project: string): boolean {
  const whitelist = config.projects.whitelist as string[];
  const hasWhitelist = whitelist && whitelist.length > 0;
  return hasWhitelist ? whitelist.includes(project) : true;
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

  return router;
}
