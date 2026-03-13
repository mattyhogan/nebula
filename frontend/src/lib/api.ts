import type { ServiceSnapshot } from './types';

const API = import.meta.env.VITE_API_URL || '';

export interface NebulaConfig {
	features: Record<string, boolean>;
}

export async function getConfig(): Promise<NebulaConfig> {
	try {
		const r = await fetch(`${API}/config`);
		if (!r.ok) return { features: {} };
		return r.json();
	} catch { return { features: {} }; }
}

export type KioskMode = 'browser' | 'terminal' | 'idle';
export type FavoriteType = 'url' | 'command';

export interface Favorite {
	id: string;
	name: string;
	type: FavoriteType;
	value: string;
}

export async function getStatus(): Promise<KioskMode> {
	const r = await fetch(`${API}/status`);
	const { mode } = await r.json();
	return mode;
}

export async function startKiosk(url?: string): Promise<string> {
	const r = await fetch(`${API}/start`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(url ? { url } : {})
	});
	const { output } = await r.json();
	return output;
}

export async function stopKiosk(): Promise<string> {
	const r = await fetch(`${API}/stop`, { method: 'POST' });
	const { output } = await r.json();
	return output;
}

export async function openTerminal(command?: string): Promise<string> {
	const r = await fetch(`${API}/terminal`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(command ? { command } : {})
	});
	const { output } = await r.json();
	return output;
}

export async function getFavorites(): Promise<Favorite[]> {
	const r = await fetch(`${API}/favorites`);
	const { favorites } = await r.json();
	return favorites;
}

export async function addFavorite(name: string, type: FavoriteType, value: string): Promise<Favorite[]> {
	const r = await fetch(`${API}/favorites`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, type, value })
	});
	const { favorites } = await r.json();
	return favorites;
}

export async function deleteFavorite(id: string): Promise<Favorite[]> {
	const r = await fetch(`${API}/favorites/${id}`, { method: 'DELETE' });
	const { favorites } = await r.json();
	return favorites;
}

export async function getZoom(): Promise<number> {
	const r = await fetch(`${API}/zoom`);
	const { zoom } = await r.json();
	return zoom;
}

export async function setZoom(zoom: number): Promise<string> {
	const r = await fetch(`${API}/zoom`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ zoom })
	});
	const { output } = await r.json();
	return output;
}

export async function restartKiosk(url?: string): Promise<string> {
	const r = await fetch(`${API}/restart`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(url ? { url } : {})
	});
	const { output } = await r.json();
	return output;
}

export async function getDocsHtml(): Promise<string> {
	const r = await fetch(`${API}/docs/raw`);
	return r.text();
}

export async function getMetricsLatest(): Promise<ServiceSnapshot[]> {
	const r = await fetch(`${API}/metrics/latest`);
	return r.json();
}

export interface HistoryResponse {
	card: string;
	range: string;
	meta: { title?: string; unit?: string };
	points: [number, number][];
}

export async function getMetricsHistory(card: string, range = '1h'): Promise<HistoryResponse> {
	const r = await fetch(`${API}/metrics/history?card=${encodeURIComponent(card)}&range=${range}`);
	return r.json();
}

export function connectMetricsSSE(onData: (snapshots: ServiceSnapshot[]) => void): EventSource {
	const es = new EventSource(`${API}/metrics/stream`);
	es.onmessage = (e) => {
		try {
			onData(JSON.parse(e.data));
		} catch {}
	};
	return es;
}

export async function getPhotos(): Promise<string[]> {
	try {
		const r = await fetch(`${API}/photos`);
		if (!r.ok) return [];
		return r.json();
	} catch { return []; }
}

export function getPhotoUrl(filename: string): string {
	return `${API}/photos/${encodeURIComponent(filename)}`;
}

const NERO = '/nero';

export interface NeroActivity {
	id: string;
	tool: string;
	displayName?: string;
	args: Record<string, unknown>;
	status: 'pending' | 'approved' | 'denied' | 'skipped' | 'running' | 'complete' | 'error';
	result?: string;
	error?: string;
}

