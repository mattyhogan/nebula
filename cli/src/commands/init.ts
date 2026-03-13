import { Command } from 'commander';
import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import chalk from 'chalk';
import { ui, runAction } from '../output.js';
import { loadConfig, saveConfig, nebulaFetch } from '../util.js';

const REPO_URL = 'https://github.com/mattyhogan/nebula.git';

function prompt(question: string): Promise<string> {
    process.stdout.write(chalk.dim('  > ') + question + ' ');
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.resume();
        process.stdin.on('data', (chunk) => {
            data += chunk;
            if (data.includes('\n')) {
                process.stdin.pause();
                process.stdin.removeAllListeners('data');
                resolve(data.trim());
            }
        });
    });
}

export function registerInitCommand(program: Command) {
    program
        .command('init')
        .description('Set up nebula')
        .action(runAction(async () => {
            console.log();
            console.log(`  ${ui.brand('nebula')} setup`);
            console.log(chalk.dim('  ─────────────────────────'));
            console.log();

            const mode = await prompt('Are you (1) connecting to a running instance or (2) setting up locally? [1/2]');

            if (mode === '1' || mode.toLowerCase().startsWith('c')) {
                await setupRemote();
            } else {
                await setupLocal();
            }
        }));
}

async function setupRemote() {
    const url = await prompt('Server URL (e.g. https://homelab.lan or http://192.168.1.10:4747):');

    if (!url) {
        ui.error('no URL provided');
        return;
    }

    const serverUrl = url.replace(/\/+$/, '');

    ui.info('checking connection...');
    try {
        const res = await nebulaFetch(`${serverUrl}/config`);
        const config = await res.json();
        const featureCount = Object.values(config.features).filter(Boolean).length;
        ui.success(`connected! ${featureCount} features enabled`);
    } catch {
        ui.warn('could not reach server, saving URL anyway');
    }

    saveConfig({ mode: 'remote', serverUrl });
    ui.blank();
    ui.success(`saved server URL: ${ui.cyan(serverUrl)}`);
    ui.info(`run ${ui.cyan('nebula status')} to check your dashboard`);
    ui.blank();
}

async function setupLocal() {
    const config = loadConfig();
    let projectRoot = config.projectRoot;

    if (projectRoot && existsSync(join(projectRoot, 'docker-compose.yml'))) {
        ui.info(`found existing project at ${ui.cyan(projectRoot)}`);
    } else {
        const defaultDir = join(os.homedir(), 'nebula');
        const dir = await prompt(`Where should we clone nebula? [${defaultDir}]`);
        projectRoot = dir || defaultDir;

        if (existsSync(join(projectRoot, 'docker-compose.yml'))) {
            ui.info('project already exists, skipping clone');
        } else {
            ui.info('cloning nebula...');
            execSync(`git clone ${REPO_URL} "${projectRoot}"`, { stdio: 'inherit' });
        }
    }

    const envFile = join(projectRoot, '.env');
    const envExample = join(projectRoot, '.env.example');

    if (!existsSync(envFile) && existsSync(envExample)) {
        copyFileSync(envExample, envFile);
        ui.success('created .env from .env.example');
        ui.info(`edit ${ui.cyan(envFile)} to configure optional features`);
    } else if (existsSync(envFile)) {
        ui.info('.env already exists');
    }

    saveConfig({ mode: 'local', projectRoot, serverUrl: 'http://localhost:4747' });
    ui.blank();
    ui.success('setup complete!');
    ui.blank();
    ui.info(`start nebula:  ${ui.cyan('nebula start')}`);
    ui.info(`dev mode:      ${ui.cyan('nebula dev')}`);
    ui.info(`check status:  ${ui.cyan('nebula status')}`);
    ui.blank();
}
