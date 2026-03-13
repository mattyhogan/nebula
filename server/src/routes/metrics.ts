import { Lux, Subscriber } from '@luxdb/sdk';
import type { Service, Card } from '../schema.js';
import { svcKey, cardKey, cardDataKey, DASHBOARD_CHANNEL } from '../schema.js';

async function loadSnapshot(lux: Lux) {
    const keys = await lux.keys('svc:*');
    const services: Array<{
        service: Service;
        cards: Array<{ card: Card; data: unknown }>;
    }> = [];

    for (const key of keys) {
        const raw = await lux.get(key);
        if (!raw) continue;
        try {
            const svc = JSON.parse(raw) as Service;
            if (!svc.id || !Array.isArray(svc.cards)) continue;
            const cards: Array<{ card: Card; data: unknown }> = [];
            for (const cardId of svc.cards) {
                const cardRaw = await lux.get(cardKey(cardId));
                const dataRaw = await lux.get(cardDataKey(cardId));
                if (cardRaw && dataRaw) {
                    cards.push({ card: JSON.parse(cardRaw), data: JSON.parse(dataRaw) });
                }
            }
            services.push({ service: svc, cards });
        } catch {}
    }

    return services;
}

export async function handleMetricsLatest(lux: Lux): Promise<Response> {
    const snapshot = await loadSnapshot(lux);
    return Response.json(snapshot);
}

const sseClients = new Set<ReadableStreamDefaultController>();

export function initMetricsSSE(lux: Lux, sub: Subscriber) {
    let loading = false;

    sub.subscribe(DASHBOARD_CHANNEL, async () => {
        if (sseClients.size === 0 || loading) return;
        loading = true;
        try {
            const snapshot = await loadSnapshot(lux);
            const data = `data: ${JSON.stringify(snapshot)}\n\n`;
            const encoder = new TextEncoder();
            for (const controller of sseClients) {
                try {
                    controller.enqueue(encoder.encode(data));
                } catch {
                    sseClients.delete(controller);
                }
            }
        } finally {
            loading = false;
        }
    });
}

export function handleMetricsStream(): Response {
    const stream = new ReadableStream({
        start(controller) {
            sseClients.add(controller);
            controller.enqueue(new TextEncoder().encode(':ok\n\n'));
        },
        cancel(controller) {
            sseClients.delete(controller as any);
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
