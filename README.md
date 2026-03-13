# Nebula

Gesture-controlled homelab dashboard. SvelteKit 5 + Bun + Lux.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your values
docker compose up
```

Open `http://localhost:4747`.

## Architecture

```
collectors --> Flux --> Lux --> Server (SSE) --> Frontend
                                  |
                            /ingest (HTTP POST)
```

- **Lux** - Timeseries data store (pulled as `ghcr.io/mattyhogan/lux`)
- **Server** - Bun HTTP server with SSE streaming, proxy layer, and REST API
- **Frontend** - SvelteKit 5 static site with gesture control via MediaPipe
- **Collectors** - Standalone processes that push system metrics via Flux protocol
- **Flux** - Distributed pub/sub built on Lux for real-time metric propagation

## Panels

| Panel | Description |
|-------|-------------|
| hello | Clock, greeting, weather summary |
| vitals | CPU, temperature, and other metric cards |
| capacity | Memory, disk usage progress bars |
| telemetry | Sparkline charts for CPU history, network, etc. |
| system | Service health list and data tables |
| changelog | Recent git commits from configured repos |
| nero | AI agent chat interface |
| terminal | Remote shell via WebSocket |
| calendar | Google Calendar integration |
| news | RSS feeds (HN, WSJ, TechCrunch, Reuters, Verge) |
| kiosk | Pi display control (start/stop/restart browser) |
| activity | Contribution-style heatmap |
| network | LAN device scanner with WOL |
| spotify | Now playing with playback controls |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4747` | Server port |
| `LUX_HOST` | `lux` | Lux hostname |
| `LUX_PORT` | `6379` | Lux port |
| `STATIC_DIR` | `./public` | Frontend build directory |
| `VITE_API_URL` | `''` (same origin) | Frontend API base URL |
| `NEBULA_BASE_PATH` | `''` | Base path for static serving |
| `MINI_HOST` | | Proxy target for gcal/spotify/nero |
| `KIOSK_API` | | Kiosk API URL (e.g. `http://localhost:4740`) |
| `WEATHER_LOCATION` | | City for weather (e.g. `Miami,FL,US`) |
| `OPENWEATHER_KEY` | | OpenWeatherMap API key |
| `GITHUB_USER` | | GitHub username for changelog |
| `GITHUB_ORGS` | | Comma-separated GitHub orgs |
| `GITHUB_TOKEN` | | GitHub PAT for changelog |
| `PHOTOS_DIR` | `./photos` | Photo slideshow directory |
| `NEWS_FEEDS` | | JSON array of custom RSS feeds |
| `ENABLE_LOCAL_COLLECTOR` | `false` | Run system collector on server host |
| `PING_HOSTS` | | JSON array of `{name, host, port?}` for network collector |
| `COLLECTOR_ID` | `system` | Service ID for system collector |
| `COLLECTOR_NAME` | `System` | Display name for system collector |

## Development

```bash
bun install

# Terminal 1: server
cd server && bun run start

# Terminal 2: frontend dev
cd frontend && bun run dev
```

## License

MIT
