#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './util.js';
import { registerInitCommand } from './commands/init.js';
import { registerStartCommand } from './commands/start.js';
import { registerStopCommand } from './commands/stop.js';
import { registerStatusCommand } from './commands/status.js';
import { registerLogsCommand } from './commands/logs.js';
import { registerPushCommand } from './commands/push.js';
import { registerAddPanelCommand } from './commands/add-panel.js';
import { registerDevCommand } from './commands/dev.js';
import { registerUpdateCommand } from './commands/update.js';

const VERSION = process.env.NEBULA_VERSION || '0.1.0';

const program = new Command();

program
    .name('nebula')
    .description('Gesture-controlled homelab dashboard')
    .version(VERSION);

registerInitCommand(program);
registerStartCommand(program);
registerStopCommand(program);
registerStatusCommand(program);
registerLogsCommand(program);
registerPushCommand(program);
registerAddPanelCommand(program);
registerDevCommand(program);
registerUpdateCommand(program);

const config = loadConfig();
if (process.argv.length <= 2 && !config.serverUrl && !config.projectRoot) {
    console.log();
    console.log(`  ${chalk.hex('#4dd8ff').bold('nebula')} ${chalk.dim(`v${VERSION}`)}`);
    console.log();
    console.log(`  Get started: ${chalk.hex('#4dd8ff')('nebula init')}`);
    console.log();
    process.exit(0);
}

program.parse();