export interface NeroHistoryMessage {
	role: string;
	content: string;
	created_at: string;
	medium?: string;
}

export async function neroRegister(): Promise<void> {
	await fetch(`${NERO}/presence`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ device: 'hud', name: 'hud', type: 'display' })
	}).catch(() => {});
}

export async function getNeroHistory(): Promise<NeroHistoryMessage[]> {
	const r = await fetch(`${NERO}/history`);
	const data = await r.json();
	return data.messages ?? [];
}

export interface NeroChatCallbacks {
	onChunk: (text: string) => void;
	onActivity: (activity: NeroActivity) => void;
	onDone: (content: string) => void;
	onError: (error: string) => void;
}

export async function neroChat(message: string, cb: NeroChatCallbacks): Promise<void> {
	const res = await fetch(`${NERO}/chat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message, device: 'hud' })
	});

	if (!res.ok || !res.body) {
		cb.onError('Failed to connect');
		return;
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';

		for (const line of lines) {
			if (!line.startsWith('data: ')) continue;
			try {
				const parsed = JSON.parse(line.slice(6));
				if (parsed.type === 'chunk' && parsed.data) cb.onChunk(parsed.data);
				else if (parsed.type === 'activity' && parsed.data) cb.onActivity(parsed.data);
				else if (parsed.type === 'done' && parsed.data) cb.onDone(parsed.data.content ?? '');
				else if (parsed.type === 'error') cb.onError(parsed.data ?? 'Unknown error');
			} catch {}
		}
	}
}

export function connectNeroEvents(
	onEvent: (event: { type: string; data: unknown }) => void
): EventSource {
	const es = new EventSource(`${NERO}/interfaces/events?device=hud&name=hud`);
	es.onmessage = (e) => {
		try {
			onEvent(JSON.parse(e.data));
		} catch {}
	};
	return es;
}

export function connectNeroLogs(
	onLog: (entry: { timestamp: string; level: string; source: string; message: string }) => void
): EventSource {
	const es = new EventSource(`${NERO}/logs/stream`);
	es.onmessage = (e) => {
		try {
			onLog(JSON.parse(e.data));
		} catch {}
	};
	return es;
}

export interface HeatmapDay {
	date: string;
	count: number;
}

export async function getActivityHeatmap(): Promise<HeatmapDay[]> {
	try {
		const r = await fetch(`${API}/activity/heatmap`);
		if (!r.ok) return [];
		const data = await r.json();
		return data.days ?? [];
	} catch { return []; }
}

export interface NetworkDevice {
	ip: string;
	hostname: string | null;
	mac: string;
	vendor: string | null;
}

export interface NetworkData {
	devices: NetworkDevice[];
	gateway: string | null;
	scanned_at: number;
}

export async function getNetwork(): Promise<NetworkData | null> {
	try {
		const r = await fetch(`${API}/network`);
		if (!r.ok) return null;
		return r.json();
	} catch { return null; }
}

export async function sendWol(mac: string): Promise<boolean> {
	try {
		const r = await fetch(`${API}/network/wol`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ mac })
		});
		return r.ok;
	} catch { return false; }
}

export interface ChangelogCommit {
	hash: string;
	author: string;
	date: string;
	message: string;
	url: string;
	repo: string;
	type?: 'commit' | 'pr';
	prState?: 'open' | 'merged' | 'closed';
}

export interface GHRepo {
	name: string;
	full_name: string;
	description: string | null;
	private: boolean;
	updated_at: string;
}

export async function getChangelogRepos(): Promise<GHRepo[]> {
	try {
		const r = await fetch(`${API}/changelog/repos`);
		if (!r.ok) return [];
		return await r.json();
	} catch { return []; }
}

export async function getChangelog(repos: string[]): Promise<ChangelogCommit[]> {
	try {
		const r = await fetch(`${API}/changelog`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ repos }),
		});
		if (!r.ok) return [];
		const data = await r.json();
		return data.commits ?? [];
	} catch { return []; }
}

export async function getChangelogPrefs(): Promise<string[]> {
	try {
		const r = await fetch(`${API}/changelog/prefs`);
		if (!r.ok) return [];
		const data = await r.json();
		return data.repos ?? [];
	} catch { return []; }
}

export async function saveChangelogPrefs(repos: string[]): Promise<void> {
	await fetch(`${API}/changelog/prefs`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ repos }),
	}).catch(() => {});
}

export interface NewsItem {
	title: string;
	url: string;
	source: string;
	published: string;
	score?: number;
	summary?: string;
}

export async function getNews(): Promise<NewsItem[]> {
	const r = await fetch(`${API}/news`);
	const data = await r.json();
	return data.items ?? [];
}

export interface WeatherData {
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

export async function getWeather(): Promise<WeatherData | null> {
	try {
		const r = await fetch(`${API}/weather`);
		if (!r.ok) return null;
		return r.json();
	} catch { return null; }
}

const SPOTIFY = '/spotify';

export interface SpotifyTrack {
	id: string;
	name: string;
	artists: string[];
	album: string;
	album_art: string | null;
	album_art_sm: string | null;
	duration_ms: number;
	explicit: boolean;
	external_url: string | null;
}

export interface SpotifyPlayback {
	active: boolean;
	playing: boolean;
	shuffle: boolean;
	repeat: string;
	volume: number;
	device: string;
	device_type: string;
	track: SpotifyTrack | null;
	progress_ms: number;
	duration_ms: number;
}

export interface SpotifyDevice {
	id: string;
	name: string;
	type: string;
	is_active: boolean;
	volume_percent: number | null;
}

export async function getSpotifyDevices(): Promise<SpotifyDevice[]> {
	try {
		const r = await fetch(`${SPOTIFY}/devices`);
		if (!r.ok) return [];
		const data = await r.json();
		return data.devices ?? [];
	} catch { return []; }
}

export async function getSpotifyPlayback(): Promise<SpotifyPlayback | null> {
	try {
		const r = await fetch(`${SPOTIFY}/playback`);
		if (!r.ok) return null;
		return r.json();
	} catch { return null; }
}

export async function spotifyPlay(deviceId?: string): Promise<void> {
	await fetch(`${SPOTIFY}/play`, {
		method: 'POST',
		headers: deviceId ? { 'Content-Type': 'application/json' } : {},
		body: deviceId ? JSON.stringify({ device_id: deviceId }) : undefined,
	}).catch(() => {});
}

export async function spotifyPause(): Promise<void> {
	await fetch(`${SPOTIFY}/pause`, { method: 'POST' }).catch(() => {});
}

export async function spotifyNext(): Promise<void> {
	await fetch(`${SPOTIFY}/next`, { method: 'POST' }).catch(() => {});
}

export async function spotifyPrevious(): Promise<void> {
	await fetch(`${SPOTIFY}/previous`, { method: 'POST' }).catch(() => {});
}

export async function spotifyVolume(volume: number): Promise<void> {
	await fetch(`${SPOTIFY}/volume`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ volume })
	}).catch(() => {});
}

export async function spotifyShuffle(state: boolean): Promise<void> {
	await fetch(`${SPOTIFY}/shuffle`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ state })
	}).catch(() => {});
}

export async function spotifyRepeat(state: 'off' | 'context' | 'track'): Promise<void> {
	await fetch(`${SPOTIFY}/repeat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ state })
	}).catch(() => {});
}

export async function spotifySeek(position_ms: number): Promise<void> {
	await fetch(`${SPOTIFY}/seek`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ position_ms })
	}).catch(() => {});
}

export interface SpotifyQueueData {
	currently_playing: SpotifyTrack | null;
	queue: SpotifyTrack[];
}

export async function getSpotifyQueue(): Promise<SpotifyQueueData | null> {
	try {
		const r = await fetch(`${SPOTIFY}/queue`);
		if (!r.ok) return null;
		return r.json();
	} catch { return null; }
}
