import { Lux } from '@luxdb/sdk';
import { Flux } from '@luxdb/flux';
import { LuxBufSubscriber } from './lux-subscriber.js';
import { handleFavorites } from './routes/favorites.js';
import { handleIngest, writeMetricsToLux } from './routes/gateway.js';
import { handleMetricsLatest, handleMetricsStream, initMetricsSSE } from './routes/metrics.js';
import { handleDocs } from './routes/docs.js';
import { handleStatic } from './routes/static.js';
import { handleNews } from './routes/news.js';
import { handleWeather } from './routes/weather.js';
import { handleNetwork } from './routes/network.js';
import { startHistoryWriter, handleMetricsHistory, handleMetricsHistoryList } from './history.js';
import { startCollector } from './collector.js';
import { handleActivityHeatmap, incrementActivity } from './routes/activity.js';
import { handlePhotos } from './routes/photos.js';
import { handleChangelog } from './routes/changelog.js';
import { terminalWebSocket } from './routes/terminal.js';

const PORT = parseInt(process.env.PORT || '4747');
const LUX_HOST = process.env.LUX_HOST || '127.0.0.1';
const LUX_PORT = parseInt(process.env.LUX_PORT || '6379');
const MINI_HOST = process.env.MINI_HOST || '';
const BASE_PATH = process.env.NEBULA_BASE_PATH || '';
const KIOSK_API = process.env.KIOSK_API || '';

const MINI_PROXIES: Record<string, number> = {
    '/gcal': 4860,
    '/spotify': 4870,
    '/nero': 4848,
};

async function proxyToMini(req: Request, path: string): Promise<Response | null> {
    for (const [prefix, port] of Object.entries(MINI_PROXIES)) {
        if (!path.startsWith(prefix)) continue;
        let target = path.slice(prefix.length) || '/';
        if (prefix === '/nero') target = '/api' + target;
        const url = `http://${MINI_HOST}:${port}${target}`;
        try {
            const proxyRes = await fetch(url, {
                method: req.method,
                headers: req.headers,
                body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            });
            return new Response(proxyRes.body, {
                status: proxyRes.status,
                headers: proxyRes.headers,
            });
        } catch {
            return Response.json({ error: `proxy to mini failed (${prefix})` }, { status: 502 });
        }
    }
    return null;
}
const LUX_URL = `lux://${LUX_HOST}:${LUX_PORT}`;

const features = {
    weather: !!(process.env.WEATHER_LOCATION && process.env.OPENWEATHER_KEY),
    kiosk: !!KIOSK_API,
    spotify: !!MINI_HOST,
    nero: !!MINI_HOST,
    changelog: !!process.env.GITHUB_TOKEN,
    calendar: !!MINI_HOST,
    photos: !!process.env.PHOTOS_DIR,
};

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function corsify(res: Response): Response {
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
        res.headers.set(k, v);
    }
    return res;
}

const luxOpts = { host: LUX_HOST, port: LUX_PORT };

const luxWrite = new Lux(luxOpts);
await luxWrite.connect();

const luxRead = new Lux(luxOpts);
await luxRead.connect();

const luxSSE = new Lux(luxOpts);
await luxSSE.connect();

console.log(`connected to lux at ${LUX_HOST}:${LUX_PORT}`);

const sub = luxSSE.createSubscriber();
await sub.connect();
initMetricsSSE(luxSSE, sub);
startHistoryWriter(luxRead, luxWrite);

const flux = new Flux({ url: LUX_URL, name: 'nebula-server' });
await flux.start();
await flux.join('metrics');

const fluxSub = new LuxBufSubscriber({ host: LUX_HOST, port: LUX_PORT });
await fluxSub.connect();

