import { Command } from 'commander';
import chalk from 'chalk';
import { ui, runAction } from '../output.js';
import { nebulaFetch, getServerUrl } from '../util.js';

export function registerPushCommand(program: Command) {
    program
        .command('push')
        .description('Push test metrics to the dashboard')
        .option('-u, --url <url>', 'Server URL')
        .option('-s, --service <id>', 'Service ID', 'test')
        .option('-n, --name <name>', 'Service display name', 'Test Service')
        .option('--status <status>', 'Service status (healthy, degraded, down)', 'healthy')
        .option('--watch', 'Push continuously every 2s with random data')
        .action(runAction(async (opts) => {
            opts.url = opts.url || getServerUrl();
            const payload = () => ({
                service: {
                    id: opts.service,
                    name: opts.name,
                    icon: 'zap',
                    color: '#a855f7',
                    status: opts.status,
                },
                cards: [
                    {
                        id: 'cpu',
                        title: 'CPU',
                        type: 'metric',
                        size: 'sm',
                        order: 0,
                        data: { value: Math.round(Math.random() * 100), unit: '%' },
                    },
                    {
                        id: 'mem',
                        title: 'Memory',
                        type: 'progress',
                        size: 'sm',
                        order: 1,
                        data: { value: Math.round(Math.random() * 16000), max: 16000, label: 'RAM', unit: 'MB' },
                    },
                    {
                        id: 'latency',
                        title: 'Latency',
                        type: 'metric',
                        size: 'sm',
                        order: 2,
                        data: { value: Math.round(Math.random() * 200), unit: 'ms' },
                    },
                    {
                        id: 'load',
                        title: 'Load History',
                        type: 'timeseries',
                        size: 'sm',
                        order: 3,
                        data: { points: Array.from({ length: 20 }, () => Math.round(Math.random() * 100)), unit: '%', min: 0, max: 100 },
                    },
                ],
            });

            async function send() {
                const data = payload();
                const res = await nebulaFetch(`${opts.url}/ingest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: res.statusText }));
                    throw new Error(`Push failed: ${err.error}`);
                }

                return await res.json();
            }

            if (opts.watch) {
                ui.heading(`Pushing to ${ui.brand('nebula')} every 2s ${ui.dim('(ctrl+c to stop)')}`);
                ui.info(`service: ${ui.cyan(opts.name)} (${opts.service})`);
                ui.info(`target:  ${ui.cyan(opts.url + '/ingest')}`);
                ui.blank();

                const tick = async () => {
                    const result = await send();
                    process.stdout.write(chalk.dim(`  ${new Date().toLocaleTimeString()} `) + chalk.green('pushed') + chalk.dim(` ${result.cards} cards\n`));
                };

                await tick();
                setInterval(tick, 2000);
            } else {
                const result = await send();
                ui.success(`pushed ${result.cards} cards to ${ui.cyan(opts.service)}`);
            }
        }));
}
