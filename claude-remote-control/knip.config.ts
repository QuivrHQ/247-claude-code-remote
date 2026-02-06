import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: ['tests/**/*.test.ts'],
      project: ['tests/**/*.ts'],
    },
    'apps/agent': {
      entry: ['src/server.ts', 'tests/**/*.test.ts'],
      project: ['src/**/*.ts', 'tests/**/*.ts'],
      // pino-pretty: Used at runtime via dynamic require
      // http-proxy, web-push: Used in routes
      ignoreDependencies: [
        'pino-pretty',
        'http-proxy',
        'execa',
        '@types/http-proxy',
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
      entry: ['tests/**/*.test.ts'],
      project: ['src/**/*.ts', 'tests/**/*.ts'],
      // Agent dependencies bundled into CLI
      ignoreDependencies: [
        'express',
        'ws',
        'cors',
        'http-proxy',
        'pino',
        'pino-pretty',
        'fs-extra',
        '@types/fs-extra',
      ],
    },
  },
  ignore: ['vitest.workspace.ts'],
  ignoreExportsUsedInFile: true,
  // Root-level dev dependencies that are tooling
  ignoreDependencies: ['husky', 'lint-staged', '@vitest/coverage-v8'],
  // Disable vitest plugin at root - each workspace has its own vitest config
  vitest: false,
  // Ignore intentional duplicate exports (aliases like checkNode = checkNodeVersion)
  rules: {
    duplicates: 'off',
  },
};

export default config;
