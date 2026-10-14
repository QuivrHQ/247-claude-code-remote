import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Read version from package.json at build time
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const APP_VERSION = pkg.version;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  env: {
    // Inject version at build time for auto-update system
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    // Local mode (no Neon Auth): /api/auth/* responds 500 without NEON_AUTH_BASE_URL,
    // so tell the client up front to skip those requests. See src/lib/auth-config.ts.
    NEXT_PUBLIC_AUTH_ENABLED: process.env.NEON_AUTH_BASE_URL ? 'true' : 'false',
  },
};

export default nextConfig;
