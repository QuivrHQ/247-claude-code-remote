import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Redirect the agent DB to a throwaway temp file so the suite never opens
    // or mutates the developer's real ~/.247/data/agent.db. See tests/setup.ts.
    setupFiles: ['./tests/setup.ts'],
    reporter: 'dot',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
