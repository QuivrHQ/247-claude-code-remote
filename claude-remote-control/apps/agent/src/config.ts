import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface AgentConfig {
  agent?: {
    port?: number;
    url?: string;
  };
  projects: {
    basePath: string;
    whitelist: string[];
  };
}

let cachedConfig: AgentConfig | null = null;

const CONFIG_DIR = resolve(process.env.HOME || '~', '.247');
const CONFIG_PATH = resolve(CONFIG_DIR, 'config.json');

/**
 * Load agent configuration from ~/.247/config.json
 */
export function loadConfig(): AgentConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (existsSync(CONFIG_PATH)) {
    try {
      const content = readFileSync(CONFIG_PATH, 'utf-8');
      cachedConfig = JSON.parse(content) as AgentConfig;
      console.log(`Loaded config from: ${CONFIG_PATH}`);
      return cachedConfig;
    } catch (err) {
      console.error(`Failed to load config from ${CONFIG_PATH}:`, err);
    }
  }

  throw new Error(
    `No configuration found at ${CONFIG_PATH}\n` + `Run '247 init' to create configuration.`
  );
}

export const config = loadConfig();
