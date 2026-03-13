<script lang="ts">
	import { getPhotos, getPhotoUrl, type WeatherData } from '$lib/api';

	interface Props {
		visible: boolean;
		weather?: WeatherData | null;
	}

	let { visible, weather = null }: Props = $props();

	let now = $state(new Date());
	let photos = $state<string[]>([]);
	let currentIndex = $state(0);
	let activeSlot = $state<0 | 1>(0);
	let slot0Src = $state('');
	let slot1Src = $state('');
	let kenBurnsKey = $state(0);

	const hours = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
	const seconds = $derived(now.toLocaleTimeString([], { second: '2-digit' }).slice(-2));
	const dateStr = $derived(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }));
	const hasPhotos = $derived(photos.length > 0);

	const weatherIcons: Record<string, string> = {
		'clear': '\u2600',
		'partly-cloudy': '\u26C5',
		'cloudy': '\u2601',
		'fog': '\u{1F32B}',
		'rain': '\u{1F327}',
		'snow': '\u{1F328}',
		'thunder': '\u26A1',
	};

	const KB_VARIANTS = [
		'kb-zoom-in-left',
		'kb-zoom-in-right',
		'kb-zoom-out-center',
		'kb-pan-left',
		'kb-pan-right',
	];

	function pickKenBurns(): string {
		return KB_VARIANTS[Math.floor(Math.random() * KB_VARIANTS.length)];
	}

	let currentKB = $state(pickKenBurns());

	function shuffle(arr: string[]): string[] {
		const copy = [...arr];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return copy;
	}

	function advancePhoto() {
		if (photos.length === 0) return;
		const nextIndex = (currentIndex + 1) % photos.length;
		const nextUrl = getPhotoUrl(photos[nextIndex]);
		const nextSlot: 0 | 1 = activeSlot === 0 ? 1 : 0;

		if (nextSlot === 0) {
			slot0Src = nextUrl;
		} else {
			slot1Src = nextUrl;
		}

		currentIndex = nextIndex;
		activeSlot = nextSlot;
		currentKB = pickKenBurns();
		kenBurnsKey++;
	}

	$effect(() => {
		if (!visible) return;
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	$effect(() => {
		if (!visible) return;
		getPhotos().then((list) => {
			if (list.length === 0) return;
			photos = shuffle(list);
			slot0Src = getPhotoUrl(photos[0]);
			activeSlot = 0;
			currentIndex = 0;
			currentKB = pickKenBurns();
		});
	});

	$effect(() => {
		if (!visible || photos.length < 2) return;
		const id = setInterval(advancePhoto, 15000);
		return () => clearInterval(id);
	});
</script>

{#if visible}
	<div class="clock-overlay fixed inset-0 z-40 flex items-center justify-center pointer-events-auto {!hasPhotos ? 'bg-bg/95' : ''}">
		{#if hasPhotos}
			<div class="photo-layer absolute inset-0 overflow-hidden">
				{#key `slot0-${kenBurnsKey}-0`}
					<img
						src={slot0Src}
						alt=""
						class="photo-img absolute inset-0 w-full h-full object-cover"
						class:photo-visible={activeSlot === 0}
						class:photo-hidden={activeSlot !== 0}
						style="animation-name: {activeSlot === 0 ? currentKB : 'none'}"
					/>
				{/key}
				{#key `slot1-${kenBurnsKey}-1`}
					<img
						src={slot1Src}
						alt=""
						class="photo-img absolute inset-0 w-full h-full object-cover"
						class:photo-visible={activeSlot === 1}
						class:photo-hidden={activeSlot !== 1}
						style="animation-name: {activeSlot === 1 ? currentKB : 'none'}"
					/>
				{/key}
				<div class="photo-dim absolute inset-0"></div>
			</div>
		{:else}
			<div class="dot-grid"></div>
			<div class="scan-line"></div>
		{/if}

		<div class="relative z-10 flex flex-col items-center gap-6 select-none">
			<div class="flex items-baseline gap-2">
				<span class="clock-glow font-mono text-[min(12vw,140px)] font-bold tabular-nums tracking-tight text-hud-cyan" style="line-height: 1">
					{hours}
				</span>
				<span class="font-mono text-[min(3.5vw,42px)] tabular-nums text-hud-cyan/30" style="animation: seconds-pulse 1s ease-in-out infinite">
					{seconds}
				</span>
			</div>

			<div class="font-mono text-[min(1.8vw,18px)] uppercase tracking-[0.3em] text-text-dim/50">
				{dateStr}
			</div>

			{#if weather}
				<div class="mt-4 flex items-center gap-3 rounded-full border border-panel-border/20 bg-white/[0.02] px-5 py-2">
					<span class="text-lg" style="filter: saturate(0.5)">{weatherIcons[weather.icon] ?? '\u2601'}</span>
					<span class="font-mono text-sm tabular-nums text-text-dim/70">{weather.temp_f}&deg;</span>
					<span class="font-mono text-[11px] text-text-dim/30">{weather.condition}</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.clock-overlay {
		animation: overlay-fade-in 0.8s ease-out both;
		background-color: var(--color-bg, #0a0a0f);
	}

	@keyframes overlay-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.photo-layer {
		z-index: 0;
	}

	.photo-img {
		transition: opacity 2s ease-in-out;
		animation-duration: 18s;
		animation-timing-function: ease-in-out;
		animation-fill-mode: both;
		will-change: transform, opacity;
	}

	.photo-visible {
		opacity: 1;
	}

	.photo-hidden {
		opacity: 0;
	}

	.photo-dim {
		background: rgba(0, 0, 0, 0.65);
		pointer-events: none;
		z-index: 1;
	}

	@keyframes kb-zoom-in-left {
		from { transform: scale(1.0) translate(0, 0); }
		to { transform: scale(1.15) translate(-2%, -1%); }
	}

	@keyframes kb-zoom-in-right {
		from { transform: scale(1.0) translate(0, 0); }
		to { transform: scale(1.15) translate(2%, -1%); }
	}

	@keyframes kb-zoom-out-center {
		from { transform: scale(1.15) translate(0, 0); }
		to { transform: scale(1.0) translate(0, 0); }
	}

	@keyframes kb-pan-left {
		from { transform: scale(1.1) translate(2%, 0); }
		to { transform: scale(1.1) translate(-2%, 0); }
	}

	@keyframes kb-pan-right {
		from { transform: scale(1.1) translate(-2%, 0); }
		to { transform: scale(1.1) translate(2%, 0); }
	}

	.clock-glow {
		text-shadow:
			0 0 40px rgba(0, 229, 255, 0.15),
			0 0 80px rgba(0, 229, 255, 0.08),
			0 0 120px rgba(0, 229, 255, 0.04);
		animation: glow-breathe 4s ease-in-out infinite;
	}

	@keyframes glow-breathe {
		0%, 100% {
			text-shadow:
				0 0 40px rgba(0, 229, 255, 0.12),
				0 0 80px rgba(0, 229, 255, 0.06),
				0 0 120px rgba(0, 229, 255, 0.03);
		}
		50% {
			text-shadow:
				0 0 50px rgba(0, 229, 255, 0.22),
				0 0 100px rgba(0, 229, 255, 0.12),
				0 0 160px rgba(0, 229, 255, 0.06);
		}
	}

	@keyframes seconds-pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.6; }
	}

	.dot-grid {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(0, 229, 255, 0.04) 1px, transparent 1px);
		background-size: 32px 32px;
		pointer-events: none;
	}

	.scan-line {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			to bottom,
			transparent,
			transparent 3px,
			rgba(0, 229, 255, 0.008) 3px,
			rgba(0, 229, 255, 0.008) 4px
		);
		pointer-events: none;
		animation: scan-drift 8s linear infinite;
	}

	@keyframes scan-drift {
		from { transform: translateY(0); }
		to { transform: translateY(32px); }
	}
</style>
