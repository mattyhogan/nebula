import { Command } from 'commander';
import { execSync } from 'child_process';
import { ui, runAction } from '../output.js';
import { findComposeFile } from '../util.js';

export function registerStartCommand(program: Command) {
    program
        .command('start')
        .description('Start nebula services')
        .option('-d, --detach', 'Run in background', true)
        .option('--build', 'Rebuild images before starting')
        .action(runAction(async (opts) => {
            const compose = findComposeFile();
            const flags = ['-f', compose];
            if (opts.build) flags.push('--build');
            if (opts.detach) flags.push('-d');

            ui.heading(`Starting ${ui.brand('nebula')}...`);
            execSync(`docker compose ${flags.join(' ')} up`, { stdio: 'inherit' });
            ui.blank();
            ui.success('nebula is running');
            ui.info(`dashboard: ${ui.cyan('http://localhost:4747')}`);
        }));
}
