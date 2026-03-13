interface WeatherData {
    location: string;
    temp_f: number;
    temp_c: number;
    condition: string;
    icon: string;
    humidity: number;
    wind_mph: number;
    wind_dir: string;
    feels_like_f: number;
    feels_like_c: number;
    forecast: {
        date: string;
        high_f: number;
        low_f: number;
        high_c: number;
        low_c: number;
        condition: string;
        icon: string;
    }[];
}

let cache: WeatherData | null = null;
let lastFetch = 0;
const CACHE_TTL = 10 * 60 * 1000;
const LOCATION = process.env.WEATHER_LOCATION || '';
const API_KEY = process.env.OPENWEATHER_KEY || '';

const WIND_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

function degToCompass(deg: number): string {
    const idx = Math.round(deg / 22.5) % 16;
    return WIND_DIRS[idx];
}

function owmCodeToIcon(id: number): string {
    if (id >= 200 && id < 300) return 'thunder';
    if (id >= 300 && id < 400) return 'rain';
    if (id >= 500 && id < 600) return 'rain';
    if (id >= 600 && id < 700) return 'snow';
    if (id >= 700 && id < 800) return 'fog';
    if (id === 800) return 'clear';
    if (id === 801) return 'partly-cloudy';
    if (id >= 802) return 'cloudy';
    return 'cloudy';
}

function fToC(f: number): number {
    return Math.round(((f - 32) * 5) / 9);
}

function groupForecastByDay(list: any[]): { date: string; high_f: number; low_f: number; condition: string; conditionId: number }[] {
    const days = new Map<string, { temps: number[]; condition: string; conditionId: number }>();

    for (const entry of list) {
        const date = entry.dt_txt.split(' ')[0];
        if (!days.has(date)) {
            days.set(date, { temps: [], condition: entry.weather[0].description, conditionId: entry.weather[0].id });
        }
        days.get(date)!.temps.push(entry.main.temp);
    }

    const result: { date: string; high_f: number; low_f: number; condition: string; conditionId: number }[] = [];
    for (const [date, info] of days) {
        result.push({
            date,
            high_f: Math.round(Math.max(...info.temps)),
            low_f: Math.round(Math.min(...info.temps)),
            condition: info.condition,
            conditionId: info.conditionId,
        });
    }
    return result;
}

async function fetchWeather(): Promise<WeatherData | null> {
    const now = Date.now();
    if (cache && now - lastFetch < CACHE_TTL) return cache;

    if (!LOCATION || !API_KEY) return null;

    try {
        const encoded = encodeURIComponent(LOCATION);
        const [currentRes, forecastRes] = await Promise.all([
            fetch(
                `https://api.openweathermap.org/data/2.5/weather?q=${encoded}&units=imperial&appid=${API_KEY}`,
                { signal: AbortSignal.timeout(8000) }
            ),
            fetch(
                `https://api.openweathermap.org/data/2.5/forecast?q=${encoded}&units=imperial&cnt=24&appid=${API_KEY}`,
                { signal: AbortSignal.timeout(8000) }
            ),
        ]);

        const current = await currentRes.json() as any;
        const forecastData = await forecastRes.json() as any;

        if (!current.main || !current.weather?.[0]) return null;

        const grouped = groupForecastByDay(forecastData.list || []).slice(0, 3);

        const forecast = grouped.map(d => ({
            date: d.date,
            high_f: d.high_f,
            low_f: d.low_f,
            high_c: fToC(d.high_f),
            low_c: fToC(d.low_f),
            condition: d.condition,
            icon: owmCodeToIcon(d.conditionId),
        }));

        cache = {
            location: current.name || LOCATION,
            temp_f: Math.round(current.main.temp),
            temp_c: fToC(current.main.temp),
            condition: current.weather[0].description || '',
            icon: owmCodeToIcon(current.weather[0].id),
            humidity: current.main.humidity,
            wind_mph: Math.round(current.wind.speed),
            wind_dir: degToCompass(current.wind.deg || 0),
            feels_like_f: Math.round(current.main.feels_like),
            feels_like_c: fToC(current.main.feels_like),
            forecast,
        };
        lastFetch = now;
        return cache;
    } catch (err) {
        console.error('weather fetch error:', (err as Error).message);
        return cache;
    }
}

fetchWeather().catch(() => {});

export async function handleWeather(req: Request, path: string): Promise<Response | null> {
    if (req.method !== 'GET' || path !== '/weather') return null;
    const data = await fetchWeather();
    if (!data) return Response.json({ error: 'no location configured, set WEATHER_LOCATION env' }, { status: 503 });
    return Response.json(data);
}
