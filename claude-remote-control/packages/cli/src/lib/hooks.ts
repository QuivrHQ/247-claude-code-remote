import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  chmodSync,
  unlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Paths
const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const HOOKS_DIR = join(homedir(), '.247', 'hooks');
const HOOK_SCRIPT_NAME = 'notify-247.sh';
const HOOK_SCRIPT_PATH = join(HOOKS_DIR, HOOK_SCRIPT_NAME);

// Hook configuration for Claude Code settings.json
const HOOK_MATCHER = '*';
const HOOK_COMMAND = `bash ${HOOK_SCRIPT_PATH}`;
// All hook types we need to register
const HOOK_TYPES = ['Stop', 'PermissionRequest', 'Notification'] as const;

export interface HookStatus {
  installed: boolean;
  version: string | null;
  path: string;
  settingsConfigured: boolean;
  needsUpdate: boolean;
  packagedVersion: string;
}

export interface InstallResult {
  success: boolean;
  error?: string;
  installedVersion?: string;
}

export interface UninstallResult {
  success: boolean;
  error?: string;
}

/**
 * Get the path to the packaged hook script.
 * In dev mode, it's in packages/hooks; in production, it's bundled with CLI.
 */
function getPackagedHookPath(): string {
  // CLI root is 2 levels up from lib/ (dist/lib -> dist -> cli root)
  const cliRoot = join(__dirname, '..', '..');

  // Check if running from source (monorepo) or installed (npm global)
  const monorepoRoot = join(cliRoot, '..', '..');
  const isDev = existsSync(join(monorepoRoot, 'pnpm-workspace.yaml'));

  if (isDev) {
    // Development: hook is in packages/hooks
    return join(monorepoRoot, 'packages', 'hooks', HOOK_SCRIPT_NAME);
  } else {
    // Production: hook is bundled in cli/hooks
    return join(cliRoot, 'hooks', HOOK_SCRIPT_NAME);
  }
}

/**
 * Extract version from a hook script.
 * Looks for: # VERSION: x.y.z
 */
