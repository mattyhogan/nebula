import { readFileSync, existsSync } from 'fs';

const DOCS_PATH = process.env.DOCS_PATH || './DOCS.md';

export function handleDocs(): Response {
    if (!existsSync(DOCS_PATH)) {
        return new Response('No documentation found.', {
            status: 404,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
    const md = readFileSync(DOCS_PATH, 'utf-8');
    return new Response(md, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
}
