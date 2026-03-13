# Nebula

Gesture-controlled homelab dashboard. SvelteKit 5 + Bun + Lux.

## Codebase Structure

```
nebula/
  frontend/          SvelteKit 5 static site (Svelte 5 runes)
    src/
      routes/        +page.svelte (main dashboard)
      lib/
        api.ts       API client (fetch + SSE)
        types.ts     Card/Service/Snapshot types
        hud/
          registry.ts    Panel registry (add panels here)
          panels.svelte  Panel manager (drag/resize/depth)
          hands.svelte   MediaPipe hand tracking
          audio.svelte   Sound effects
          theme.svelte   Theme management
          clap.svelte    Clap detection
          components/    All panel + card components
  server/            Bun HTTP server
    src/
      index.ts       Main entry, routing, proxy config, Flux/Lux setup
      schema.ts      Lux key schema and card type definitions
      collector.ts   Local system metrics collector (Linux only)
      history.ts     Metrics history writer
      lux-subscriber.ts  Lux pub/sub bridge for Flux
      routes/        Route handlers (one file per feature)
        gateway.ts   /ingest endpoint and Lux write logic
  collectors/        Standalone metric collectors
    collector.ts     System metrics (CPU, mem, disk, network)
    network-collector.ts  Network ping health
  deploy/
    Dockerfile.server     Server + frontend container
    Dockerfile.collectors Collector container
```

## How to Create a New Panel

1. Create `frontend/src/lib/hud/components/MyPanel.svelte`
2. Add entry to `frontend/src/lib/hud/registry.ts`
3. Done. It appears in the carousel.

Registry entry:
```typescript
import MyPanel from './components/MyPanel.svelte';

// Add to the panels array:
{ id: 'my-panel', label: 'my panel', component: MyPanel, category: 'core' }
```

To pass metrics data, use `getProps`:
```typescript
{
  id: 'my-panel',
  label: 'my panel',
  component: MyPanel,
  getProps: ctx => ({ metrics: ctx.metrics }),
  category: 'core',
}
```

`PanelContext` provides: `snapshots`, `metrics`, `progress`, `timeseries`, `tables`, `isActive`.

Categories: `core` (system metrics), `integration` (external services), `tool` (interactive).

## How to Create a Collector

A collector pushes a `PushPayload` to the server. Two methods:

### HTTP POST (simplest)
```typescript
await fetch('http://localhost:4747/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    service: { id: 'my-svc', name: 'My Service', status: 'healthy' },
    cards: [
      { id: 'uptime', title: 'Uptime', type: 'metric', data: { value: 99.9, unit: '%' } },
    ],
  }),
});
```

### Flux (real-time, distributed)
```typescript
import { Flux } from '@luxdb/flux';
const flux = new Flux({ url: 'lux://lux:6379', name: 'my-collector' });
await flux.start();
await flux.join('metrics');
await flux.ctx.set('metrics', `svc:my-service`, payload);
```

## Card Types

| Type | Data Shape | Used For |
|------|-----------|----------|
| `metric` | `{ value, unit, trend?, thresholds? }` | Single numeric value |
| `timeseries` | `{ points[], unit, min?, max? }` | Sparkline chart |
| `progress` | `{ value, max, label, unit? }` | Progress bar |
| `table` | `{ rows: [{key, value}] }` | Key-value table |
| `status` | `{ state, label, since? }` | Health badge |
| `list` | `{ items: [{text, timestamp?, level?}], maxItems? }` | Log/event list |

## Ingest Schema

```typescript
interface PushPayload {
  service: {
    id: string;
    name: string;
    icon?: string;      // default: 'box'
    color?: string;     // hex color, default: '#6b7280'
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
```

## Lux Keys

- `svc:{id}` - Service metadata (JSON, 1h TTL)
- `card:{serviceId}:{cardId}` - Card metadata (JSON, 1h TTL)
- `card:{serviceId}:{cardId}:data` - Card data (JSON, 1h TTL)

## Metrics Pipeline

1. Collector builds payload matching `PushPayload`
2. Pushes via Flux (`flux.ctx.set`) or HTTP POST to `/ingest`
3. Server writes to Lux with 1-hour TTL
4. Server broadcasts via SSE on `/metrics/stream`
5. Frontend receives snapshots, extracts cards by type
6. Registry routes card data to panel components via `getProps`

## Server Proxy Layer

When `MINI_HOST` is set, the server proxies:
- `/spotify/*` -> `MINI_HOST:4870`
- `/gcal/*` -> `MINI_HOST:4860`
- `/nero/*` -> `MINI_HOST:4848/api/*`

Kiosk API proxied via `KIOSK_API` env var to a separate host service.

## Frontend Conventions

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`)
- No comments above code
- Tailwind CSS for styling
- All API calls go through `frontend/src/lib/api.ts`
- SSE connection for live metrics via `connectMetricsSSE()`

## Building

```bash
cd frontend && bun run build    # outputs to frontend/build/
cd server && bun run start      # serves build as static files on :4747
docker compose up               # starts lux + server
```
