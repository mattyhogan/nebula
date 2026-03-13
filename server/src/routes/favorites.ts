import type { Lux } from '@luxdb/sdk';

const KEY = 'favorites';

type Favorite = { id: string; name: string; type: 'url' | 'command'; value: string };

async function load(lux: Lux): Promise<Favorite[]> {
    const raw = await lux.get(KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

async function save(lux: Lux, favs: Favorite[]) {
    await lux.set(KEY, JSON.stringify(favs));
}

export async function handleFavorites(req: Request, path: string, luxRead: Lux, luxWrite: Lux): Promise<Response | null> {
    if (req.method === 'GET' && path === '/favorites') {
        return Response.json({ favorites: await load(luxRead) });
    }

    if (req.method === 'POST' && path === '/favorites') {
        let body: any = {};
        try { body = await req.json(); } catch {}
        const favs = await load(luxRead);
        favs.push({ id: crypto.randomUUID(), name: body.name, type: body.type, value: body.value });
        await save(luxWrite, favs);
        return Response.json({ ok: true, favorites: favs });
    }

    if (req.method === 'DELETE') {
        const match = path.match(/^\/favorites\/(.+)$/);
        if (match) {
            const favs = (await load(luxRead)).filter(f => f.id !== match[1]);
            await save(luxWrite, favs);
            return Response.json({ ok: true, favorites: favs });
        }
    }

    return null;
}
