import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, configExists } from '../lib/config.js';
import { getAgentPaths } from '../lib/paths.js';
import { isAgentRunning, getAgentHealth } from '../lib/process.js';

export const statusCommand = new Command('status')
  .description('Show agent status')
  .action(async () => {
    console.log(chalk.bold('\n247 Agent Status\n'));

    // Configuration
    if (!configExists()) {
      console.log(chalk.red('Not configured. Run: 247 init\n'));
      return;
    }

    const config = loadConfig();
    if (!config) {
      console.log(chalk.red('Failed to load configuration.\n'));
      return;
    }

    const paths = getAgentPaths();

    // Process status
    const processStatus = isAgentRunning();
    const statusIcon = processStatus.running ? chalk.green('●') : chalk.red('●');
    const statusText = processStatus.running ? chalk.green('Running') : chalk.red('Stopped');

    console.log(`${statusIcon} Process: ${statusText}`);
    if (processStatus.pid) {
      console.log(`  PID: ${processStatus.pid}`);
    }

    // Health check if running
    if (processStatus.running) {
      const health = await getAgentHealth(config.agent.port);
      if (health.healthy) {
        console.log(`  Sessions: ${health.sessions}`);
      } else {
        console.log(chalk.yellow(`  Warning: Agent not responding (${health.error})`));
      }
    }

    console.log();

    // Configuration info
    console.log(chalk.dim('Configuration:'));
    console.log(`  Port: ${config.agent.port}`);
    console.log(`  Projects: ${config.projects.basePath}`);
    console.log(`  Config: ${paths.configPath}`);

    console.log();
  });
