export interface Config {
  port: number;
  apiUrl: string;
  dashboardUrl: string;
  databaseUrl: string;
  encryptionKey: string;
  github: {
    clientId: string;
    clientSecret: string;
  };
  betterAuth: {
    secret: string;
  };
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config: Config = {
  port: parseInt(getEnvOrDefault('PORT', '4680'), 10),
  apiUrl: getEnvOrDefault('API_URL', 'http://localhost:4680'),
  dashboardUrl: getEnvOrDefault('DASHBOARD_URL', 'http://localhost:3001'),
  databaseUrl: getEnvOrDefault('DATABASE_URL', 'postgres://localhost:5432/provisioning'),
  encryptionKey: getEnvOrDefault('ENCRYPTION_KEY', 'dev-encryption-key-32chars!!'),
  github: {
    clientId: getEnvOrDefault('GITHUB_CLIENT_ID', ''),
    clientSecret: getEnvOrDefault('GITHUB_CLIENT_SECRET', ''),
  },
  betterAuth: {
    secret: getEnvOrDefault('BETTER_AUTH_SECRET', 'dev-better-auth-secret'),
  },
};