const fluxPeerId = (flux as any).id;
fluxSub.subscribe('flux:ws:metrics:events', async (_ch: string, msg: string) => {
    try {
        const event = JSON.parse(msg);
        if (event.peerId === fluxPeerId) return;
        if (event.type !== 'ctx:updated' || !event.key?.startsWith('svc:')) return;
        const payload = event.data;
        if (!payload?.service?.id || !payload?.cards) return;
        await writeMetricsToLux(luxWrite, payload);
        await incrementActivity(luxWrite);
    } catch (err) {
        console.error('flux bridge error:', (err as Error).message);
    }
});

console.log('flux: listening for remote collectors via buffer subscriber');

const isLinux = process.platform === 'linux';
if (process.env.ENABLE_LOCAL_COLLECTOR === 'true' && isLinux) {
    startCollector(flux);
}

const server = Bun.serve({
    port: PORT,
    async fetch(req, server) {
        const url = new URL(req.url);
        const path = url.pathname.replace(/\/$/, '') || '/';

        if (path === '/terminal') {
            const upgraded = server.upgrade(req);
            if (upgraded) return undefined as any;
            return new Response('WebSocket upgrade failed', { status: 400 });
        }

        if (req.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        if (req.method === 'GET' && path === '/config') {
            return corsify(Response.json({ features }));
        }

        const favRes = await handleFavorites(req, path, luxRead, luxWrite);
        if (favRes) return corsify(favRes);

        if (req.method === 'POST' && path === '/ingest') {
            incrementActivity(luxWrite).catch(() => {});
            return corsify(await handleIngest(req, luxWrite));
        }

        if (req.method === 'GET' && path === '/metrics/stream') {
            return handleMetricsStream();
        }

        if (req.method === 'GET' && path === '/metrics/latest') {
            return corsify(await handleMetricsLatest(luxRead));
        }

        if (req.method === 'GET' && path === '/metrics/history/list') {
            return corsify(await handleMetricsHistoryList(luxRead));
        }

        if (req.method === 'GET' && path === '/metrics/history') {
            return corsify(await handleMetricsHistory(req, luxRead));
        }

        if (req.method === 'GET' && path === '/activity/heatmap') {
            return corsify(await handleActivityHeatmap(luxRead));
        }

        const photosRes = handlePhotos(req, path);
        if (photosRes) return corsify(photosRes);

        const newsRes = await handleNews(req, path);
        if (newsRes) return corsify(newsRes);

        const weatherRes = await handleWeather(req, path);
        if (weatherRes) return corsify(weatherRes);

        const changelogRes = await handleChangelog(req, path, luxRead);
        if (changelogRes) return corsify(changelogRes);

        const networkRes = await handleNetwork(req, path);
        if (networkRes) return corsify(networkRes);

        if (KIOSK_API && ['/status', '/start', '/stop', '/restart', '/terminal', '/zoom', '/favorites'].some(p => path === p || path.startsWith(p + '/'))) {
            try {
                const target = `${KIOSK_API}${path}`;
                const proxyRes = await fetch(target, {
                    method: req.method,
                    headers: req.headers,
                    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
                });
                return corsify(new Response(proxyRes.body, { status: proxyRes.status, headers: proxyRes.headers }));
            } catch {
                return corsify(Response.json({ error: 'kiosk api unreachable' }, { status: 502 }));
            }
        }

        if (MINI_HOST) {
            const proxyRes = await proxyToMini(req, path);
            if (proxyRes) return corsify(proxyRes);
        }

        if (req.method === 'GET' && path.startsWith('/lofi/')) {
            const staticPath = BASE_PATH ? BASE_PATH + path : path;
            const res = handleStatic(staticPath);
            if (res) return corsify(res);
        }

        if (req.method === 'GET' && path === '/docs/raw') {
            return corsify(handleDocs());
        }

        if (req.method === 'GET') {
            const staticPath = BASE_PATH ? path : path;
            const res = handleStatic(staticPath);
            if (res) return res;
        }

        return corsify(Response.json({ error: 'not found' }, { status: 404 }));
    },
    websocket: terminalWebSocket,
});

console.log(`nebula server running on port ${PORT}`);
