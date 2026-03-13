import { existsSync } from 'fs';
import { join, resolve } from 'path';

export async function nebulaFetch(url: string, init?: RequestInit): Promise<Response> {
    if (url.startsWith('https://')) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    return fetch(url, init);
}

export function findProjectRoot(): string {
    let dir = process.cwd();
    for (let i = 0; i < 10; i++) {
        if (existsSync(join(dir, 'docker-compose.yml')) && existsSync(join(dir, 'server'))) {
            return dir;
        }
        const parent = resolve(dir, '..');
        if (parent === dir) break;
        dir = parent;
    }
    return process.cwd();
}

export function findComposeFile(): string {
    const root = findProjectRoot();
    const path = join(root, 'docker-compose.yml');
    if (!existsSync(path)) {
        throw new Error('docker-compose.yml not found. Run this from the nebula project directory.');
    }
    return path;
}
