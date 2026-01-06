import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import type {
  Environment,
  EnvironmentMetadata,
  EnvironmentProvider,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
} from '@claude-remote/shared';
import { ENVIRONMENT_PRESETS } from '@claude-remote/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store environments.json next to config.json (in apps/agent/)
const ENVIRONMENTS_FILE = join(__dirname, '..', 'environments.json');

// In-memory cache
let environments: Environment[] = [];

// Track which environment each session uses
const sessionEnvironments = new Map<string, string>();

/**
 * Load environments from disk
 */
export function loadEnvironments(): void {
  if (existsSync(ENVIRONMENTS_FILE)) {
    try {
      const data = readFileSync(ENVIRONMENTS_FILE, 'utf-8');
      environments = JSON.parse(data);
      console.log(`[Environments] Loaded ${environments.length} environments from ${ENVIRONMENTS_FILE}`);
    } catch (err) {
      console.error('[Environments] Failed to load:', err);
      environments = [];
    }
  } else {
    // Initialize with default Anthropic environment
    console.log('[Environments] No environments.json found, creating default Anthropic environment');
    const now = Date.now();
    environments = [
      {
        id: 'default-anthropic',
        name: 'Anthropic (Default)',
        provider: 'anthropic',
        icon: null,
        isDefault: true,
        variables: {
          ANTHROPIC_API_KEY: '',
        },
        createdAt: now,
        updatedAt: now,
      },
    ];
    saveEnvironments();
  }
}

/**
 * Save environments to disk
 */
function saveEnvironments(): void {
  try {
    writeFileSync(ENVIRONMENTS_FILE, JSON.stringify(environments, null, 2));
    console.log(`[Environments] Saved ${environments.length} environments to ${ENVIRONMENTS_FILE}`);
  } catch (err) {
    console.error('[Environments] Failed to save:', err);
  }
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

/**
 * Get all environments (full data, agent-side only)
 */
export function getAllEnvironments(): Environment[] {
  return environments;
}

/**
 * Get all environments as safe metadata (for dashboard)
 */
export function getEnvironmentsMetadata(): EnvironmentMetadata[] {
  return environments.map(toMetadata);
}

/**
 * Get single environment by ID (full data)
 */
export function getEnvironment(id: string): Environment | undefined {
  return environments.find((e) => e.id === id);
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
  return environments.find((e) => e.isDefault);
}

/**
 * Create new environment
 */
export function createEnvironment(req: CreateEnvironmentRequest): Environment {
  const now = Date.now();

  // If setting as default, unset other defaults
  if (req.isDefault) {
    environments = environments.map((e) => ({ ...e, isDefault: false }));
  }

  // If this is the first environment, make it default
  const isFirstEnv = environments.length === 0;

  const env: Environment = {
    id: randomUUID(),
    name: req.name,
    provider: req.provider,
    icon: req.icon ?? null,
    isDefault: req.isDefault ?? isFirstEnv,
    variables: req.variables,
    createdAt: now,
    updatedAt: now,
  };

  environments.push(env);
  saveEnvironments();

  console.log(`[Environments] Created environment: ${env.name} (${env.provider})`);
  return env;
}

/**
 * Update environment
 */
export function updateEnvironment(id: string, req: UpdateEnvironmentRequest): Environment | null {
  const index = environments.findIndex((e) => e.id === id);
  if (index === -1) return null;

  // If setting as default, unset other defaults
  if (req.isDefault) {
    environments = environments.map((e) => ({ ...e, isDefault: false }));
  }

  // Merge variables if provided (don't replace entirely, allow partial updates)
  const updatedVariables = req.variables
    ? { ...environments[index].variables, ...req.variables }
    : environments[index].variables;

  environments[index] = {
    ...environments[index],
    ...(req.name !== undefined && { name: req.name }),
    ...(req.provider !== undefined && { provider: req.provider }),
    ...(req.icon !== undefined && { icon: req.icon }),
    ...(req.isDefault !== undefined && { isDefault: req.isDefault }),
    variables: updatedVariables,
    updatedAt: Date.now(),
  };

  saveEnvironments();

  console.log(`[Environments] Updated environment: ${environments[index].name}`);
  return environments[index];
}

/**
 * Delete environment
 */
export function deleteEnvironment(id: string): boolean {
  const index = environments.findIndex((e) => e.id === id);
  if (index === -1) return false;

  const wasDefault = environments[index].isDefault;
  const deletedName = environments[index].name;
  environments.splice(index, 1);

  // If deleted env was default, make first remaining env default
  if (wasDefault && environments.length > 0) {
    environments[0].isDefault = true;
  }

  saveEnvironments();

  console.log(`[Environments] Deleted environment: ${deletedName}`);
  return true;
}

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
  sessionEnvironments.set(sessionName, environmentId);
}

/**
 * Get the environment ID for a session
 */
export function getSessionEnvironment(sessionName: string): string | undefined {
  return sessionEnvironments.get(sessionName);
}

/**
 * Clear session environment tracking (when session is killed)
 */
export function clearSessionEnvironment(sessionName: string): void {
  sessionEnvironments.delete(sessionName);
}

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
