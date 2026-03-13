import type { Lux } from '@luxdb/sdk';

const ACTIVITY_PREFIX = 'activity:';

export function activityKey(date: string): string {
    return `${ACTIVITY_PREFIX}${date}`;
}

export async function incrementActivity(lux: Lux): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const key = activityKey(today);
    const raw = await lux.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    await lux.set(key, String(count + 1));
}

export async function handleActivityHeatmap(lux: Lux): Promise<Response> {
    const keys = await lux.keys(`${ACTIVITY_PREFIX}*`);
    const days: { date: string; count: number }[] = [];

    for (const key of keys) {
        const date = key.replace(ACTIVITY_PREFIX, '');
        const raw = await lux.get(key);
        const count = raw ? parseInt(raw, 10) || 0 : 0;
        if (count > 0) {
            days.push({ date, count });
        }
    }

    days.sort((a, b) => a.date.localeCompare(b.date));

    return Response.json({ days });
}
