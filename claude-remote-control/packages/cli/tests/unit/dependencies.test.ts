import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * This test ensures the CLI package includes all runtime dependencies
 * required by the bundled agent code.
 *
 * When the agent is bundled into the CLI (via scripts/bundle.sh), only the
 * compiled JS is copied - not node_modules. Therefore, the CLI's package.json
 * must include all agent runtime dependencies so they get installed when
 * users run `npm install -g 247-cli`.
 */
describe('CLI dependencies', () => {
  it('should include all agent runtime dependencies', () => {
    const cliPkgPath = join(__dirname, '../../package.json');
    const agentPkgPath = join(__dirname, '../../../../apps/agent/package.json');

    const cliPkg = JSON.parse(readFileSync(cliPkgPath, 'utf-8'));
    const agentPkg = JSON.parse(readFileSync(agentPkgPath, 'utf-8'));

    const cliDeps = cliPkg.dependencies || {};
    const agentDeps = agentPkg.dependencies || {};

    // These are workspace packages that are handled separately by the bundle script
    const workspacePackages = ['247-shared'];

    const missingDeps: string[] = [];

    for (const dep of Object.keys(agentDeps)) {
      // Skip workspace packages - they're copied by bundle.sh
      if (workspacePackages.includes(dep)) {
        continue;
      }

      if (!(dep in cliDeps)) {
        missingDeps.push(dep);
      }
    }

    expect(
      missingDeps,
      `CLI package.json is missing agent dependencies: ${missingDeps.join(', ')}. ` +
        `Add these to packages/cli/package.json to fix the bundled agent.`
    ).toEqual([]);
  });
});
