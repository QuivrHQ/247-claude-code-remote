import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      // scripts/release/index.ts is the `pnpm release` entry; include the
      // release scripts so their real dependency usage (chalk, ora) is seen.
      entry: ['scripts/release/index.ts', 'tests/**/*.test.ts'],
      project: ['scripts/**/*.ts', 'tests/**/*.ts'],
    },
    'apps/agent': {
      // src/index.ts is the process entry (dev: tsx watch src/index.ts,
      // start: node dist/index.js); server.ts is its library surface.
      entry: ['src/index.ts', 'src/server.ts', 'tests/**/*.test.ts'],
      project: ['src/**/*.ts', 'tests/**/*.ts'],
      // pino-pretty: Used at runtime via dynamic require
      // http-proxy, web-push: Used in routes
      ignoreDependencies: [
        'pino-pretty',
        'http-proxy',
        'web-push',
        'execa',
        '@types/http-proxy',
        '@types/web-push',
      ],
    },
    'apps/web': {
      entry: [
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/route.ts',
        'tests/**/*.test.ts',
        'tests/setup.ts',
      ],
      project: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
      next: true,
    },
    'packages/shared': {
      project: ['src/**/*.ts'],
    },
    'packages/cli': {
      // src/index.ts is the CLI entry (package.json bin: 247 -> dist/index.js);
      // it wires up all the command modules.
      entry: ['src/index.ts', 'tests/**/*.test.ts'],
      project: ['src/**/*.ts', 'tests/**/*.ts'],
      // Agent dependencies bundled into CLI
      ignoreDependencies: [
        'express',
        'ws',
        'cors',
        'http-proxy',
        'pino',
        'pino-pretty',
        'web-push',
        'fs-extra',
        '@types/fs-extra',
        '@types/web-push',
      ],
    },
  },
  ignore: ['vitest.workspace.ts'],
  ignoreExportsUsedInFile: true,
  // Root-level dev dependencies that are tooling.
  ignoreDependencies: ['husky', 'lint-staged', '@vitest/coverage-v8'],
  // Disable vitest plugin at root - each workspace has its own vitest config
  vitest: false,
  // Ignore intentional duplicate exports (aliases like checkNode = checkNodeVersion)
  rules: {
    duplicates: 'off',
  },
};

export default config;
