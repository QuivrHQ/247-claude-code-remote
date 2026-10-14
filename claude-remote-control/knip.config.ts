import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      // scripts/** are real entrypoints run via pnpm scripts (e.g. release),
      // and they use root devDependencies such as chalk/ora.
      entry: ['tests/**/*.test.ts', 'scripts/**/*.ts'],
      project: ['tests/**/*.ts'],
    },
    'apps/agent': {
      // src/index.ts is the process entrypoint (`start`/`dev` scripts);
      // src/server.ts is imported by it and by tests.
      entry: ['src/index.ts', 'src/server.ts', 'tests/**/*.test.ts', 'tests/setup.ts'],
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
      // src/index.ts is the CLI bin entrypoint (`bin` -> dist/index.js).
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
