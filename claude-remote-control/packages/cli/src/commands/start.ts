import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { loadConfig, configExists } from '../lib/config.js';
import { getAgentPaths } from '../lib/paths.js';
import { startAgentDaemon, isAgentRunning } from '../lib/process.js';
import { isAbiVersionChanged, ensureNativeModules } from '../lib/prerequisites.js';

export const startCommand = new Command('start')
  .description('Start the 247 agent')
  .option('-f, --foreground', 'Run in foreground (not as daemon)')
  .action(async (options) => {
    // Check configuration
    if (!configExists()) {
      console.log(chalk.red('Configuration not found. Run: 247 init\n'));
      process.exit(1);
    }

    const config = loadConfig();
    if (!config) {
      console.log(chalk.red('Failed to load configuration.\n'));
      process.exit(1);
    }

    // Check native module compatibility (auto-rebuild if Node version changed)
    if (isAbiVersionChanged()) {
      const rebuildSpinner = ora('Node version changed, rebuilding native modules...').start();
      const nativeCheck = await ensureNativeModules();
      if (nativeCheck.status === 'ok') {
        rebuildSpinner.succeed('Native modules rebuilt successfully');
      } else {
        rebuildSpinner.fail(nativeCheck.message);
        process.exit(1);
      }
    } else {
      const nativeCheck = await ensureNativeModules();
      if (nativeCheck.status === 'error') {
        console.log(chalk.red(`${nativeCheck.message}\n`));
        process.exit(1);
      }
    }

    // Check if already running
    const status = isAgentRunning();
    if (status.running) {
      console.log(chalk.yellow(`Agent is already running (PID: ${status.pid})\n`));
      console.log('Use "247 stop" to stop first.\n');
      return;
    }

    if (options.foreground) {
      // Run in foreground
      console.log(
        chalk.blue(`Starting agent in foreground on port ${config.agent.port}...\n`)
      );

      const paths = getAgentPaths();
      const entryPoint = paths.isDev
        ? join(paths.agentRoot, 'src', 'index.ts')
        : join(paths.agentRoot, 'dist', 'index.js');

      if (!existsSync(entryPoint) && !existsSync(entryPoint.replace('.ts', '.js'))) {
        console.log(chalk.red(`Agent entry point not found: ${entryPoint}\n`));
        process.exit(1);
      }

      let command: string;
      let args: string[];

      if (paths.isDev) {
        command = 'npx';
        args = ['tsx', entryPoint];
      } else {
        command = paths.nodePath;
        args = [entryPoint];
      }

      const child = spawn(command, args, {
        cwd: paths.agentRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          AGENT_247_CONFIG: paths.configPath,
          AGENT_247_DATA: paths.dataDir,
        },
      });

      child.on('error', (err) => {
        console.error(chalk.red(`Failed to start: ${err.message}`));
        process.exit(1);
      });

      child.on('exit', (code) => {
        process.exit(code ?? 0);
      });

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        child.kill('SIGTERM');
      });
    } else {
      // Run as daemon
      const spinner = ora('Starting agent...').start();

      const result = await startAgentDaemon();

      if (result.success) {
        spinner.succeed(`Agent started (PID: ${result.pid})`);

        const paths = getAgentPaths();
        console.log(chalk.dim(`  Logs: ${join(paths.logDir, 'agent.log')}`));
        console.log();
        console.log(`Agent running on ${chalk.cyan(`http://localhost:${config.agent.port}`)}`);
        console.log();
      } else {
        spinner.fail(`Failed to start: ${result.error}`);
        process.exit(1);
      }
    }
  });
