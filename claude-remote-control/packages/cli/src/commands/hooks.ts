import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { uninstallHooks, getHooksStatus } from '../hooks/installer.js';

export const hooksCommand = new Command('hooks').description(
  'Manage Claude Code hooks (deprecated - now uses statusLine)'
);

hooksCommand
  .command('install')
  .description('Install Claude Code hooks (deprecated)')
  .action(async () => {
    console.log(chalk.yellow('\n⚠️  The hooks system has been deprecated.\n'));
    console.log("247 now uses Claude Code's statusLine API for status tracking.");
    console.log('The agent automatically configures this when it starts.\n');
    console.log(chalk.dim('No manual installation is required anymore.'));
    console.log(chalk.dim('Just run "247 start" and the agent will handle everything.\n'));

    const status = getHooksStatus();
    if (status.installed) {
      console.log(chalk.yellow('Old hooks detected at: ' + status.path));
      console.log('Run "247 hooks uninstall" to clean up the old hooks.\n');
    }
  });

hooksCommand
  .command('uninstall')
  .description('Uninstall old Claude Code hooks')
  .action(async () => {
    const spinner = ora('Checking for old hooks...').start();

    try {
      const status = getHooksStatus();

      if (!status.installed) {
        spinner.succeed('No old hooks installed - nothing to clean up');
        return;
      }

      spinner.text = 'Removing old hooks...';
      const result = uninstallHooks();

      if (result.success) {
        spinner.succeed('Old hooks removed successfully');
        if (status.settingsHooksFound) {
          console.log(chalk.dim('\nCleaned: ~/.claude/settings.json (removed deprecated hooks)'));
        }
        if (status.path) {
          console.log(chalk.dim(`Cleaned: ${status.path}`));
        }
        console.log(
          chalk.dim('\nThe new statusLine system is automatically configured by the agent.\n')
        );
      } else {
        spinner.fail(`Failed to remove hooks: ${result.error}`);
        process.exit(1);
      }
    } catch (err) {
      spinner.fail(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

hooksCommand
  .command('status')
  .description('Show hooks status')
  .action(async () => {
    console.log(chalk.bold('\n247 Status Tracking\n'));
    console.log(chalk.green('✓ Using new statusLine API'));
    console.log(chalk.dim('  Status tracking is automatically configured when the agent starts.'));
    console.log(chalk.dim('  Claude Code sends heartbeats every ~300ms while working.\n'));

    const status = getHooksStatus();
    if (status.installed) {
      console.log(chalk.yellow('⚠️  Old hooks still installed'));
      if (status.settingsHooksFound) {
        console.log(chalk.dim('  Found in: ~/.claude/settings.json'));
      }
      if (status.path) {
        console.log(chalk.dim(`  Found in: ${status.path}`));
      }
      console.log(chalk.dim('  Run "247 hooks uninstall" to clean up.\n'));
    } else {
      console.log(chalk.green('✓ No old hooks installed\n'));
    }
  });

hooksCommand
  .command('update')
  .description('Update hooks (deprecated)')
  .action(async () => {
    console.log(chalk.yellow('\n⚠️  The hooks system has been deprecated.\n'));
    console.log("247 now uses Claude Code's statusLine API for status tracking.");
    console.log(
      'No manual updates are required - the agent configures everything automatically.\n'
    );
  });
