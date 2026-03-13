import { Command } from 'commander';
import chalk from 'chalk';
import { ui, runAction } from '../output.js';
import { getServerUrl } from '../util.js';

export function registerStatusCommand(program: Command) {
    program
        .command('status')
        .description('Show nebula service status and enabled features')
        .option('-u, --url <url>', 'Server URL')
        .action(runAction(async (opts) => {
            opts.url = opts.url || getServerUrl();
            ui.heading(ui.brand('nebula') + ' status');

            let serverUp = false;
            let config: { features: Record<string, boolean> } = { features: {} };
            let services: any[] = [];

            try {
                const { nebulaFetch } = await import('../util.js');
                const res = await nebulaFetch(`${opts.url}/config`);
                config = await res.json();
                serverUp = true;
            } catch {}

            try {
                const res = await nebulaFetch(`${opts.url}/metrics/latest`);
                services = await res.json();
            } catch {}

            const dot = (on: boolean) => on ? chalk.green('●') : chalk.dim('○');

            console.log(`\n  ${dot(serverUp)} server  ${serverUp ? ui.cyan(opts.url) : ui.dim('unreachable')}`);

            if (serverUp && Object.keys(config.features).length > 0) {
                ui.heading('features');
                const maxLen = Math.max(...Object.keys(config.features).map(k => k.length));
                for (const [key, enabled] of Object.entries(config.features)) {
                    console.log(`  ${dot(enabled)} ${key.padEnd(maxLen)}`);
                }
            }

            if (services.length > 0) {
                ui.heading('services');
                for (const svc of services) {
                    const statusColor = svc.status === 'healthy' ? chalk.green : svc.status === 'degraded' ? chalk.yellow : chalk.red;
                    console.log(`  ${dot(svc.status === 'healthy')} ${svc.name.padEnd(16)} ${statusColor(svc.status)}  ${ui.dim(`${svc.cards?.length ?? 0} cards`)}`);
                }
            }

            ui.blank();
        }));
}
