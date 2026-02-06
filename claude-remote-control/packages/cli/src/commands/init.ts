import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import enquirer from 'enquirer';
import { checkAllPrerequisites, allRequiredMet } from '../lib/prerequisites.js';
import { createConfig, saveConfig, configExists, loadConfig } from '../lib/config.js';
import { ensureDirectories, getAgentPaths } from '../lib/paths.js';

export const initCommand = new Command('init')
  .description('Initialize 247 agent configuration')
  .option('-p, --port <port>', 'Agent port', '4678')
  .option('--projects <path>', 'Projects base path', '~/Dev')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    console.log(`
  ╭──────────────────────────────────╮
  │  247 - The Vibe Company          │
  │  Access Claude Code 24/7         │
  ╰──────────────────────────────────╯
`);

    // Check if config already exists
    if (configExists() && !options.force) {
      const existing = loadConfig();
      console.log(chalk.yellow('Configuration already exists:'));
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
    let projectsPath = options.projects;

    if (!options.projects || options.projects === '~/Dev') {
      const response = await (enquirer as any).prompt({
        type: 'input',
        name: 'projectsPath',
        message: 'Projects directory:',
        initial: projectsPath,
      });
      projectsPath = response.projectsPath;
    }

    // Create and save configuration
    const configSpinner = ora('Creating configuration...').start();
    try {
      ensureDirectories();
      const config = createConfig({
        port,
        projectsPath,
      });
      saveConfig(config);
      configSpinner.succeed('Configuration saved');

      const paths = getAgentPaths();
      console.log(chalk.dim(`  → ${paths.configPath}`));
    } catch (err) {
      configSpinner.fail(`Failed to create configuration: ${(err as Error).message}`);
      process.exit(1);
    }

    // Success message
    console.log(chalk.green('\n✓ Setup complete!\n'));

    console.log('Next steps:');
    console.log(chalk.cyan('  247 start                   ') + chalk.dim('# Start the agent'));
    console.log();
  });
