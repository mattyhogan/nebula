import { Flux } from '@luxdb/flux';

const LUX_URL = process.env.LUX_URL || 'lux://lux:6379';
const INTERVAL = 30000;

const HOSTS: { name: string; host: string; port?: number }[] = process.env.PING_HOSTS
    ? JSON.parse(process.env.PING_HOSTS)
    : [];

interface PingResult {
    name: string;
    host: string;
    latency: number;
    up: boolean;
}

const latencyHistory = new Map<string, number[]>();
const HISTORY_LEN = 30;

async function pingHost(h: { name: string; host: string; port?: number }): Promise<PingResult> {
    const start = performance.now();
    try {
        const port = h.port || 80;
        const socket = await Bun.connect({
            hostname: h.host,
            port,
            socket: {
                data() {},
                open(socket) { socket.end(); },
                error() {},
                close() {},
            },
        });
        const latency = Math.round(performance.now() - start);
        return { name: h.name, host: h.host, latency, up: true };
    } catch {
        return { name: h.name, host: h.host, latency: -1, up: false };
    }
}

const flux = new Flux({ url: LUX_URL, name: 'network-collector' });
await flux.start();
await flux.join('metrics');

console.log(`network collector online, pushing metrics every ${INTERVAL / 1000}s`);

async function tick() {
    const results = await Promise.all(HOSTS.map(pingHost));
    const upCount = results.filter((r) => r.up).length;

    for (const r of results) {
        if (!latencyHistory.has(r.name)) latencyHistory.set(r.name, []);
        const hist = latencyHistory.get(r.name)!;
        hist.push(r.up ? r.latency : 0);
        if (hist.length > HISTORY_LEN) hist.shift();
    }

    const payload = {
        service: {
            id: 'network',
            name: 'Network',
            icon: 'globe',
            color: '#f59e0b',
            status: upCount === HOSTS.length ? 'healthy' : upCount > 0 ? 'degraded' : 'down',
        },
        cards: [
            {
                id: 'hosts-up',
                title: 'Hosts',
                type: 'metric',
                size: 'sm',
                order: 0,
                data: { value: upCount, unit: `/ ${HOSTS.length} up` },
            },
            {
                id: 'ping-table',
                title: 'Ping',
                type: 'table',
                size: 'lg',
                order: 1,
                data: {
                    rows: results.map((r) => ({
                        key: r.name,
                        value: r.up ? `${r.latency}ms` : 'DOWN',
                    })),
                },
            },
            ...results
                .filter((r) => r.up && latencyHistory.get(r.name)!.length > 1)
                .slice(0, 4)
                .map((r, i) => ({
                    id: `latency-${r.name}`,
                    title: `${r.name} Latency`,
                    type: 'timeseries' as const,
                    size: 'sm' as const,
                    order: 10 + i,
                    data: {
                        points: [...latencyHistory.get(r.name)!],
                        unit: 'ms',
                        min: 0,
                        max: Math.max(...latencyHistory.get(r.name)!, 50),
                    },
                })),
        ],
    };

    try {
        await flux.ctx.set('metrics', `svc:${payload.service.id}`, payload);
    } catch (err) {
        console.error('network collector error:', (err as Error).message);
    }
}

await tick();
setInterval(tick, INTERVAL);
