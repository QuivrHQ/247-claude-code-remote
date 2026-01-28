import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createServiceManager } from '../service/index.js';
import { isAgentRunning, stopAgent } from '../lib/process.js';

const execAsync = promisify(exec);

const PACKAGE_NAME = '247-cli';

export const updateCommand = new Command('update')
  .description('Update 247 to the latest version')
  .option('--check', 'Only check for updates without installing')
  .action(async (options) => {
    console.log(chalk.bold('\n247 Update\n'));

    const checkSpinner = ora('Checking for updates...').start();

    try {
      // Get current version
      const pkg = await import('../../package.json', {
        with: { type: 'json' },
      });
      const currentVersion = pkg.default.version;

      // Check npm for latest version
      let latestVersion: string;
      try {
        const { stdout } = await execAsync(`npm view ${PACKAGE_NAME} version 2>/dev/null`);
        latestVersion = stdout.trim();
      } catch {
        checkSpinner.fail('Failed to check for updates. Are you connected to the internet?');
        process.exit(1);
      }

      if (currentVersion === latestVersion) {
        checkSpinner.succeed(`Already on the latest version (${currentVersion})`);
        return;
      }

      checkSpinner.succeed(`Update available: ${currentVersion} → ${latestVersion}`);

      if (options.check) {
        console.log(chalk.dim('\nRun "247 update" to install the update.\n'));
        return;
      }

      console.log();

      // Check if service is running
      const serviceManager = createServiceManager();
      let serviceWasRunning = false;

      try {
        const serviceStatus = await serviceManager.status();
        serviceWasRunning = serviceStatus.running;
      } catch {
        // Service not installed, check daemon
        const daemonStatus = isAgentRunning();
        serviceWasRunning = daemonStatus.running;
      }

      // Stop agent if running
      if (serviceWasRunning) {
        const stopSpinner = ora('Stopping agent...').start();
        try {
          const serviceStatus = await serviceManager.status();
          if (serviceStatus.installed && serviceStatus.running) {
            await serviceManager.stop();
          } else {
            await stopAgent();
          }
          stopSpinner.succeed('Agent stopped');
        } catch (err) {
          stopSpinner.warn(`Could not stop agent: ${(err as Error).message}`);
        }
      }

      // Update via npm
      const updateSpinner = ora(`Updating to ${latestVersion} via npm...`).start();
      try {
        const { stdout, stderr } = await execAsync(
          `npm install -g ${PACKAGE_NAME}@${latestVersion} 2>&1`,
          { timeout: 120_000 }
        );

        // Verify the installed version matches what we requested
        const { stdout: installedStr } = await execAsync(
          `npm ls -g ${PACKAGE_NAME} --depth=0 --json 2>/dev/null`
        );
        const installed = JSON.parse(installedStr);
        const installedVersion = installed?.dependencies?.[PACKAGE_NAME]?.version;

        if (installedVersion !== latestVersion) {
          updateSpinner.fail(
            `npm installed ${installedVersion || 'unknown'} instead of ${latestVersion}`
          );
          if (stderr || stdout) {
            console.log(chalk.dim('\nnpm output:'));
            console.log(chalk.dim(stderr || stdout));
          }
          console.log(
            chalk.dim(`\nTry: npm install -g ${PACKAGE_NAME}@${latestVersion} --force\n`)
          );
          process.exit(1);
        }

        updateSpinner.succeed(`Updated to ${latestVersion}`);
      } catch (err) {
        const execErr = err as Error & { stderr?: string; stdout?: string };
        updateSpinner.fail(`Failed to update: ${execErr.message}`);
        if (execErr.stderr) {
          console.log(chalk.dim('\nnpm error output:'));
          console.log(chalk.dim(execErr.stderr));
        }
        console.log(
          chalk.dim(`\nTry running manually: npm install -g ${PACKAGE_NAME}@${latestVersion}\n`)
        );
        process.exit(1);
      }

      // Restart agent if it was running
      if (serviceWasRunning) {
        const startSpinner = ora('Restarting agent...').start();
        try {
          const serviceStatus = await serviceManager.status();
          if (serviceStatus.installed) {
            await serviceManager.start();
          } else {
            // Will use the daemon mode - but after update the binary changed
            // so we should tell user to restart manually
            startSpinner.info('Please restart the agent manually: 247 start');
          }
          startSpinner.succeed('Agent restarted');
        } catch (err) {
          startSpinner.warn(`Could not restart agent: ${(err as Error).message}`);
          console.log(chalk.dim('Run "247 start" to start the agent manually.'));
        }
      }

      console.log();
      console.log(chalk.green('✓ Update complete!'));
      console.log();
    } catch (err) {
      checkSpinner.fail(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });
