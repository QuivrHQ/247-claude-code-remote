import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface AgentConfig {
  machine: {
    id: string;
    name: string;
  };
  agent?: {
    port?: number;
    url?: string;
  };
  projects: {
    basePath: string;
    whitelist: string[];
  };
  dashboard?: {
    apiUrl?: string;
    apiKey?: string;
  };
}

let cachedConfig: AgentConfig | null = null;

const CONFIG_DIR = resolve(process.env.HOME || '~', '.247');

/**
 * Get config file path based on profile name
 */
function getConfigPath(profileName?: string): string {
  if (profileName) {
    return resolve(CONFIG_DIR, 'profiles', `${profileName}.json`);
  }
  return resolve(CONFIG_DIR, 'config.json');
}

/**
 * Load agent configuration from ~/.247/
 * Uses AGENT_247_PROFILE env var if set, otherwise default config
 */
export function loadConfig(): AgentConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const profileName = process.env.AGENT_247_PROFILE || undefined;
  const configPath = getConfigPath(profileName);

  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      cachedConfig = JSON.parse(content) as AgentConfig;
      const label = profileName ? `profile '${profileName}'` : 'default';
      console.log(`Loaded ${label} config from: ${configPath}`);
      return cachedConfig;
    } catch (err) {
      console.error(`Failed to load config from ${configPath}:`, err);
    }
  }

  // If profile specified but not found, try default config
  if (profileName) {
    const defaultPath = getConfigPath();
    if (existsSync(defaultPath)) {
      try {
        const content = readFileSync(defaultPath, 'utf-8');
        cachedConfig = JSON.parse(content) as AgentConfig;
        console.log(`Profile '${profileName}' not found, using default: ${defaultPath}`);
        return cachedConfig;
      } catch (err) {
        console.error(`Failed to load config from ${defaultPath}:`, err);
      }
    }
  }

  throw new Error(
    `No configuration found at ${configPath}\n` + `Run '247 init' to create configuration.`
  );
}

export const config = loadConfig();
export default config;
