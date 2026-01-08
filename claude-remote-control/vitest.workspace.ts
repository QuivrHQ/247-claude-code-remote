import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/agent',
  'apps/web',
  'packages/shared',
  {
    test: {
      name: 'duplication',
      root: '.',
      include: ['tests/duplication/**/*.test.ts'],
      globals: true,
      environment: 'node',
    },
  },
]);
