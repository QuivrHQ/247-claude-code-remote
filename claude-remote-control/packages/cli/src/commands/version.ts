import { Command } from 'commander';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const PACKAGE_NAME = '247-cli';

export const versionCommand = new Command('version')
  .description('Show version and check for updates')
  .action(async () => {
    // Get current version from package.json
    const pkg = await import('../../package.json', {
      with: { type: 'json' },
    });
    const currentVersion = pkg.default.version;

    // Check npm for latest version
    let latestVersion: string | null = null;
    try {
      const { stdout } = await execAsync(`npm view ${PACKAGE_NAME} version 2>/dev/null`);
      latestVersion = stdout.trim();
    } catch {
      // Network error or package not found - silently ignore
    }

    // Display version
    if (latestVersion && currentVersion !== latestVersion) {
      console.log(`247 v${currentVersion}`);
      console.log();
      console.log(chalk.yellow(`Update available: ${currentVersion} → ${latestVersion}`));
      console.log(chalk.dim('Run "npm install -g 247-cli" to update.'));
    } else if (latestVersion) {
      console.log(`247 v${currentVersion} ${chalk.green('(latest)')}`);
    } else {
      console.log(`247 v${currentVersion}`);
      console.log(chalk.dim('Could not check for updates.'));
    }
  });
