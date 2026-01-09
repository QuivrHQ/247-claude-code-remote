import { existsSync, lstatSync, unlinkSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getAgentPaths } from '../lib/paths.js';

export interface HooksStatus {
  installed: boolean;
  path: string;
  isSymlink: boolean;
  settingsHooksFound: boolean;
}

const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const OLD_HOOK_PATTERN = /notify-status\.sh|packages\/hooks/;

/**
 * Check if settings.json contains old 247 hooks.
 */
function hasOldHooksInSettings(): boolean {
  try {
    if (!existsSync(CLAUDE_SETTINGS_PATH)) return false;
    const content = readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(content);
    if (!settings.hooks) return false;

    // Check if any hook command contains our old pattern
    const hooksJson = JSON.stringify(settings.hooks);
    return OLD_HOOK_PATTERN.test(hooksJson);
  } catch {
    return false;
  }
}

/**
 * Remove old 247 hooks from settings.json.
 */
function removeHooksFromSettings(): { success: boolean; error?: string } {
  try {
    if (!existsSync(CLAUDE_SETTINGS_PATH)) return { success: true };

    const content = readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(content);

    if (!settings.hooks) return { success: true };

    // Check if hooks contain our old pattern
    const hooksJson = JSON.stringify(settings.hooks);
    if (!OLD_HOOK_PATTERN.test(hooksJson)) return { success: true };

    // Remove the hooks section entirely
    delete settings.hooks;

    writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get old hooks installation status.
 * Used for detecting legacy hooks that need cleanup.
 */
export function getHooksStatus(): HooksStatus {
  const paths = getAgentPaths();
  const dest = paths.hooksDestination;
  const pluginJsonPath = join(dest, '.claude-plugin', 'plugin.json');

  const pluginInstalled = existsSync(pluginJsonPath);
  const settingsHooksFound = hasOldHooksInSettings();
  let isSymlink = false;

  if (pluginInstalled) {
    try {
      isSymlink = lstatSync(dest).isSymbolicLink();
    } catch {
      // Not a symlink
    }
  }

  return {
    installed: pluginInstalled || settingsHooksFound,
    path: dest,
    isSymlink,
    settingsHooksFound,
  };
}

/**
 * Uninstall old hooks from ~/.claude-plugins/247-hooks/ and ~/.claude/settings.json.
 * Used for cleaning up the deprecated plugin-based hooks system.
 */
export function uninstallHooks(): { success: boolean; error?: string; cleanedSettings?: boolean } {
  const paths = getAgentPaths();
  const dest = paths.hooksDestination;
  const errors: string[] = [];
  let cleanedSettings = false;

  // 1. Remove plugin directory if exists
  if (existsSync(dest)) {
    try {
      const isSymlink = lstatSync(dest).isSymbolicLink();
      if (isSymlink) {
        unlinkSync(dest);
      } else {
        rmSync(dest, { recursive: true, force: true });
      }
    } catch (err) {
      errors.push(`Plugin dir: ${(err as Error).message}`);
    }
  }

  // 2. Remove hooks from settings.json
  const settingsResult = removeHooksFromSettings();
  if (!settingsResult.success) {
    errors.push(`Settings: ${settingsResult.error}`);
  } else if (hasOldHooksInSettings() === false && existsSync(CLAUDE_SETTINGS_PATH)) {
    // Check if we actually removed something
    cleanedSettings = true;
  }

  if (errors.length > 0) {
    return { success: false, error: errors.join('; ') };
  }

  return { success: true, cleanedSettings };
}
