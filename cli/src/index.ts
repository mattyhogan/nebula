#!/usr/bin/env bun
import { Command } from 'commander';
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

registerStartCommand(program);
registerStopCommand(program);
registerStatusCommand(program);
registerLogsCommand(program);
registerPushCommand(program);
registerAddPanelCommand(program);
registerDevCommand(program);
registerUpdateCommand(program);

program.parse();
