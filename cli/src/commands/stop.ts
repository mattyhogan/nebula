import { Command } from 'commander';
import { execSync } from 'child_process';
import { ui, runAction } from '../output.js';
import { findComposeFile } from '../util.js';

export function registerStopCommand(program: Command) {
    program
        .command('stop')
        .description('Stop nebula services')
        .action(runAction(async () => {
            const compose = findComposeFile();
            ui.heading(`Stopping ${ui.brand('nebula')}...`);
            execSync(`docker compose -f ${compose} down`, { stdio: 'inherit' });
            ui.blank();
            ui.success('nebula stopped');
        }));
}
