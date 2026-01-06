import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

const execAsync = promisify(exec);

export interface CloneResult {
  success: boolean;
  projectName: string;
  path: string;
  error?: string;
}

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'unchanged' | 'conflicted';

export interface FileNode {
  path: string;           // Relative path from project root
  name: string;           // File/directory name
  type: 'file' | 'directory';
  status?: GitFileStatus;
  children?: FileNode[];
  extension?: string;     // File extension for syntax highlighting
}

// Check if a directory is a git repository
export async function isGitRepo(projectPath: string): Promise<boolean> {
  try {
    const gitDir = path.join(projectPath, '.git');
    const stat = await fs.stat(gitDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// Get git status for all files in a project
export async function getGitStatus(projectPath: string): Promise<Map<string, GitFileStatus>> {
  const statusMap = new Map<string, GitFileStatus>();

  // Check if it's a git repo
  if (!(await isGitRepo(projectPath))) {
    return statusMap;
  }

  try {
    // git status --porcelain returns: XY filename
    // X = staged status, Y = working tree status
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: projectPath,
      timeout: 10000,
    });

    const lines = stdout.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      if (line.length < 4) continue;

      const statusCode = line.substring(0, 2).trim();
      const filePath = line.substring(3);

      // Determine status from git code
      // M = modified, A = added, D = deleted, ?? = untracked, UU = conflicted
      let status: GitFileStatus;
      switch (statusCode) {
        case 'M':
        case 'MM':
        case 'AM':
          status = 'modified';
          break;
        case 'A':
          status = 'added';
          break;
        case 'D':
        case 'AD':
          status = 'deleted';
          break;
        case '??':
          status = 'untracked';
          break;
        case 'UU':
        case 'AA':
        case 'DD':
          status = 'conflicted';
          break;
        default:
          status = 'modified';
      }

      statusMap.set(filePath, status);
    }
  } catch (err) {
    console.error(`[Git] Failed to get status for ${projectPath}:`, (err as Error).message);
  }

  return statusMap;
}

// Check if a path should be ignored (node_modules, .git, etc.)
function shouldIgnore(name: string, isDir: boolean): boolean {
  const ignoredDirs = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.turbo',
    'coverage',
    '.vscode',
    '.idea',
  ];

  const ignoredFiles = [
    '.DS_Store',
    'Thumbs.db',
    '*.log',
  ];

  if (isDir && ignoredDirs.includes(name)) {
    return true;
  }

  if (!isDir && ignoredFiles.includes(name)) {
    return true;
  }

  return false;
}

// Get file extension for syntax highlighting
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  return '';
}

// Recursively build file tree
async function buildFileTree(
  dirPath: string,
  relativePath: string,
  gitStatus: Map<string, GitFileStatus>
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Sort: directories first, then files, both alphabetically
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    for (const entry of sortedEntries) {
      if (shouldIgnore(entry.name, entry.isDirectory())) {
        continue;
      }

      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const entryFullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively process directory
        const children = await buildFileTree(entryFullPath, entryRelativePath, gitStatus);

        // Skip empty directories that aren't in git
        if (children.length === 0 && !gitStatus.has(entryRelativePath + '/')) {
          continue;
        }

        // Directory status is derived from children (most "significant" status)
        const dirStatus = getDirectoryStatus(entryRelativePath, gitStatus, children);

        nodes.push({
          path: entryRelativePath,
          name: entry.name,
          type: 'directory',
          status: dirStatus,
          children,
        });
      } else {
        // File node
        nodes.push({
          path: entryRelativePath,
          name: entry.name,
          type: 'file',
          status: gitStatus.get(entryRelativePath),
          extension: getFileExtension(entry.name),
        });
      }
    }
  } catch (err) {
    console.error(`[Git] Failed to read directory ${dirPath}:`, (err as Error).message);
  }

  return nodes;
}