function extractVersion(scriptPath: string): string | null {
  try {
    if (!existsSync(scriptPath)) return null;
    const content = readFileSync(scriptPath, 'utf-8');
    const match = content.match(/^# VERSION:\s*(\d+\.\d+\.\d+)/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get the version of the installed hook script.
 */
export function getHookVersion(): string | null {
  return extractVersion(HOOK_SCRIPT_PATH);
}

/**
 * Get the version of the packaged hook script.
 */
export function getPackagedHookVersion(): string {
  const packagedPath = getPackagedHookPath();
  const version = extractVersion(packagedPath);
  // Fall back to reading from package.json if not found in script
  if (!version) {
    try {
      const cliRoot = join(__dirname, '..', '..');
      const pkgPath = join(cliRoot, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        return pkg.version || '0.0.0';
      }
    } catch {
      // Ignore
    }
    return '0.0.0';
  }
  return version;
}

/**
 * Check if the hook is installed in Claude Code settings for all required hook types.
 */
function isHookInSettings(): boolean {
  try {
    if (!existsSync(CLAUDE_SETTINGS_PATH)) return false;
    const content = readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(content);

    if (!settings.hooks) return false;

    // Check if our hook is registered for all required types
    return HOOK_TYPES.every((hookType) => {
      const hookArray = settings.hooks[hookType];
      if (!Array.isArray(hookArray)) return false;
      return hookArray.some(
        (entry: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
          entry.matcher === HOOK_MATCHER &&
          entry.hooks?.some((h) => h.command?.includes(HOOK_SCRIPT_NAME))
      );
    });
  } catch {
    return false;
  }
}

/**
 * Check if the hook script file exists.
 */
export function isHookInstalled(): boolean {
  return existsSync(HOOK_SCRIPT_PATH) && isHookInSettings();
}

/**
 * Check if the installed hook needs an update.
 */
export function needsUpdate(): boolean {
  const installedVersion = getHookVersion();
  const packagedVersion = getPackagedHookVersion();

  if (!installedVersion) return true;
  if (!packagedVersion) return false;

  // Simple semver comparison
  const installed = installedVersion.split('.').map(Number);
  const packaged = packagedVersion.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (packaged[i] > installed[i]) return true;
    if (packaged[i] < installed[i]) return false;
  }

  return false;
}

/**
 * Get comprehensive hook status.
 */
export function getHooksStatus(): HookStatus {
  const scriptExists = existsSync(HOOK_SCRIPT_PATH);
  const settingsConfigured = isHookInSettings();
  const installedVersion = scriptExists ? getHookVersion() : null;
  const packagedVersion = getPackagedHookVersion();

  return {
    installed: scriptExists && settingsConfigured,
    version: installedVersion,
    path: HOOK_SCRIPT_PATH,
    settingsConfigured,
    needsUpdate: scriptExists ? needsUpdate() : false,
    packagedVersion,
  };
}

/**
 * Read Claude Code settings.json, creating default if needed.
 */
function readClaudeSettings(): Record<string, unknown> {
  try {
    if (existsSync(CLAUDE_SETTINGS_PATH)) {
      const content = readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore parse errors, will create new settings
  }
  return {};
}

/**
 * Write Claude Code settings.json.
 */
function writeClaudeSettings(settings: Record<string, unknown>): void {
  const dir = dirname(CLAUDE_SETTINGS_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

/**
 * Install the hook: copy script and update Claude Code settings.
 */
export function installHook(): InstallResult {
  try {
    // 1. Ensure hooks directory exists
    if (!existsSync(HOOKS_DIR)) {
      mkdirSync(HOOKS_DIR, { recursive: true });
    }

    // 2. Copy hook script
    const packagedPath = getPackagedHookPath();
    if (!existsSync(packagedPath)) {
      return { success: false, error: `Packaged hook not found at ${packagedPath}` };
    }

    copyFileSync(packagedPath, HOOK_SCRIPT_PATH);
    chmodSync(HOOK_SCRIPT_PATH, 0o755); // Make executable

    // 3. Update Claude Code settings
    const settings = readClaudeSettings();

    // Ensure hooks object exists
    if (!settings.hooks) {
      settings.hooks = {};
    }

    const hooks = settings.hooks as Record<string, unknown[]>;

    // Install hook for all required types (Stop, PermissionRequest, Notification)
    for (const hookType of HOOK_TYPES) {
      // Ensure array exists
      if (!Array.isArray(hooks[hookType])) {
        hooks[hookType] = [];
      }

      // Remove any existing 247 hook entries
      hooks[hookType] = (
        hooks[hookType] as Array<{
          matcher?: string;
          hooks?: Array<{ command?: string }>;
        }>
      ).filter(
        (entry) =>
          !(entry.matcher === HOOK_MATCHER && entry.hooks?.some((h) => h.command?.includes('247')))
      );

      // Add our hook
      hooks[hookType].push({
        matcher: HOOK_MATCHER,
        hooks: [
          {
            type: 'command',
            command: HOOK_COMMAND,
          },
        ],
      });
    }

    writeClaudeSettings(settings);

    const installedVersion = getHookVersion();
    return { success: true, installedVersion: installedVersion || undefined };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Uninstall the hook: remove from settings and optionally delete script.
 */
export function uninstallHook(removeScript: boolean = true): UninstallResult {
  try {
    // 1. Remove from Claude Code settings
    if (existsSync(CLAUDE_SETTINGS_PATH)) {
      const settings = readClaudeSettings();

      if (settings.hooks) {
        const hooks = settings.hooks as Record<string, unknown[]>;

        // Remove from all hook types
        for (const hookType of HOOK_TYPES) {
          if (Array.isArray(hooks[hookType])) {
            hooks[hookType] = (
              hooks[hookType] as Array<{
                matcher?: string;
                hooks?: Array<{ command?: string }>;
              }>
            ).filter(
              (entry) =>
                !(
                  entry.matcher === HOOK_MATCHER &&
                  entry.hooks?.some((h) => h.command?.includes('247'))
                )
            );

            // Clean up empty array
            if (hooks[hookType].length === 0) {
              delete hooks[hookType];
            }
          }
        }

        // Clean up empty hooks object
        if (Object.keys(hooks).length === 0) {
          delete settings.hooks;
        }

        writeClaudeSettings(settings);
      }
    }

    // 2. Remove script file if requested
    if (removeScript && existsSync(HOOK_SCRIPT_PATH)) {
      unlinkSync(HOOK_SCRIPT_PATH);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
