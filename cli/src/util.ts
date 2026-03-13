import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import os from 'os';

const CONFIG_DIR = join(os.homedir(), '.nebula');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export async function nebulaFetch(url: string, init?: RequestInit): Promise<Response> {
    if (url.startsWith('https://')) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    return fetch(url, init);
}

function loadConfig(): Record<string, string> {
    try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { return {}; }
}

function saveConfig(config: Record<string, string>) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

function isNebulaRoot(dir: string): boolean {
    return existsSync(join(dir, 'docker-compose.yml')) && existsSync(join(dir, 'server'));
}

export function findProjectRoot(): string {
    let dir = process.cwd();
    for (let i = 0; i < 10; i++) {
        if (isNebulaRoot(dir)) {
            saveConfig({ ...loadConfig(), projectRoot: dir });
            return dir;
        }
        const parent = resolve(dir, '..');
        if (parent === dir) break;
        dir = parent;
    }

    const config = loadConfig();
    if (config.projectRoot && isNebulaRoot(config.projectRoot)) {
        return config.projectRoot;
    }

    const home = os.homedir();
    const candidates = [
        join(home, 'Projects', 'nebula'),
        join(home, 'projects', 'nebula'),
        join(home, 'nebula'),
    ];
    for (const c of candidates) {
        if (isNebulaRoot(c)) {
            saveConfig({ ...loadConfig(), projectRoot: c });
            return c;
        }
    }

    return process.cwd();
}

export function findComposeFile(): string {
    const root = findProjectRoot();
    const path = join(root, 'docker-compose.yml');
    if (!existsSync(path)) {
        throw new Error('docker-compose.yml not found. Run this from the nebula project directory or run once from the project root to save the location.');
    }
    return path;
}
