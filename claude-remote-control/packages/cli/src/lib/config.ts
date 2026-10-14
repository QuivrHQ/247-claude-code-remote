import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  chmodSync,
} from 'fs';
import { join } from 'path';
import { randomUUID, randomBytes } from 'crypto';
import { getAgentPaths, ensureDirectories } from './paths.js';

export interface AgentConfig {
  machine: {
    id: string;
    name: string;
  };
  agent: {
    port: number;
    /**
     * Shared secret the agent requires. Generated and shown by `247 init`;
     * the user enters it into the dashboard (out of band).
     */
    authToken?: string;
  };
  projects: {
    basePath: string;
    whitelist: string[];
  };
  editor?: {
    enabled: boolean;
    portRange: { start: number; end: number };
    idleTimeout: number;
  };
}

const DEFAULT_CONFIG: AgentConfig = {
  machine: {
    id: '',
    name: '',
  },
  agent: {
    port: 4678,
  },
  projects: {
    basePath: '~/Dev',
    whitelist: [],
  },
  editor: {
    enabled: false,
    portRange: { start: 4680, end: 4699 },
    idleTimeout: 1800000,
  },
};

/**
 * Get the profiles directory path
 */
export function getProfilesDir(): string {
  const paths = getAgentPaths();
  return join(paths.configDir, 'profiles');
}

/**
 * Get the config file path for a specific profile
 * @param profileName - Profile name, or undefined/null/'default' for default config
 */
export function getProfilePath(profileName?: string | null): string {
  const paths = getAgentPaths();

  if (!profileName || profileName === 'default') {
    return paths.configPath;
  }

  return join(getProfilesDir(), `${profileName}.json`);
}

/**
 * List all available profiles
 */
export function listProfiles(): string[] {
  const paths = getAgentPaths();
  const profilesDir = getProfilesDir();

  const profiles: string[] = [];

  // Add default profile if it exists
  if (existsSync(paths.configPath)) {
    profiles.push('default');
  }

  // Add named profiles
  if (existsSync(profilesDir)) {
    const files = readdirSync(profilesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        profiles.push(file.replace('.json', ''));
      }
    }
  }

  return profiles;
}

/**
 * Check if a profile exists
 */
export function profileExists(profileName?: string | null): boolean {
  const configPath = getProfilePath(profileName);
  return existsSync(configPath);
}

/**
 * Delete a profile
 */
export function deleteProfile(profileName: string): boolean {
  if (!profileName || profileName === 'default') {
    throw new Error('Cannot delete default profile');
  }

  const configPath = getProfilePath(profileName);
  if (!existsSync(configPath)) {
    return false;
  }

  unlinkSync(configPath);
  return true;
}

/**
 * Load configuration from ~/.247/config.json or a profile
 * @param profileName - Profile name to load, or undefined for default
 */
export function loadConfig(profileName?: string | null): AgentConfig | null {
  const configPath = getProfilePath(profileName);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as AgentConfig;

    // Apply environment overrides
    if (process.env.AGENT_247_PORT) {
      config.agent.port = parseInt(process.env.AGENT_247_PORT, 10);
    }
    if (process.env.AGENT_247_PROJECTS) {
      config.projects.basePath = process.env.AGENT_247_PROJECTS;
    }

    return config;
  } catch (err) {
    console.error(`Failed to load config: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Save configuration to ~/.247/config.json or a profile
 * @param config - Configuration to save
 * @param profileName - Profile name to save to, or undefined for default
 */
export function saveConfig(config: AgentConfig, profileName?: string | null): void {
  const configPath = getProfilePath(profileName);
  ensureDirectories();

  // Ensure profiles directory exists for named profiles
  if (profileName && profileName !== 'default') {
    const profilesDir = getProfilesDir();
    if (!existsSync(profilesDir)) {
      mkdirSync(profilesDir, { recursive: true });
    }
  }

  // The config holds the agent's bearer token, so keep it readable only by the
  // owner (the writeFileSync mode applies only on create; chmod covers an
  // existing file written under a more permissive umask).
  const content = JSON.stringify(config, null, 2);
  writeFileSync(configPath, content, { encoding: 'utf-8', mode: 0o600 });
  chmodSync(configPath, 0o600);
}

/**
 * Generate the agent's auth token: 32 random bytes as hex. Hex is safe to carry
 * in a WebSocket subprotocol, which is how the dashboard sends it to the agent.
 */
export function generateAuthToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create a new configuration with defaults
 */
export function createConfig(options: {
  machineName: string;
  port?: number;
  projectsPath?: string;
}): AgentConfig {
  return {
    ...DEFAULT_CONFIG,
    machine: {
      id: randomUUID(),
      name: options.machineName,
    },
    agent: {
      port: options.port ?? DEFAULT_CONFIG.agent.port,
      authToken: generateAuthToken(),
    },
    projects: {
      basePath: options.projectsPath ?? DEFAULT_CONFIG.projects.basePath,
      whitelist: [],
    },
  };
}

/**
 * Check if configuration exists
 * @param profileName - Profile name to check, or undefined for default
 */
export function configExists(profileName?: string | null): boolean {
  const configPath = getProfilePath(profileName);
  return existsSync(configPath);
}
