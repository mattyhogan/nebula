import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import os from 'os';

const CONFIG_DIR = join(os.homedir(), '.nebula');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export const DEFAULT_URL = 'http://localhost:4747';

export interface NebulaConfig {
    mode?: 'local' | 'remote';
    projectRoot?: string;
    serverUrl?: string;
}

export function loadConfig(): NebulaConfig {
    try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { return {}; }
}

export function saveConfig(config: NebulaConfig) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

export function getServerUrl(): string {
    return loadConfig().serverUrl || DEFAULT_URL;
}

export async function nebulaFetch(url: string, init?: RequestInit): Promise<Response> {
    if (url.startsWith('https://')) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    return fetch(url, init);
}

function isNebulaRoot(dir: string): boolean {
    return existsSync(join(dir, 'docker-compose.yml')) && existsSync(join(dir, 'server'));
}

export function findProjectRoot(): string {
    const config = loadConfig();

    if (config.projectRoot && isNebulaRoot(config.projectRoot)) {
        return config.projectRoot;
    }

    let dir = process.cwd();
    for (let i = 0; i < 10; i++) {
        if (isNebulaRoot(dir)) return dir;
        const parent = resolve(dir, '..');
        if (parent === dir) break;
        dir = parent;
    }

    const home = os.homedir();
    const candidates = [
        join(home, 'Projects', 'nebula'),
        join(home, 'projects', 'nebula'),
        join(home, 'nebula'),
    ];
    for (const c of candidates) {
        if (isNebulaRoot(c)) return c;
    }

    return process.cwd();
}

export function requireLocal() {
    const config = loadConfig();
    if (config.mode === 'remote') {
        throw new Error('this command requires a local setup. You are connected to a remote instance. Run `nebula init` again to switch to local mode.');
    }
    if (!config.projectRoot) {
        throw new Error('this command requires a local setup. Run `nebula init` and choose option 2.');
    }
}

export function findComposeFile(): string {
    const root = findProjectRoot();
    const path = join(root, 'docker-compose.yml');
    if (!existsSync(path)) {
        throw new Error('project not found. Run `nebula init` to set up.');
    }
    return path;
}
