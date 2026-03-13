import { join } from 'path';
import { existsSync } from 'fs';

const STATIC_DIR = process.env.STATIC_DIR || './public';
const BASE_PATH = process.env.NEBULA_BASE_PATH || '';

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
};

function serveFile(filePath: string): Response | null {
    const fullPath = join(STATIC_DIR, filePath);
    if (!existsSync(fullPath)) return null;
    try {
        const file = Bun.file(fullPath);
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        return new Response(file, {
            headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' },
        });
    } catch {
        return null;
    }
}

export function handleStatic(path: string): Response | null {
    const subPath = BASE_PATH ? path.replace(BASE_PATH, '') : path;

    if (!subPath || subPath === '/') {
        return serveFile('/index.html');
    }

    const staticFile = serveFile(subPath);
    if (staticFile) return staticFile;

    if (subPath.startsWith('/_app/')) {
        return new Response('Not found', { status: 404 });
    }

    return serveFile('/index.html');
}
