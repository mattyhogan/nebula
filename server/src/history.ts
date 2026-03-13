import type { Lux } from '@luxdb/sdk';
import { cardKey, cardDataKey } from './schema.js';
import type { Card, MetricData, ProgressData } from './schema.js';

const INTERVAL = 60_000;
const MAX_AGE = 24 * 60 * 60 * 1000;

export function histKey(cardId: string): string {
    return `hist:${cardId}`;
}

type HistPoint = [number, number];

async function loadHistory(lux: Lux, cardId: string): Promise<HistPoint[]> {
    const raw = await lux.get(histKey(cardId));
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

async function saveHistory(lux: Lux, cardId: string, points: HistPoint[]) {
    await lux.set(histKey(cardId), JSON.stringify(points));
}

function extractValue(card: Card, data: any): number | null {
    if (card.type === 'metric') {
        const m = data as MetricData;
        return typeof m.value === 'number' ? m.value : null;
    }
    if (card.type === 'progress') {
        const p = data as ProgressData;
        return p.max > 0 ? Math.round((p.value / p.max) * 100) : null;
    }
    return null;
}

export function startHistoryWriter(luxRead: Lux, luxWrite: Lux) {
    console.log(`history writer started, snapshotting every ${INTERVAL / 1000}s, retaining ${MAX_AGE / 3600000}h`);

    async function tick() {
        try {
            const keys = await luxRead.keys('svc:*');
            const now = Date.now();
            const cutoff = now - MAX_AGE;

            for (const svcKey of keys) {
                const svcRaw = await luxRead.get(svcKey);
                if (!svcRaw) continue;

                let svc;
                try { svc = JSON.parse(svcRaw); } catch { continue; }
                if (!Array.isArray(svc.cards)) continue;

                for (const cardId of svc.cards) {
                    const cardRaw = await luxRead.get(cardKey(cardId));
                    const dataRaw = await luxRead.get(cardDataKey(cardId));
                    if (!cardRaw || !dataRaw) continue;

                    let card, data;
                    try {
                        card = JSON.parse(cardRaw);
                        data = JSON.parse(dataRaw);
                    } catch { continue; }

                    const value = extractValue(card, data);
                    if (value === null) continue;

                    const history = await loadHistory(luxRead, cardId);
                    history.push([now, value]);

                    const trimmed = history.filter(([t]) => t > cutoff);
                    await saveHistory(luxWrite, cardId, trimmed);
                }
            }
        } catch (err) {
            console.error('history writer error:', (err as Error).message);
        }
    }

    setTimeout(tick, 5000);
    setInterval(tick, INTERVAL);
}

const RANGE_MAP: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
};

export async function handleMetricsHistory(req: Request, lux: Lux): Promise<Response> {
    const url = new URL(req.url);
    const cardId = url.searchParams.get('card');
    const range = url.searchParams.get('range') || '1h';

    if (!cardId) {
        return Response.json({ error: 'missing card parameter' }, { status: 400 });
    }

    const rangeMs = RANGE_MAP[range] || RANGE_MAP['1h'];
    const cutoff = Date.now() - rangeMs;

    const history = await loadHistory(lux, cardId);
    const filtered = history.filter(([t]) => t > cutoff);

    const cardRaw = await lux.get(cardKey(cardId));
    let meta: { title?: string; unit?: string } = {};
    if (cardRaw) {
        try {
            const card = JSON.parse(cardRaw);
            meta.title = card.title;
            const dataRaw = await lux.get(cardDataKey(cardId));
            if (dataRaw) {
                const data = JSON.parse(dataRaw);
                meta.unit = data.unit;
            }
        } catch {}
    }

    return Response.json({
        card: cardId,
        range,
        meta,
        points: filtered,
    });
}

export async function handleMetricsHistoryList(lux: Lux): Promise<Response> {
    const keys = await lux.keys('hist:*');
    const cards = keys.map((k) => k.replace('hist:', ''));
    return Response.json({ cards });
}
