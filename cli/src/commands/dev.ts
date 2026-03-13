import { Command } from 'commander';
import { spawn } from 'child_process';
import { ui, runAction } from '../output.js';
import { findProjectRoot, requireLocal } from '../util.js';

export function registerDevCommand(program: Command) {
    program
        .command('dev')
        .description('Start frontend dev server + backend (local only)')
        .option('-p, --port <port>', 'Frontend dev port', '5173')
        .action(runAction(async (opts) => {
            requireLocal();
            const root = findProjectRoot();

            ui.heading(`Starting ${ui.brand('nebula')} dev mode`);
            ui.info(`frontend: ${ui.cyan(`http://localhost:${opts.port}`)}`);
            ui.info(`server:   ${ui.cyan('http://localhost:4747')}`);
            ui.blank();

            const server = spawn('bun', ['run', 'start'], {
                cwd: `${root}/server`,
                stdio: 'inherit',
            });

            const frontend = spawn('bun', ['run', 'dev', '--port', opts.port], {
                cwd: `${root}/frontend`,
                stdio: 'inherit',
            });

            const cleanup = () => {
                server.kill();
                frontend.kill();
                process.exit(0);
            };

            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
        }));
}
