import { Lux } from '@luxdb/sdk';
import { svcKey, cardKey, cardDataKey, DASHBOARD_CHANNEL } from '../schema.js';
import type { Service, Card, CardData } from '../schema.js';

interface PushPayload {
    service: {
        id: string;
        name: string;
        icon?: string;
        color?: string;
        status?: 'healthy' | 'degraded' | 'down';
    };
    cards: Array<{
        id: string;
        title: string;
        type: 'metric' | 'timeseries' | 'status' | 'list' | 'table' | 'progress';
        size?: 'sm' | 'md' | 'lg';
        order?: number;
        data: CardData;
    }>;
}

const METRIC_TTL = 3600;

export async function writeMetricsToLux(lux: Lux, payload: PushPayload): Promise<void> {
    const svc: Service = {
        id: payload.service.id,
        name: payload.service.name || payload.service.id,
        icon: payload.service.icon || 'box',
        color: payload.service.color || '#6b7280',
        status: payload.service.status || 'healthy',
        cards: payload.cards.map((c) => `${payload.service.id}:${c.id}`),
    };

    await lux.set(svcKey(svc.id), JSON.stringify(svc), METRIC_TTL);

    for (let i = 0; i < payload.cards.length; i++) {
        const c = payload.cards[i];
        const fullId = `${payload.service.id}:${c.id}`;
        const card: Card = {
            id: fullId,
            serviceId: svc.id,
            title: c.title,
            type: c.type,
            size: c.size || 'sm',
            order: c.order ?? i,
        };
        await lux.set(cardKey(fullId), JSON.stringify(card), METRIC_TTL);
        await lux.set(cardDataKey(fullId), JSON.stringify(c.data), METRIC_TTL);
    }

    await lux.publish(DASHBOARD_CHANNEL, `push:${svc.id}`);
}

export async function handleIngest(req: Request, lux: Lux): Promise<Response> {
    try {
        const payload = (await req.json()) as PushPayload;
        if (!payload.service?.id || !payload.cards) {
            return Response.json({ error: 'Missing service.id or cards' }, { status: 400 });
        }
        await writeMetricsToLux(lux, payload);
        return Response.json({ ok: true, service: payload.service.id, cards: payload.cards.length });
    } catch (err) {
        return Response.json({ error: (err as Error).message }, { status: 400 });
    }
}