// Determine directory status based on its contents
function getDirectoryStatus(
  dirPath: string,
  gitStatus: Map<string, GitFileStatus>,
  children: FileNode[]
): GitFileStatus | undefined {
  // Check if directory itself has a status (e.g., deleted)
  const dirWithSlash = dirPath + '/';
  if (gitStatus.has(dirWithSlash)) {
    return gitStatus.get(dirWithSlash);
  }

  // Check children for status (priority: conflicted > modified > added > deleted > untracked)
  const statusPriority: GitFileStatus[] = ['conflicted', 'modified', 'added', 'deleted', 'untracked'];

  for (const status of statusPriority) {
    const hasChildWithStatus = children.some(child => {
      if (child.status === status) return true;
      if (child.children) {
        return child.children.some(c => c.status === status);
      }
      return false;
    });
    if (hasChildWithStatus) return status;
  }

  return undefined;
}

// List all files in a project as a tree
export async function listFiles(projectPath: string): Promise<FileNode[]> {
  // Get git status first
  const gitStatus = await getGitStatus(projectPath);

  // Build file tree
  const tree = await buildFileTree(projectPath, '', gitStatus);

  return tree;
}

// Get file content for preview
export async function getFileContent(projectPath: string, filePath: string): Promise<{
  content: string;
  encoding: BufferEncoding;
  size: number;
  isBinary: boolean;
}> {
  const fullPath = path.join(projectPath, filePath);

  try {
    const stats = await fs.stat(fullPath);

    // Check if file is too large (>1MB)
    if (stats.size > 1024 * 1024) {
      return {
        content: '// File too large to preview (>1MB)',
        encoding: 'utf-8',
        size: stats.size,
        isBinary: false,
      };
    }

    // Try to read as text
    const buffer = await fs.readFile(fullPath);

    // Check for binary files (null bytes common in binaries)
    if (buffer.includes(0)) {
      return {
        content: '// Binary file - cannot preview',
        encoding: 'utf-8',
        size: stats.size,
        isBinary: true,
      };
    }

    // Convert to string
    const content = buffer.toString('utf-8');

    return {
      content,
      encoding: 'utf-8',
      size: stats.size,
      isBinary: false,
    };
  } catch (err) {
    throw new Error(`Failed to read file: ${(err as Error).message}`);
  }
}

// Open a file in the local editor (VS Code, Cursor, etc.)
export async function openFileInEditor(projectPath: string, filePath: string): Promise<{
  success: boolean;
  command?: string;
  error?: string;
}> {
  const fullPath = path.join(projectPath, filePath);

  // Check file exists
  try {
    await fs.access(fullPath);
  } catch {
    return {
      success: false,
      error: 'File not found',
    };
  }

  // Try different editors in order of preference
  const editors = [
    { cmd: 'cursor', args: ['--goto'] },
    { cmd: 'code', args: ['--goto'] },
    { cmd: 'code', args: [] }, // Fallback without --goto
    { cmd: 'subl', args: [] },
    { cmd: 'vim', args: [] },
  ];

  for (const editor of editors) {
    try {
      // Check if editor is available
      await execAsync(`which ${editor.cmd}`, { timeout: 1000 });

      // Open file using spawn (detached)
      const args = [...editor.args, fullPath];
      spawn(editor.cmd, args, {
        cwd: projectPath,
        stdio: 'ignore',
        detached: true,
      }).unref();

      return {
        success: true,
        command: editor.cmd,
      };
    } catch {
      // Editor not available, try next
      continue;
    }
  }

  return {
    success: false,
    error: 'No suitable editor found (install VS Code, Cursor, or Sublime Text)',
  };
}

// Get summary of changes
export async function getChangesSummary(projectPath: string): Promise<{
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
  conflicted: number;
}> {
  const gitStatus = await getGitStatus(projectPath);

  const summary = {
    modified: 0,
    added: 0,
    deleted: 0,
    untracked: 0,
    conflicted: 0,
  };

  for (const status of gitStatus.values()) {
    switch (status) {
      case 'modified':
        summary.modified++;
        break;
      case 'added':
        summary.added++;
        break;
      case 'deleted':
        summary.deleted++;
        break;
      case 'untracked':
        summary.untracked++;
        break;
      case 'conflicted':
        summary.conflicted++;
        break;
    }
  }

  return summary;
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
