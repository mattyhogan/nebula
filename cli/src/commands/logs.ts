import { Command } from 'commander';
import { execSync } from 'child_process';
import { ui, runAction } from '../output.js';
import { findComposeFile } from '../util.js';

export function registerLogsCommand(program: Command) {
    program
        .command('logs')
        .description('Tail nebula server logs')
        .option('-n, --lines <n>', 'Number of lines to show', '50')
        .option('-f, --follow', 'Follow log output', false)
        .action(runAction(async (opts) => {
            const compose = findComposeFile();
            const flags = [`-f ${compose}`, 'logs', `--tail ${opts.lines}`];
            if (opts.follow) flags.push('-f');
            flags.push('server');
            execSync(`docker compose ${flags.join(' ')}`, { stdio: 'inherit' });
        }));
}
