import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { checkNode, checkTmux, checkNativeDeps } from '../lib/prerequisites.js';
import { configExists, loadConfig } from '../lib/config.js';
import { isAgentRunning, getAgentHealth } from '../lib/process.js';
import { createServiceManager } from '../service/index.js';
import { getAgentPaths } from '../lib/paths.js';
import { getHooksStatus } from '../lib/hooks.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  hint?: string;
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose issues with your 247 installation')
  .action(async () => {
    console.log(chalk.bold('\n247 Doctor\n'));
    console.log(chalk.dim('Running diagnostics...\n'));

    const results: CheckResult[] = [];

    // 1. Check Node.js
    const nodeCheck = checkNode();
    results.push({
      name: 'Node.js',
      status: nodeCheck.status === 'ok' ? 'pass' : nodeCheck.status === 'warn' ? 'warn' : 'fail',
      message: nodeCheck.message,
      hint: nodeCheck.status === 'error' ? 'Install Node.js 22 or later' : undefined,
    });

    // 2. Check tmux
    const tmuxCheck = checkTmux();
    results.push({
      name: 'tmux',
      status: tmuxCheck.status === 'ok' ? 'pass' : tmuxCheck.status === 'warn' ? 'warn' : 'fail',
      message: tmuxCheck.message,
      hint:
        tmuxCheck.status === 'error'
          ? process.platform === 'darwin'
            ? 'Install with: brew install tmux'
            : 'Install with: sudo apt install tmux'
          : undefined,
    });

    // 3. Check native dependencies
    const nativeCheck = await checkNativeDeps();
    results.push({
      name: 'Native modules',
      status:
        nativeCheck.status === 'ok' ? 'pass' : nativeCheck.status === 'warn' ? 'warn' : 'fail',
      message: nativeCheck.message,
      hint: nativeCheck.status === 'error' ? 'Try reinstalling: npm install -g 247-cli' : undefined,
    });

    // 4. Check configuration
    if (configExists()) {
      const config = loadConfig();
      if (config) {
        results.push({
          name: 'Configuration',
          status: 'pass',
          message: `Configured for "${config.machine.name}"`,
        });
      } else {
        results.push({
          name: 'Configuration',
          status: 'fail',
          message: 'Config file exists but is invalid',
          hint: 'Run "247 init" to reconfigure',
        });
      }
    } else {
      results.push({
        name: 'Configuration',
        status: 'fail',
        message: 'Not configured',
        hint: 'Run "247 init" to configure',
      });
    }

    // 5. Check agent process
    const processStatus = isAgentRunning();
    if (processStatus.running) {
      results.push({
        name: 'Agent process',
        status: 'pass',
        message: `Running (PID: ${processStatus.pid})`,
      });

      // 6. Check agent health (only if running)
      const config = loadConfig();
      if (config) {
        const health = await getAgentHealth(config.agent.port);
        if (health.healthy) {
          results.push({
            name: 'Agent health',
            status: 'pass',
            message: `Healthy (${health.sessions} sessions)`,
          });
        } else {
          results.push({
            name: 'Agent health',
            status: 'warn',
            message: `Not responding: ${health.error}`,
            hint: 'Try restarting: 247 restart',
          });
        }
      }
    } else {
      results.push({
        name: 'Agent process',
        status: 'warn',
        message: 'Not running',
        hint: 'Start with: 247 start',
      });
    }

    // 7. Check service installation
    try {
      const serviceManager = createServiceManager();
      const serviceStatus = await serviceManager.status();

      if (serviceStatus.installed) {
        if (serviceStatus.running) {
          results.push({
            name: `Service (${serviceManager.platform})`,
            status: 'pass',
            message: `Installed and running${serviceStatus.enabled ? ', enabled at boot' : ''}`,
          });
        } else {
          results.push({
            name: `Service (${serviceManager.platform})`,
            status: 'warn',
            message: 'Installed but not running',
            hint: 'Start with: 247 service start',
          });
        }
      } else {
        results.push({
          name: `Service (${serviceManager.platform})`,
          status: 'warn',
          message: 'Not installed',
          hint: 'Install with: 247 service install --start',
        });
      }
    } catch (err) {
      results.push({
        name: 'Service',
        status: 'fail',
        message: (err as Error).message,
      });
    }

    // 8. Check paths and directories
    const paths = getAgentPaths();

    // Config directory
    if (existsSync(paths.configDir)) {
      results.push({
        name: 'Config directory',
        status: 'pass',
        message: paths.configDir,
      });
    } else {
      results.push({
        name: 'Config directory',
        status: 'warn',
        message: `Missing: ${paths.configDir}`,
        hint: 'Run "247 init" to create',
      });
    }

    // Log directory
    if (existsSync(paths.logDir)) {
      results.push({
        name: 'Log directory',
        status: 'pass',
        message: paths.logDir,
      });
    } else {
      results.push({
        name: 'Log directory',
        status: 'warn',
        message: `Missing: ${paths.logDir}`,
        hint: 'Will be created when agent starts',
      });
    }

    // 9. Check port availability (if agent not running)
    if (!processStatus.running) {
      const config = loadConfig();
      if (config) {
        const net = await import('net');
        const portAvailable = await new Promise<boolean>((resolve) => {
          const server = net.createServer();
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close();
            resolve(true);
          });
          server.listen(config.agent.port, '127.0.0.1');
        });

        if (portAvailable) {
          results.push({
            name: 'Port availability',
            status: 'pass',
            message: `Port ${config.agent.port} is available`,
          });
        } else {
          results.push({
            name: 'Port availability',
            status: 'fail',
            message: `Port ${config.agent.port} is in use`,
            hint: 'Change the port in ~/.247/config.json or stop the conflicting process',
          });
        }
      }
    }

    // 10. Check hooks status
    const hooksStatus = getHooksStatus();
    if (hooksStatus.installed) {
      if (hooksStatus.needsUpdate) {
        results.push({
          name: 'Notification hooks',
          status: 'warn',
          message: `Installed (v${hooksStatus.version}) - update available`,
          hint: 'Run "247 hooks install" to update',
        });
      } else {
        results.push({
          name: 'Notification hooks',
          status: 'pass',
          message: `Installed (v${hooksStatus.version})`,
        });
      }
    } else {
      results.push({
        name: 'Notification hooks',
        status: 'warn',
        message: 'Not installed',
        hint: 'Run "247 hooks install" for attention notifications',
      });
    }

    // Print results
    console.log(chalk.bold('Results:\n'));

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const result of results) {
      let icon: string;
      let color: (text: string) => string;

      switch (result.status) {
        case 'pass':
          icon = '✓';
          color = chalk.green;
          passCount++;
          break;
        case 'warn':
          icon = '!';
          color = chalk.yellow;
          warnCount++;
          break;
        case 'fail':
          icon = '✗';
          color = chalk.red;
          failCount++;
          break;
      }

      console.log(`${color(icon)} ${result.name}: ${result.message}`);
      if (result.hint) {
        console.log(chalk.dim(`  → ${result.hint}`));
      }
    }

    // Summary
    console.log();
    console.log(chalk.bold('Summary:'));
    console.log(
      `  ${chalk.green(passCount + ' passed')}, ${chalk.yellow(warnCount + ' warnings')}, ${chalk.red(failCount + ' failures')}`
    );

    if (failCount > 0) {
      console.log();
      console.log(chalk.red('Some checks failed. Please resolve the issues above.'));
      process.exit(1);
    } else if (warnCount > 0) {
      console.log();
      console.log(
        chalk.yellow('Some warnings detected. Consider resolving them for best experience.')
      );
    } else {
      console.log();
      console.log(chalk.green('All checks passed! 247 is ready to use.'));
    }

    console.log();
  });
