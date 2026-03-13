<script lang="ts">
	import {
		getSpotifyPlayback,
		getSpotifyQueue,
		getSpotifyDevices,
		spotifyPlay,
		spotifyPause,
		spotifyNext,
		spotifyPrevious,
		spotifyShuffle,
		spotifyRepeat,
		spotifySeek,
		spotifyVolume,
		type SpotifyPlayback,
		type SpotifyTrack,
		type SpotifyDevice
	} from '$lib/api';

	let playback: SpotifyPlayback | null = $state(null);
	let lastKnownTrack: SpotifyTrack | null = $state(null);
	let queue: SpotifyTrack[] = $state([]);
	let devices: SpotifyDevice[] = $state([]);
	let loaded = $state(false);
	let acting = $state(false);
	let showQueue = $state(false);
	let seeking = $state(false);
	let localProgress = $state(0);
	let loadingDevices = $state(false);

	let track = $derived(playback?.track ?? lastKnownTrack);
	let isPlaying = $derived(playback?.playing ?? false);
	let hasSession = $derived(playback?.active && track);

	let progressPct = $derived(
		track && playback?.duration_ms && playback.duration_ms > 0
			? Math.min(100, ((seeking ? localProgress : playback.progress_ms) / playback.duration_ms) * 100)
			: 0
	);

	function deviceIcon(type: string): string {
		if (type === 'Computer') return '&#128187;';
		if (type === 'Smartphone') return '&#128241;';
		if (type === 'Speaker') return '&#128264;';
		if (type === 'TV') return '&#128250;';
		return '&#127925;';
	}

	function formatTime(ms: number): string {
		const s = Math.floor(ms / 1000);
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	async function refresh() {
		const pb = await getSpotifyPlayback();
		if (pb?.track) lastKnownTrack = pb.track;
		if (!acting) playback = pb;
		loaded = true;
	}

	async function refreshDevices() {
		loadingDevices = true;
		devices = await getSpotifyDevices();
		loadingDevices = false;
	}

	async function act(fn: () => Promise<void>, delay = 800) {
		acting = true;
		await fn();
		setTimeout(async () => {
			await refresh();
			acting = false;
		}, delay);
	}

	async function togglePlay() {
		if (playback?.playing) {
			playback.playing = false;
			await act(() => spotifyPause(), 300);
		} else {
			if (playback) playback.playing = true;
			await act(() => spotifyPlay(), 300);
		}
	}

	async function playOnDevice(deviceId: string) {
		await act(async () => {
			await spotifyPlay(deviceId);
		}, 1500);
	}

	async function next() {
		await act(() => spotifyNext(), 1000);
	}

	async function prev() {
		await act(() => spotifyPrevious(), 1000);
	}

	async function toggleShuffle() {
		if (!playback) return;
		const newState = !playback.shuffle;
		playback.shuffle = newState;
		await act(() => spotifyShuffle(newState), 300);
	}

	async function cycleRepeat() {
		if (!playback) return;
		const modes: Array<'off' | 'context' | 'track'> = ['off', 'context', 'track'];
		const idx = modes.indexOf(playback.repeat as any);
		const next = modes[(idx + 1) % modes.length];
		playback.repeat = next;
		await act(() => spotifyRepeat(next), 300);
	}

	function onSeekStart(e: PointerEvent) {
		if (!playback?.duration_ms) return;
		seeking = true;
		updateSeekPosition(e);
	}

	function onSeekMove(e: PointerEvent) {
		if (!seeking) return;
		updateSeekPosition(e);
	}

	async function onSeekEnd() {
		if (!seeking || !playback?.duration_ms) return;
		seeking = false;
		playback.progress_ms = localProgress;
		await spotifySeek(localProgress);
		setTimeout(refresh, 500);
	}

	function updateSeekPosition(e: PointerEvent) {
		const bar = (e.currentTarget as HTMLElement);
		const rect = bar.getBoundingClientRect();
		const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		localProgress = pct * (playback?.duration_ms ?? 0);
	}

	async function changeVolume(delta: number) {
		if (!playback || playback.volume === null || playback.volume === undefined) return;
		const newVol = Math.max(0, Math.min(100, playback.volume + delta));
		playback.volume = newVol;
		await spotifyVolume(newVol);
	}

	async function fetchQueue() {
		const q = await getSpotifyQueue();
		if (q) queue = q.queue;
	}

	$effect(() => {
		refresh();
		const id = setInterval(refresh, 4000);
		return () => clearInterval(id);
	});

	$effect(() => {
		if (!hasSession && loaded) refreshDevices();
	});

	$effect(() => {
		if (showQueue) fetchQueue();
	});

	$effect(() => {
		if (!isPlaying || !playback || seeking) return;
		const id = setInterval(() => {
			if (playback && playback.progress_ms < playback.duration_ms) {
				playback.progress_ms += 1000;
			}
		}, 1000);
		return () => clearInterval(id);
	});
</script>

<div class="flex h-full flex-col">
	{#if !loaded}
		<div class="flex h-full items-center justify-center">
			<span class="font-mono text-[10px] text-text-dim" style="animation: hud-pulse 1s ease-in-out infinite">connecting to spotify...</span>
		</div>
	{:else if !hasSession}
		<div class="flex h-full flex-col items-center justify-center gap-4">
			<div class="text-center">
				<div class="text-3xl text-text-dim/15" style="filter: saturate(0)">&#127925;</div>
				<span class="mt-2 block font-mono text-[10px] text-text-dim/40">no active playback</span>
			</div>

			{#if lastKnownTrack}
				<button
					onclick={() => togglePlay()}
					class="flex w-full max-w-[240px] items-center gap-3 rounded-lg border border-panel-border/50 bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-hud-green/30 hover:bg-hud-green/[0.03]"
				>
					{#if lastKnownTrack.album_art_sm}
						<img src={lastKnownTrack.album_art_sm} alt="" class="h-10 w-10 shrink-0 rounded" style="filter: saturate(0.7) brightness(0.8)" />
					{/if}
					<div class="min-w-0 flex-1">
						<div class="truncate font-mono text-[11px] text-text/80">{lastKnownTrack.name}</div>
						<div class="truncate font-mono text-[9px] text-text-dim/40">{lastKnownTrack.artists.join(', ')}</div>
					</div>
					<svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0 text-hud-green/60" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
				</button>
			{/if}

			<div class="w-full max-w-[240px]">
				<div class="mb-2 flex items-center justify-between">
					<span class="font-mono text-[9px] uppercase tracking-wider text-text-dim/30">devices</span>
					<button
						onclick={refreshDevices}
						class="font-mono text-[9px] text-text-dim/25 transition-colors hover:text-hud-cyan/60"
					>refresh</button>
				</div>
				{#if loadingDevices}
					<span class="font-mono text-[9px] text-text-dim/30" style="animation: hud-pulse 1s ease-in-out infinite">scanning...</span>
				{:else if devices.length === 0}
					<div class="rounded border border-panel-border/30 px-3 py-3 text-center">
						<span class="font-mono text-[9px] text-text-dim/30">no devices found</span>
						<span class="mt-1 block font-mono text-[8px] text-text-dim/20">open spotify on a device</span>
					</div>
				{:else}
					<div class="space-y-1">
						{#each devices as device}
							<button
								onclick={() => playOnDevice(device.id)}
								class="group flex w-full items-center gap-2.5 rounded-md border border-panel-border/30 px-3 py-2.5 text-left transition-colors hover:border-hud-green/30 hover:bg-hud-green/[0.03] {device.is_active ? 'border-hud-green/20 bg-hud-green/[0.02]' : ''}"
							>
								<span class="text-sm {device.is_active ? 'text-hud-green/60' : 'text-text-dim/20'}">{@html deviceIcon(device.type)}</span>
								<div class="min-w-0 flex-1">
									<div class="truncate font-mono text-[11px] {device.is_active ? 'text-hud-green/80' : 'text-text/70'}">{device.name}</div>
									<div class="font-mono text-[8px] uppercase tracking-wider {device.is_active ? 'text-hud-green/40' : 'text-text-dim/25'}">{device.type}</div>
								</div>
								<svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-text-dim/15 transition-colors group-hover:text-hud-green/50" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="flex flex-1 flex-col gap-3" style="animation: hud-fade-in 0.3s ease-out both">
			<div class="flex gap-3.5">
				{#if track?.album_art}
					{#key track.id}
						<div class="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg" style="animation: hud-fade-in 0.4s ease-out both">
							<img
								src={track.album_art}
								alt={track?.album}
								class="h-full w-full object-cover"
								style="filter: saturate(0.85) brightness(0.9)"
							/>
							<div class="absolute inset-0 rounded-lg border border-white/[0.06]"></div>
							{#if isPlaying}
								<div class="absolute bottom-1.5 right-1.5 flex items-end gap-[2px]">
									{#each [0, 1, 2] as i}
										<div
											class="w-[3px] rounded-full bg-hud-green/80"
											style="height: {6 + i * 2}px; animation: hud-pulse {0.4 + i * 0.15}s ease-in-out infinite alternate"
										></div>
									{/each}
								</div>
							{/if}
						</div>
					{/key}
				{/if}
				<div class="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
					{#key track?.id}
						<div style="animation: hud-fade-in 0.3s ease-out both">
							<div class="truncate font-mono text-sm font-semibold leading-tight text-text">{track?.name}</div>
							<div class="mt-1 truncate font-mono text-xs text-text-secondary/70">{track?.artists.join(', ')}</div>
							<div class="mt-0.5 truncate font-mono text-[10px] text-text-dim/35">{track?.album}</div>
						</div>
					{/key}
					{#if track?.explicit}
						<span class="w-fit rounded border border-text-dim/20 px-1 py-0.5 font-mono text-[8px] uppercase text-text-dim/40">E</span>
					{/if}
				</div>
			</div>

			<div class="space-y-1.5">
				<div
					class="group relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/[0.06]"
					onpointerdown={onSeekStart}
					onpointermove={onSeekMove}
					onpointerup={onSeekEnd}
					onpointerleave={() => { if (seeking) onSeekEnd(); }}
					role="slider"
					aria-valuenow={playback?.progress_ms ?? 0}
					aria-valuemin={0}
					aria-valuemax={playback?.duration_ms ?? 0}
					tabindex="0"
				>
					<div
						class="h-full rounded-full transition-all {seeking ? 'duration-0' : 'duration-1000'} ease-linear"
						style="width: {progressPct}%; background: linear-gradient(90deg, rgba(0, 230, 118, 0.6), rgba(0, 230, 118, 0.9)); box-shadow: 0 0 6px rgba(0, 230, 118, 0.3)"
					></div>
					<div
						class="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-hud-green opacity-0 group-hover:opacity-100 transition-opacity"
						style="left: calc({progressPct}% - 6px); box-shadow: 0 0 8px rgba(0, 230, 118, 0.5)"
					></div>
				</div>
				<div class="flex justify-between">
					<span class="font-mono text-[9px] tabular-nums text-text-dim/35">{formatTime(seeking ? localProgress : (playback?.progress_ms ?? 0))}</span>
					<span class="font-mono text-[9px] tabular-nums text-text-dim/35">{formatTime(playback?.duration_ms ?? 0)}</span>
				</div>
			</div>

			<div class="flex items-center justify-between">
				<button
					class="rounded px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors {playback?.shuffle ? 'text-hud-green bg-hud-green/[0.08]' : 'text-text-dim/25 hover:text-text-dim/50'}"
					onclick={toggleShuffle}
				>shfl</button>

				<div class="flex items-center gap-3">
					<button
						class="flex h-8 w-8 items-center justify-center rounded-full text-text-dim/50 transition-colors hover:text-hud-cyan"
						onclick={prev}
						aria-label="Previous track"
					>
						<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
					</button>
					<button
						class="flex h-11 w-11 items-center justify-center rounded-full border transition-all {isPlaying ? 'border-hud-green/30 bg-hud-green/[0.06] text-hud-green hover:bg-hud-green/15' : 'border-hud-cyan/30 bg-hud-cyan/[0.06] text-hud-cyan hover:bg-hud-cyan/15'}"
						onclick={togglePlay}
					>
						{#if isPlaying}
							<svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
						{:else}
							<svg viewBox="0 0 24 24" class="h-5 w-5 ml-0.5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
						{/if}
					</button>
					<button
						class="flex h-8 w-8 items-center justify-center rounded-full text-text-dim/50 transition-colors hover:text-hud-cyan"
						onclick={next}
						aria-label="Next track"
					>
						<svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
					</button>
				</div>

				<button
					class="rounded px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors {playback?.repeat !== 'off' ? 'text-hud-green bg-hud-green/[0.08]' : 'text-text-dim/25 hover:text-text-dim/50'}"
					onclick={cycleRepeat}
				>{playback?.repeat === 'track' ? 'rpt1' : playback?.repeat === 'context' ? 'rpt' : 'rpt'}</button>
			</div>

			<div class="mt-auto space-y-2.5">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-1.5">
						<span class="h-1.5 w-1.5 rounded-full {isPlaying ? 'bg-hud-green' : 'bg-text-dim/30'}" style={isPlaying ? 'animation: hud-pulse 2s ease-in-out infinite' : ''}></span>
						<span class="font-mono text-[9px] text-text-dim/40">{playback?.device ?? 'unknown'}</span>
					</div>
					{#if playback?.volume !== undefined && playback?.volume !== null}
						<div class="flex items-center gap-1.5">
							<button class="font-mono text-[9px] text-text-dim/25 hover:text-text-dim/50 transition-colors" onclick={() => changeVolume(-10)}>-</button>
							<span class="font-mono text-[9px] tabular-nums text-text-dim/30 w-7 text-center">{playback.volume}%</span>
							<button class="font-mono text-[9px] text-text-dim/25 hover:text-text-dim/50 transition-colors" onclick={() => changeVolume(10)}>+</button>
						</div>
					{/if}
				</div>

				<button
					class="w-full rounded border border-panel-border/30 py-1.5 font-mono text-[9px] uppercase tracking-wider text-text-dim/30 transition-colors hover:border-panel-border/50 hover:text-text-dim/50"
					onclick={() => { showQueue = !showQueue; }}
				>{showQueue ? 'hide queue' : 'up next'}</button>

				{#if showQueue}
					<div class="max-h-32 overflow-y-auto rounded-md bg-white/[0.02] px-2.5 py-2" style="scrollbar-width: thin; scrollbar-color: rgba(77,168,255,0.15) transparent; animation: hud-fade-in 0.2s ease-out both">
						{#if queue.length === 0}
							<span class="font-mono text-[9px] text-text-dim/30">queue empty</span>
						{:else}
							{#each queue.slice(0, 8) as item, i}
								<div class="flex items-center gap-2 py-1 {i < Math.min(queue.length, 8) - 1 ? 'border-b border-white/[0.03]' : ''}">
									<span class="font-mono text-[9px] tabular-nums text-text-dim/20 w-3 text-right">{i + 1}</span>
									<div class="min-w-0 flex-1">
										<div class="truncate font-mono text-[10px] text-text/80">{item.name}</div>
										<div class="truncate font-mono text-[8px] text-text-dim/35">{item.artists.join(', ')}</div>
									</div>
									<span class="font-mono text-[8px] tabular-nums text-text-dim/20">{formatTime(item.duration_ms)}</span>
								</div>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
