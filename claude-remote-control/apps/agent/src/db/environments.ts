import { randomUUID } from 'crypto';
import { getDatabase } from './index.js';
import type { DbEnvironment } from './schema.js';
import type {
  Environment,
  EnvironmentMetadata,
  EnvironmentProvider,
  EnvironmentIcon,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
} from '@claude-remote/shared';
import { ENVIRONMENT_PRESETS } from '@claude-remote/shared';

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert database row to Environment
 */
function toEnvironment(row: DbEnvironment): Environment {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    icon: row.icon as EnvironmentIcon | null,
    isDefault: row.is_default === 1,
    variables: JSON.parse(row.variables),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert Environment to safe EnvironmentMetadata (no secret values)
 */
function toMetadata(env: Environment): EnvironmentMetadata {
  return {
    id: env.id,
    name: env.name,
    provider: env.provider,
    icon: env.icon,
    isDefault: env.isDefault,
    variableKeys: Object.keys(env.variables),
    createdAt: env.createdAt,
    updatedAt: env.updatedAt,
  };
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get all environments (full data, agent-side only)
 */
export function getAllEnvironments(): Environment[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM environments ORDER BY name').all() as DbEnvironment[];
  return rows.map(toEnvironment);
}

/**
 * Get all environments as safe metadata (for dashboard)
 */
export function getEnvironmentsMetadata(): EnvironmentMetadata[] {
  return getAllEnvironments().map(toMetadata);
}

/**
 * Get single environment by ID (full data)
 */
export function getEnvironment(id: string): Environment | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM environments WHERE id = ?').get(id) as
    | DbEnvironment
    | undefined;
  return row ? toEnvironment(row) : undefined;
}

/**
 * Get single environment metadata
 */
export function getEnvironmentMetadata(id: string): EnvironmentMetadata | undefined {
  const env = getEnvironment(id);
  if (!env) return undefined;
  return toMetadata(env);
}

/**
 * Get default environment
 */
export function getDefaultEnvironment(): Environment | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM environments WHERE is_default = 1').get() as
    | DbEnvironment
    | undefined;
  return row ? toEnvironment(row) : undefined;
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Create new environment
 */
export function createEnvironment(req: CreateEnvironmentRequest): Environment {
  const db = getDatabase();
  const now = Date.now();
  const id = randomUUID();

  // If setting as default, unset other defaults
  if (req.isDefault) {
    db.prepare('UPDATE environments SET is_default = 0').run();
  }

  // If this is the first environment, make it default
  const count = db.prepare('SELECT COUNT(*) as count FROM environments').get() as { count: number };
  const isFirstEnv = count.count === 0;

  db.prepare(
    `
    INSERT INTO environments (id, name, provider, icon, is_default, variables, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    req.name,
    req.provider,
    req.icon ?? null,
    req.isDefault || isFirstEnv ? 1 : 0,
    JSON.stringify(req.variables),
    now,
    now
  );

  console.log(`[Environments] Created environment: ${req.name} (${req.provider})`);
  return getEnvironment(id)!;
}

/**
 * Update environment
 */
export function updateEnvironment(id: string, req: UpdateEnvironmentRequest): Environment | null {
  const db = getDatabase();
  const existing = getEnvironment(id);
  if (!existing) return null;

  // If setting as default, unset other defaults
  if (req.isDefault) {
    db.prepare('UPDATE environments SET is_default = 0').run();
  }

  // Merge variables if provided (don't replace entirely, allow partial updates)
  const updatedVariables = req.variables
    ? { ...existing.variables, ...req.variables }
    : existing.variables;

  const now = Date.now();

  db.prepare(
    `
    UPDATE environments SET
      name = ?,
      provider = ?,
      icon = ?,
      is_default = ?,
      variables = ?,
      updated_at = ?
    WHERE id = ?
  `
  ).run(
    req.name ?? existing.name,
    req.provider ?? existing.provider,
    req.icon !== undefined ? req.icon : existing.icon,
    req.isDefault !== undefined ? (req.isDefault ? 1 : 0) : (existing.isDefault ? 1 : 0),
    JSON.stringify(updatedVariables),
    now,
    id
  );

  console.log(`[Environments] Updated environment: ${req.name ?? existing.name}`);
  return getEnvironment(id) ?? null;
}

/**
 * Delete environment
 */
export function deleteEnvironment(id: string): boolean {
  const db = getDatabase();
  const existing = getEnvironment(id);
  if (!existing) return false;

  const wasDefault = existing.isDefault;
  const deletedName = existing.name;

  db.prepare('DELETE FROM environments WHERE id = ?').run(id);

  // If deleted env was default, make first remaining env default
  if (wasDefault) {
    const first = db.prepare('SELECT id FROM environments LIMIT 1').get() as
      | { id: string }
      | undefined;
    if (first) {
      db.prepare('UPDATE environments SET is_default = 1 WHERE id = ?').run(first.id);
    }
  }

  console.log(`[Environments] Deleted environment: ${deletedName}`);
  return true;
}

// ============================================================================
// Session Environment Mapping
// ============================================================================

/**
 * Get environment variables for terminal injection
 * Returns the variables for the specified environment, or default if not found
 */
export function getEnvironmentVariables(environmentId?: string): Record<string, string> {
  let env: Environment | undefined;

  if (environmentId) {
    env = getEnvironment(environmentId);
  }

  // Fall back to default
  if (!env) {
    env = getDefaultEnvironment();
  }

  return env?.variables ?? {};
}

/**
 * Track which environment a session uses
 */
export function setSessionEnvironment(sessionName: string, environmentId: string): void {
  const db = getDatabase();
  db.prepare(
    `
    INSERT OR REPLACE INTO session_environments (session_name, environment_id)
    VALUES (?, ?)
  `
  ).run(sessionName, environmentId);
}

/**
 * Get the environment ID for a session
 */
export function getSessionEnvironment(sessionName: string): string | undefined {
  const db = getDatabase();
  const row = db
    .prepare('SELECT environment_id FROM session_environments WHERE session_name = ?')
    .get(sessionName) as { environment_id: string } | undefined;
  return row?.environment_id;
}

/**
 * Clear session environment tracking (when session is killed)
 */
export function clearSessionEnvironment(sessionName: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM session_environments WHERE session_name = ?').run(sessionName);
}

// ============================================================================
// Preset Operations
// ============================================================================

/**
 * Create environment from preset
 */
export function createEnvironmentFromPreset(
  provider: EnvironmentProvider,
  name: string,
  customVariables?: Record<string, string>
): Environment {
  const preset = ENVIRONMENT_PRESETS[provider];
  return createEnvironment({
    name,
    provider,
    variables: {
      ...preset.defaultVariables,
      ...customVariables,
    },
  });
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize environments with default if table is empty
 * Called during database initialization
 */
export function ensureDefaultEnvironment(): void {
  const db = getDatabase();
  const count = db.prepare('SELECT COUNT(*) as count FROM environments').get() as { count: number };

  if (count.count === 0) {
    console.log('[Environments] No environments found, creating default Anthropic environment');
    const now = Date.now();

    db.prepare(
      `
      INSERT INTO environments (id, name, provider, icon, is_default, variables, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run('default-anthropic', 'Anthropic (Default)', 'anthropic', null, 1, JSON.stringify({ ANTHROPIC_API_KEY: '' }), now, now);
  }
}

/**
 * Deprecated: No longer needed since we use SQLite
 * Kept for API compatibility during migration
 */
export function loadEnvironments(): void {
  // No-op: environments are now loaded from SQLite
  console.log('[Environments] loadEnvironments() is deprecated, using SQLite');
}
