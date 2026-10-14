import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import enquirer from 'enquirer';
import { hostname } from 'os';
import { checkAllPrerequisites, allRequiredMet } from '../lib/prerequisites.js';
import {
  createConfig,
  saveConfig,
  configExists,
  loadConfig,
  getProfilePath,
} from '../lib/config.js';
import { ensureDirectories } from '../lib/paths.js';

export const initCommand = new Command('init')
  .description('Initialize 247 agent configuration')
  .option('-n, --name <name>', 'Machine name')
  .option('-p, --port <port>', 'Agent port', '4678')
  .option('--projects <path>', 'Projects base path', '~/Dev')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('-P, --profile <name>', 'Create or update a named profile')
  .action(async (options, cmd) => {
    // Get profile from command option or parent (global) option
    const profileName = options.profile || cmd.parent?.opts().profile;
    const profileLabel = profileName ? ` (profile: ${profileName})` : '';

    console.log(`
  ╭──────────────────────────────────╮
  │  247 - The Vibe Company          │
  │  Access Claude Code 24/7         │
  ╰──────────────────────────────────╯
`);

    // Check if config already exists
    if (configExists(profileName) && !options.force) {
      const existing = loadConfig(profileName);
      console.log(chalk.yellow(`Configuration${profileLabel} already exists:`));
      console.log(`  Machine: ${existing?.machine.name}`);
      console.log(`  Port: ${existing?.agent.port}`);
      console.log(`  Projects: ${existing?.projects.basePath}`);
      console.log('\nUse --force to overwrite.\n');
      return;
    }

    // Check prerequisites
    const spinner = ora('Checking prerequisites...').start();
    const port = parseInt(options.port, 10);
    const checks = await checkAllPrerequisites(port);
    spinner.stop();

    console.log(chalk.dim('Prerequisites:'));
    for (const check of checks) {
      const icon =
        check.status === 'ok'
          ? chalk.green('✓')
          : check.status === 'warn'
            ? chalk.yellow('!')
            : chalk.red('✗');
      console.log(`  ${icon} ${check.name}: ${check.message}`);
    }
    console.log();

    if (!allRequiredMet(checks)) {
      console.log(chalk.red('Please fix the errors above before continuing.\n'));
      process.exit(1);
    }

    // Gather configuration
    let machineName = options.name;
    let projectsPath = options.projects;

    if (!machineName) {
      const response = await (enquirer as any).prompt({
        type: 'input',
        name: 'machineName',
        message: 'Machine name:',
        initial: hostname(),
      });
      machineName = response.machineName;
    }

    if (!options.name) {
      const response = await (enquirer as any).prompt({
        type: 'input',
        name: 'projectsPath',
        message: 'Projects directory:',
        initial: projectsPath,
      });
      projectsPath = response.projectsPath;
    }

    // Create and save configuration
    const configSpinner = ora(`Creating configuration${profileLabel}...`).start();
    try {
      ensureDirectories();
      const config = createConfig({
        machineName,
        port,
        projectsPath,
      });
      saveConfig(config, profileName);
      configSpinner.succeed(`Configuration${profileLabel} saved`);

      const configPath = getProfilePath(profileName);
      console.log(chalk.dim(`  → ${configPath}`));

      // Show the auth token so the user can paste it into the dashboard. It is
      // delivered out of band on purpose: the agent never serves it over the
      // network, so it cannot be read by anyone who merely reaches the agent.
      if (config.agent.authToken) {
        console.log(chalk.bold('\n  Agent token (paste this into the dashboard when connecting):'));
        console.log(`  ${chalk.yellow(config.agent.authToken)}`);
        console.log(
          chalk.dim(`  Keep it secret. It is stored in ${configPath} (shown redacted elsewhere).`)
        );
      }
    } catch (err) {
      configSpinner.fail(`Failed to create configuration: ${(err as Error).message}`);
      process.exit(1);
    }

    // Success message
    console.log(chalk.green(`\n✓ Setup${profileLabel} complete!\n`));

    console.log('Next steps:');
    if (profileName) {
      console.log(
        chalk.cyan(`  247 start --profile ${profileName}`) +
          chalk.dim('   # Start the agent with this profile')
      );
      console.log(
        chalk.cyan(`  247 profile show ${profileName}`) +
          chalk.dim('     # View profile configuration')
      );
    } else {
      console.log(chalk.cyan('  247 start                   ') + chalk.dim('# Start the agent'));
      console.log(
        chalk.cyan('  247 service install --start ') + chalk.dim('# Install as system service')
      );
    }
    console.log();
  });
