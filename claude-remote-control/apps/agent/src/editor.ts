import { spawn, ChildProcess } from 'child_process';
import type { EditorConfig, EditorStatus } from '@claude-remote/shared';

interface EditorInstance {
  project: string;
  port: number;
  process: ChildProcess;
  startedAt: number;
  lastActivity: number;
}

// Active code-server instances (one per project)
const editorInstances = new Map<string, EditorInstance>();

// Port allocation tracking
const usedPorts = new Set<number>();

// Default config if not provided
const DEFAULT_CONFIG: EditorConfig = {
  enabled: true,
  portRange: { start: 4680, end: 4699 },
  idleTimeout: 30 * 60 * 1000, // 30 minutes
};

let editorConfig: EditorConfig = DEFAULT_CONFIG;
let projectsBasePath = '~/Dev';

// Initialize editor manager with config
export function initEditor(config: EditorConfig | undefined, basePath: string): void {
  editorConfig = config || DEFAULT_CONFIG;
  projectsBasePath = basePath;

  if (editorConfig.enabled) {
    // Start idle cleanup interval (check every 5 minutes)
    setInterval(cleanupIdleEditors, 5 * 60 * 1000);
    console.log('[Editor] Manager initialized, idle timeout:', editorConfig.idleTimeout / 1000, 's');
  }
}

// Allocate next available port from range
function allocatePort(): number | null {
  for (let port = editorConfig.portRange.start; port <= editorConfig.portRange.end; port++) {
    if (!usedPorts.has(port)) {
      usedPorts.add(port);
      return port;
    }
  }
  return null;
}

// Release port back to pool
function releasePort(port: number): void {
  usedPorts.delete(port);
}

// Get or start code-server for a project
export async function getOrStartEditor(project: string): Promise<EditorInstance> {
  // Check if already running
  const existing = editorInstances.get(project);
  if (existing) {
    existing.lastActivity = Date.now();
    return existing;
  }

  // Allocate port
  const port = allocatePort();
  if (!port) {
    throw new Error('No available ports for code-server');
  }

  // Resolve project path
  const projectPath = `${projectsBasePath}/${project}`.replace('~', process.env.HOME!);

  console.log(`[Editor] Starting code-server for ${project} on port ${port}`);

  // Spawn code-server process with extended PATH for Homebrew
  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`,
  };

  const codeServer = spawn('code-server', [
    '--bind-addr', `127.0.0.1:${port}`,
    '--auth', 'none',
    '--disable-telemetry',
    '--disable-update-check',
    '--disable-proxy',
    projectPath,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env,
  });

  const instance: EditorInstance = {
    project,
    port,
    process: codeServer,
    startedAt: Date.now(),
    lastActivity: Date.now(),
  };

  // Handle process events
  codeServer.on('error', (err) => {
    console.error(`[Editor] code-server error for ${project}:`, err);
    cleanupInstance(project);
  });

  codeServer.on('exit', (code) => {
    console.log(`[Editor] code-server for ${project} exited with code ${code}`);
    cleanupInstance(project);
  });

  // Log output for debugging
  codeServer.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('HTTP server listening')) {
      console.log(`[Editor] code-server ready for ${project} at http://127.0.0.1:${port}`);
    }
  });

  codeServer.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    // Filter out noisy messages
    if (!msg.includes('libva error') && !msg.includes('GLIBCXX')) {
      console.error(`[Editor] ${project}:`, msg);
    }
  });

  editorInstances.set(project, instance);

  // Wait for code-server to be ready (simple delay for now)
  await new Promise(resolve => setTimeout(resolve, 2000));

  return instance;
}

// Stop code-server for a project
export function stopEditor(project: string): boolean {
  const instance = editorInstances.get(project);
  if (!instance) {
    return false;
  }

  console.log(`[Editor] Stopping code-server for ${project}`);
  instance.process.kill('SIGTERM');
  cleanupInstance(project);
  return true;
}

// Cleanup instance resources
function cleanupInstance(project: string): void {
  const instance = editorInstances.get(project);
  if (instance) {
    releasePort(instance.port);
    editorInstances.delete(project);
  }
}

// Get status of editor for a project
export function getEditorStatus(project: string): EditorStatus {
  const instance = editorInstances.get(project);

  return {
    project,
    running: !!instance,
    port: instance?.port,
    pid: instance?.process.pid,
    startedAt: instance?.startedAt,
    lastActivity: instance?.lastActivity,
  };
}

// Get all running editors
export function getAllEditors(): EditorStatus[] {
  return Array.from(editorInstances.keys()).map(getEditorStatus);
}

// Update last activity timestamp (called when proxy forwards requests)
export function updateEditorActivity(project: string): void {
  const instance = editorInstances.get(project);
  if (instance) {
    instance.lastActivity = Date.now();
  }
}

// Cleanup idle editors (called periodically)
function cleanupIdleEditors(): void {
  const now = Date.now();

  for (const [project, instance] of editorInstances) {
    const idleTime = now - instance.lastActivity;
    if (idleTime > editorConfig.idleTimeout) {
      console.log(`[Editor] Stopping idle code-server for ${project} (idle ${Math.round(idleTime / 1000)}s)`);
      stopEditor(project);
    }
  }
}

// Graceful shutdown - stop all editors
export function shutdownAllEditors(): void {
  console.log(`[Editor] Shutting down ${editorInstances.size} code-server instances`);
  for (const project of editorInstances.keys()) {
    stopEditor(project);
  }
}
