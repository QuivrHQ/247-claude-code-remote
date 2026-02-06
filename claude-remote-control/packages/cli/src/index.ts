#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { versionCommand } from './commands/version.js';

const program = new Command();

program
  .name('247')
  .description('247 - Access Claude Code from anywhere 24/7\nby The Vibe Company')
  .version('2.43.0');

// Add commands
program.addCommand(initCommand);
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(logsCommand);
program.addCommand(versionCommand);

// Export program for use in subcommands (to access global options)
export { program };

// Default action (no command)
program.action(() => {
  console.log(`
  ╭──────────────────────────────────╮
  │  247 - The Vibe Company          │
  │  Access Claude Code 24/7         │
  ╰──────────────────────────────────╯
`);
  program.help();
});

program.parse();
