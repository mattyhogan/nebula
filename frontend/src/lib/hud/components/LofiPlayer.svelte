<script lang="ts">
	let { soundOn = false }: { soundOn: boolean } = $props();

	const TRACKS = [
		{ file: '/lofi/golden-dust.mp3', name: 'Golden Dust' },
		{ file: '/lofi/rain-on-glass.mp3', name: 'Rain on Glass' },
		{ file: '/lofi/morning-drizzle.mp3', name: 'Morning Drizzle' },
		{ file: '/lofi/slow-chapters.mp3', name: 'Slow Chapters' },
		{ file: '/lofi/paper-light.mp3', name: 'Paper Light' },
		{ file: '/lofi/amber-haze.mp3', name: 'Amber Haze' },
	];

	const FADE_MS = 2000;
	const FADE_STEP = 50;

	let playlist: typeof TRACKS = $state([]);
	let trackIndex = $state(0);
	let playing = $state(false);
	let volume = $state(0.4);
	let trackName = $state('');
	let collapsed = $state(false);

	let audioA: HTMLAudioElement | undefined = $state();
	let audioB: HTMLAudioElement | undefined = $state();
	let activeAudio: 'a' | 'b' = 'a';
	let fadeInterval: ReturnType<typeof setInterval> | null = null;

	function shuffle<T>(arr: T[]): T[] {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	function getActive(): HTMLAudioElement | undefined {
		return activeAudio === 'a' ? audioA : audioB;
	}

	function getInactive(): HTMLAudioElement | undefined {
		return activeAudio === 'a' ? audioB : audioA;
	}

	function loadTrack(audio: HTMLAudioElement, idx: number) {
		audio.src = playlist[idx].file;
		audio.volume = 0;
		audio.load();
	}

	function fadeIn(audio: HTMLAudioElement, targetVol: number): Promise<void> {
		return new Promise((resolve) => {
			audio.volume = 0;
			const steps = FADE_MS / FADE_STEP;
			const increment = targetVol / steps;
			let current = 0;
			const id = setInterval(() => {
				current += increment;
				if (current >= targetVol) {
					audio.volume = targetVol;
					clearInterval(id);
					resolve();
				} else {
					audio.volume = current;
				}
			}, FADE_STEP);
		});
	}

	function fadeOut(audio: HTMLAudioElement): Promise<void> {
		return new Promise((resolve) => {
			const startVol = audio.volume;
			if (startVol === 0) { resolve(); return; }
			const steps = FADE_MS / FADE_STEP;
			const decrement = startVol / steps;
			let current = startVol;
			const id = setInterval(() => {
				current -= decrement;
				if (current <= 0) {
					audio.volume = 0;
					audio.pause();
					clearInterval(id);
					resolve();
				} else {
					audio.volume = current;
				}
			}, FADE_STEP);
		});
	}

	function initPlaylist() {
		if (playlist.length === 0) {
			playlist = shuffle(TRACKS);
			trackIndex = 0;
		}
	}

	async function startPlayback() {
		initPlaylist();
		const audio = getActive()!;
		loadTrack(audio, trackIndex);
		trackName = playlist[trackIndex].name;
		try {
			await audio.play();
			fadeIn(audio, volume);
		} catch {
			playing = false;
		}
	}

	async function crossfadeTo(nextIdx: number) {
		if (fadeInterval) return;
		const outgoing = getActive()!;
		const incoming = getInactive()!;

		trackIndex = nextIdx;
		trackName = playlist[trackIndex].name;
		loadTrack(incoming, trackIndex);

		try {
			await incoming.play();
		} catch { return; }

		activeAudio = activeAudio === 'a' ? 'b' : 'a';
		fadeIn(incoming, volume);
		fadeOut(outgoing);
	}

	function nextTrack() {
		const next = (trackIndex + 1) % playlist.length;
		if (next === 0) {
			playlist = shuffle(TRACKS);
		}
		crossfadeTo(next === 0 ? 0 : next);
	}

	function onTrackEnded() {
		nextTrack();
	}

	function togglePlay() {
		if (!playing) {
			playing = true;
			localStorage.setItem('nebula:lofi-playing', 'true');
			startPlayback();
		} else {
			playing = false;
			localStorage.setItem('nebula:lofi-playing', 'false');
			const audio = getActive();
			if (audio) fadeOut(audio);
		}
	}

	function skip() {
		if (playing) nextTrack();
	}

	function onVolumeChange(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		volume = val;
		localStorage.setItem('nebula:lofi-volume', String(val));
		const audio = getActive();
		if (audio && playing) audio.volume = val;
	}

	$effect(() => {
		const savedVol = localStorage.getItem('nebula:lofi-volume');
		if (savedVol !== null) volume = parseFloat(savedVol);
	});

	$effect(() => {
		if (!soundOn && playing) {
			const audio = getActive();
			if (audio) fadeOut(audio);
			playing = false;
			localStorage.setItem('nebula:lofi-playing', 'false');
		}
	});

	$effect(() => {
		const a = audioA;
		const b = audioB;
		if (!a || !b) return;

		function handler(this: HTMLAudioElement) {
			if (this === getActive()) onTrackEnded();
		}

		a.addEventListener('ended', handler);
		b.addEventListener('ended', handler);

		return () => {
			a.removeEventListener('ended', handler);
			b.removeEventListener('ended', handler);
		};
	});
</script>

<audio bind:this={audioA} preload="none"></audio>
<audio bind:this={audioB} preload="none"></audio>

<div
	class="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full border border-panel-border/60 bg-panel/95 backdrop-blur-sm px-3 py-1.5 font-mono transition-all duration-300"
	style="animation: hud-fade-in 0.4s ease-out both; box-shadow: 0 0 12px rgba(0, 229, 255, 0.06)"
>
	<button
		onclick={togglePlay}
		disabled={!soundOn}
		class="flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200
			{playing ? 'border-hud-cyan/40 text-hud-cyan bg-hud-cyan/10' : 'border-panel-border text-text-dim/50 hover:border-panel-border-hover hover:text-text-dim'}
			{!soundOn ? 'opacity-30 cursor-not-allowed' : ''}"
		title={playing ? 'Pause' : 'Play'}
	>
		{#if playing}
			<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
				<rect x="1" y="1" width="3" height="8" rx="0.5" />
				<rect x="6" y="1" width="3" height="8" rx="0.5" />
			</svg>
		{:else}
			<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
				<polygon points="2,1 9,5 2,9" />
			</svg>
		{/if}
	</button>

	{#if !collapsed}
		<div class="flex items-center gap-2 overflow-hidden transition-all duration-300" style="max-width: 260px">
			<div class="flex flex-col min-w-0">
				<span class="truncate text-[9px] leading-tight tracking-wider text-hud-cyan/80 uppercase max-w-[130px]">
					{trackName || 'lofi'}
				</span>
				{#if playing}
					<span class="text-[7px] text-text-dim/30 tracking-widest uppercase">playing</span>
				{/if}
			</div>

			<button
				onclick={skip}
				disabled={!playing}
				class="flex h-5 w-5 items-center justify-center rounded-full text-text-dim/40 transition-colors
					{playing ? 'hover:text-hud-cyan/70' : 'opacity-30 cursor-not-allowed'}"
				title="Skip"
			>
				<svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor">
					<polygon points="0,1 6,5 0,9" />
					<rect x="7" y="1" width="2" height="8" rx="0.5" />
				</svg>
			</button>

			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={volume}
				oninput={onVolumeChange}
				disabled={!soundOn}
				class="lofi-volume h-1 w-14 cursor-pointer appearance-none rounded-full bg-white/10 accent-hud-cyan
					{!soundOn ? 'opacity-30' : ''}"
			/>
		</div>
	{/if}

	<button
		onclick={() => (collapsed = !collapsed)}
		class="flex h-4 w-4 items-center justify-center text-text-dim/30 hover:text-text-dim/60 transition-colors"
		title={collapsed ? 'Expand' : 'Collapse'}
	>
		<svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
			{#if collapsed}
				<polygon points="2,0 6,4 2,8" />
			{:else}
				<polygon points="0,2 8,2 4,6" />
			{/if}
		</svg>
	</button>
</div>

<style>
	.lofi-volume::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-hud-cyan);
		cursor: pointer;
		box-shadow: 0 0 4px rgba(0, 229, 255, 0.4);
	}

	.lofi-volume::-moz-range-thumb {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-hud-cyan);
		cursor: pointer;
		border: none;
		box-shadow: 0 0 4px rgba(0, 229, 255, 0.4);
	}
</style>
