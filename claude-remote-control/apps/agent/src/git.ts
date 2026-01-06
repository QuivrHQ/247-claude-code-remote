import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CloneResult {
  success: boolean;
  projectName: string;
  path: string;
  error?: string;
}

// Validate git URL to prevent injection attacks
function isValidGitUrl(url: string): boolean {
  // Allow common git URL formats
  const patterns = [
    // HTTPS URLs
    /^https?:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(?:\.git)?$/,
    // SSH URLs (git@host:user/repo)
    /^git@[\w.-]+:[\w.-]+\/[\w.-]+(?:\.git)?$/,
    // GitHub shorthand
    /^[\w.-]+\/[\w.-]+$/,
  ];

  return patterns.some(pattern => pattern.test(url));
}

// Extract project name from git URL
export function extractProjectName(url: string): string {
  // Remove trailing .git if present
  let cleanUrl = url.replace(/\.git$/, '');

  // Handle different URL formats
  if (cleanUrl.includes(':') && !cleanUrl.includes('://')) {
    // SSH format: git@github.com:user/repo
    cleanUrl = cleanUrl.split(':').pop() || '';
  } else if (cleanUrl.includes('://')) {
    // HTTPS format: https://github.com/user/repo
    cleanUrl = cleanUrl.split('/').slice(-2).join('/');
  }

  // Get the last part (repo name)
  const parts = cleanUrl.split('/');
  return parts[parts.length - 1] || 'cloned-repo';
}

// Validate project name
function isValidProjectName(name: string): boolean {
  // Allow alphanumeric, hyphens, underscores, dots
  return /^[\w.-]+$/.test(name) && name.length > 0 && name.length <= 100;
}

// Clone a git repository
export async function cloneRepo(
  repoUrl: string,
  basePath: string,
  projectName?: string
): Promise<CloneResult> {
  // Validate URL
  if (!isValidGitUrl(repoUrl)) {
    return {
      success: false,
      projectName: '',
      path: '',
      error: 'Invalid git URL format',
    };
  }

  // Determine project name
  const finalProjectName = projectName || extractProjectName(repoUrl);

  // Validate project name
  if (!isValidProjectName(finalProjectName)) {
    return {
      success: false,
      projectName: finalProjectName,
      path: '',
      error: 'Invalid project name (use alphanumeric, hyphens, underscores)',
    };
  }

  // Resolve paths
  const resolvedBasePath = basePath.replace('~', process.env.HOME || '');
  const targetPath = path.join(resolvedBasePath, finalProjectName);

  // Check if directory already exists
  try {
    await fs.access(targetPath);
    return {
      success: false,
      projectName: finalProjectName,
      path: targetPath,
      error: `Directory already exists: ${finalProjectName}`,
    };
  } catch {
    // Directory doesn't exist, good to proceed
  }

  // Run git clone
  try {
    console.log(`[Git] Cloning ${repoUrl} to ${targetPath}...`);

    // Use SSH if available, otherwise HTTPS
    // The git command will use the user's SSH keys automatically
    const { stderr } = await execAsync(
      `git clone "${repoUrl}" "${targetPath}"`,
      {
        cwd: resolvedBasePath,
        timeout: 300000, // 5 minute timeout for large repos
      }
    );

    // Check for any errors in stderr (git outputs progress to stderr)
    if (stderr && stderr.includes('fatal:')) {
      throw new Error(stderr);
    }

    console.log(`[Git] Successfully cloned ${repoUrl}`);
    return {
      success: true,
      projectName: finalProjectName,
      path: targetPath,
    };
  } catch (err) {
    const error = err as Error & { stderr?: string };
    console.error(`[Git] Clone failed:`, error.message);

    // Clean up partial clone if it exists
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Parse common error messages
    let errorMessage = 'Clone failed';
    const errOutput = error.stderr || error.message || '';

    if (errOutput.includes('Permission denied')) {
      errorMessage = 'Permission denied - check SSH keys or use HTTPS URL';
    } else if (errOutput.includes('Repository not found')) {
      errorMessage = 'Repository not found - check URL and access permissions';
    } else if (errOutput.includes('Authentication failed')) {
      errorMessage = 'Authentication failed - check credentials';
    } else if (errOutput.includes('Could not resolve host')) {
      errorMessage = 'Could not resolve host - check network connection';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      projectName: finalProjectName,
      path: targetPath,
      error: errorMessage,
    };
  }
}
