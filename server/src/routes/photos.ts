import { join } from 'path';
import { readdirSync, existsSync } from 'fs';

const PHOTOS_DIR = process.env.PHOTOS_DIR || '/data/photos';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp']);

const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
};

function listPhotos(): string[] {
    if (!existsSync(PHOTOS_DIR)) return [];
    try {
        return readdirSync(PHOTOS_DIR).filter((f) => {
            const ext = f.substring(f.lastIndexOf('.')).toLowerCase();
            return IMAGE_EXTENSIONS.has(ext);
        });
    } catch {
        return [];
    }
}

export function handlePhotos(req: Request, path: string): Response | null {
    if (req.method !== 'GET') return null;

    if (path === '/photos') {
        return Response.json(listPhotos());
    }

    if (path.startsWith('/photos/')) {
        const filename = decodeURIComponent(path.slice('/photos/'.length));
        if (filename.includes('..') || filename.includes('/')) {
            return Response.json({ error: 'invalid filename' }, { status: 400 });
        }
        const fullPath = join(PHOTOS_DIR, filename);
        if (!existsSync(fullPath)) {
            return Response.json({ error: 'not found' }, { status: 404 });
        }
        const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        return new Response(Bun.file(fullPath), {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
            },
        });
    }

    return null;
}
