import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  getHooksStatus,
  installHook,
  uninstallHook,
  getCodexNotifyStatus,
  installCodexNotify,
  uninstallCodexNotify,
} from '../lib/hooks.js';

export const hooksCommand = new Command('hooks').description(
  'Manage Claude Code and Codex notification hooks'
);

hooksCommand
  .command('install')
  .description('Install Claude Code and Codex notification hooks')
  .option('-f, --force', 'Force reinstall even if hooks are up to date')
  .action(async (options) => {
    const spinner = ora('Checking hooks status...').start();

    try {
      const status = getHooksStatus();

      // Check if already installed and up to date
      if (status.installed && !status.needsUpdate && !options.force) {
        spinner.succeed('Hooks already installed and up to date');
        console.log(chalk.dim(`  Version: ${status.version}`));
        console.log(chalk.dim(`  Path: ${status.path}`));
        console.log(chalk.dim('\nUse --force to reinstall.\n'));
        return;
      }

      // Check if update needed
      if (status.installed && status.needsUpdate) {
        spinner.text = `Updating hooks (${status.version} -> ${status.packagedVersion})...`;
      } else {
        spinner.text = 'Installing hooks...';
      }

      const result = installHook();

      if (result.success) {
        if (status.installed && status.needsUpdate) {
          spinner.succeed(`Hooks updated to v${result.installedVersion}`);
        } else {
          spinner.succeed(`Hooks installed (v${result.installedVersion})`);
        }
        console.log(chalk.dim(`  Path: ${status.path}`));
        console.log(chalk.dim('  Settings: ~/.claude/settings.json\n'));
        console.log(chalk.green('Claude Code will now notify 247 when it needs attention.'));
        console.log(chalk.dim('Make sure the 247 agent is running: 247 start\n'));

        const codexResult = installCodexNotify({ force: options.force });
        if (codexResult.status === 'installed' || codexResult.status === 'updated') {
          console.log(chalk.green('Codex will now notify 247 when it needs attention.'));
          console.log(chalk.dim('  Settings: ~/.codex/config.toml\n'));
        } else if (codexResult.status === 'conflict') {
          console.log(
            chalk.yellow(
              'Codex notify already configured. Update ~/.codex/config.toml to use notify-247.sh.'
            )
          );
          console.log(chalk.dim('  Expected: notify = ["bash", "~/.247/hooks/notify-247.sh"]\n'));
        } else if (codexResult.status === 'missing-config') {
          console.log(
            chalk.dim(
              'Codex config not found (skipped). If you use Codex, add notify to ~/.codex/config.toml.'
            )
          );
          console.log(chalk.dim('  notify = ["bash", "~/.247/hooks/notify-247.sh"]\n'));
        }
      } else {
        spinner.fail(`Failed to install hooks: ${result.error}`);
        process.exit(1);
      }
    } catch (err) {
      spinner.fail(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

hooksCommand
  .command('uninstall')
  .description('Uninstall Claude Code and Codex notification hooks')
  .option('--keep-script', 'Keep the script file, only remove from settings')
  .action(async (options) => {
    const spinner = ora('Checking hooks status...').start();

    try {
      const status = getHooksStatus();

      if (!status.installed && !status.settingsConfigured) {
        spinner.succeed('No hooks installed - nothing to uninstall');
        return;
      }

      spinner.text = 'Uninstalling hooks...';
      const codexResult = uninstallCodexNotify();
      const result = uninstallHook(!options.keepScript);

      if (result.success) {
        spinner.succeed('Hooks uninstalled');
        if (!options.keepScript) {
          console.log(chalk.dim(`  Removed: ${status.path}`));
        }
        console.log(chalk.dim('  Cleaned: ~/.claude/settings.json\n'));

        if (codexResult.status === 'removed') {
          console.log(chalk.dim('  Cleaned: ~/.codex/config.toml\n'));
        } else if (codexResult.status === 'conflict') {
          console.log(
            chalk.yellow('Codex notify entry not managed by 247. No changes made to config.')
          );
        }
      } else {
        spinner.fail(`Failed to uninstall hooks: ${result.error}`);
        process.exit(1);
      }
    } catch (err) {
      spinner.fail(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

hooksCommand
  .command('status')
  .description('Show hooks installation status')
  .action(async () => {
    console.log(chalk.bold('\n247 Hooks Status\n'));

    const status = getHooksStatus();

    if (status.installed) {
      console.log(chalk.green('✓ Hooks installed'));
      console.log(chalk.dim(`  Version: ${status.version || 'unknown'}`));
      console.log(chalk.dim(`  Path: ${status.path}`));

      if (status.needsUpdate) {
        console.log();
        console.log(
          chalk.yellow(`⚠ Update available: ${status.version} -> ${status.packagedVersion}`)
        );
        console.log(chalk.dim('  Run: 247 hooks install'));
      } else {
        console.log(chalk.green('✓ Up to date'));
      }
    } else {
      console.log(chalk.yellow('✗ Hooks not installed'));

      if (status.settingsConfigured) {
        console.log(chalk.dim('  Settings configured but script missing'));
      }

      console.log();
      console.log('Run: 247 hooks install');
    }

    console.log();

    // Show settings configuration
    console.log(chalk.bold('Claude Code Settings:'));
    if (status.settingsConfigured) {
      console.log(chalk.green('✓ Notification hook registered'));
    } else {
      console.log(chalk.yellow('✗ Notification hook not registered'));
    }

    console.log();

    const codexStatus = getCodexNotifyStatus();
    console.log(chalk.bold('Codex Settings:'));
    if (!codexStatus.configExists) {
      console.log(chalk.dim('Config not found: ~/.codex/config.toml'));
    } else if (codexStatus.notifyConfigured) {
      console.log(chalk.green('✓ Notification hook registered'));
    } else if (codexStatus.notifyLine) {
      console.log(chalk.yellow('✗ Notification hook points elsewhere'));
      console.log(chalk.dim('  Expected: notify = ["bash", "~/.247/hooks/notify-247.sh"]'));
    } else {
      console.log(chalk.yellow('✗ Notification hook not registered'));
    }

    console.log();
  });

hooksCommand
  .command('update')
  .description('Update hooks to the latest version')
  .action(async () => {
    const spinner = ora('Checking for updates...').start();

    try {
      const status = getHooksStatus();

      if (!status.installed) {
        spinner.info('Hooks not installed. Run: 247 hooks install');
        return;
      }

      if (!status.needsUpdate) {
        spinner.succeed(`Hooks already up to date (v${status.version})`);
        return;
      }

      spinner.text = `Updating hooks (${status.version} -> ${status.packagedVersion})...`;

      const result = installHook();

      if (result.success) {
        spinner.succeed(`Hooks updated to v${result.installedVersion}`);
      } else {
        spinner.fail(`Failed to update hooks: ${result.error}`);
        process.exit(1);
      }
    } catch (err) {
      spinner.fail(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });
