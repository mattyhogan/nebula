<script lang="ts">
	import { onMount } from 'svelte';
	import { getMetricsLatest, connectMetricsSSE, neroRegister, connectNeroEvents, startKiosk, getConfig } from '$lib/api';
	import type {
		ServiceSnapshot,
		MetricData,
		TimeseriesData,
		ProgressData,
		TableData
	} from '$lib/types';
	import { cycleTheme, initTheme, getThemeLabel, isToastVisible } from '$lib/hud/theme.svelte';
	import { createHandTracker } from '$lib/hud/hands.svelte';
	import { playGrab, playRelease, playSwipe, startAmbient, stopAmbient, setAmbientMood, setMuted } from '$lib/hud/audio.svelte';
	import { panels, panelMap, type PanelContext } from '$lib/hud/registry';
	import Particles from '$lib/hud/components/Particles.svelte';
	import CameraFeed from '$lib/hud/components/CameraFeed.svelte';
	import HudPanel from '$lib/hud/components/HudPanel.svelte';
	import StatusBadge from '$lib/hud/components/StatusBadge.svelte';
	import HandOverlay from '$lib/hud/components/HandOverlay.svelte';
	import CommandPalette from '$lib/hud/components/CommandPalette.svelte';
	function isTerminalActive(): boolean {
		return typeof window !== 'undefined' && typeof (window as any).__terminalSend === 'function';
	}
	function sendToTerminal(data: string) {
		(window as any).__terminalSend?.(data);
	}
	import LofiPlayer from '$lib/hud/components/LofiPlayer.svelte';
	import ClockOverlay from '$lib/hud/components/ClockOverlay.svelte';
	import { getWeather, type WeatherData } from '$lib/api';
	import { startClapDetection, stopClapDetection, isClapActive } from '$lib/hud/clap.svelte';

	let features: Record<string, boolean> = $state({});
	let activePanels = $derived(panels.filter(p => !p.feature || features[p.feature] !== false));
	let panelIds = $derived(activePanels.map(p => p.id));
	let panelLabels: Record<string, string> = $derived(Object.fromEntries(activePanels.map(p => [p.id, p.label])));

	let snapshots: ServiceSnapshot[] = $state([]);
	let connected = $state(false);
	let now = $state(new Date());
	let handTracking = $state(false);
	let loadingHands = $state(false);
	let showCamera = $state(false);
	let soundOn = $state(typeof localStorage !== 'undefined' && localStorage.getItem('nebula:sound') === 'true');
	let showParticles = $state(typeof localStorage !== 'undefined' ? localStorage.getItem('nebula:fx') !== 'false' : true);
	let cameraVideo: HTMLVideoElement | null = $state(null);

	let carouselIndex = $state(0);
	let focused = $state(false);
	let swipeCooldown = false;
	let showHelp = $state(false);
	let showPalette = $state(false);

	let isMobile = $state(false);
	let mobileExpanded: string | null = $state(null);
	let kioskMode = $state(false);
	let kioskPanel: string | null = $state(null);
	let clapEnabled = $state(false);

	let fistStartTime: number | null = null;
	let fistPushed = false;
	let kioskPushFlash = $state(false);
	const FIST_HOLD_MS = 1000;

	const IDLE_TIMEOUT = 5 * 60 * 1000;
	let ambientMode = $state(false);
	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	let ambientRotateTimer: ReturnType<typeof setInterval> | null = null;
	let manualAmbient = false;

	let weather: WeatherData | null = $state(null);

	const tracker = createHandTracker();
	let neroConnected = $state(false);

	onMount(() => {
		getConfig().then(c => { features = c.features; }).catch(() => {});

		const params = new URLSearchParams(window.location.search);
		const p = params.get('panel');
		if (params.has('kiosk') || params.has('display')) {
			kioskMode = true;
			kioskPanel = p && panelIds.includes(p) ? p : 'hello';
		} else if (p && panelIds.includes(p)) {
			carouselIndex = panelIds.indexOf(p);
			if (isMobile) {
				mobileExpanded = p;
			} else {
				focused = true;
			}
		}
	});

	let metrics = $derived(
		snapshots.flatMap((s) =>
			s.cards.filter((c) => c.card.type === 'metric').map((c) => ({ ...c, service: s.service, serviceName: s.service.name }))
		)
	);
	let progress = $derived(
		snapshots.flatMap((s) =>
			s.cards.filter((c) => c.card.type === 'progress').map((c) => ({ ...c, service: s.service }))
		)
	);
	let timeseries = $derived(
		snapshots.flatMap((s) =>
			s.cards.filter((c) => c.card.type === 'timeseries').map((c) => ({ ...c, service: s.service }))
		)
	);
	let tables = $derived(
		snapshots.flatMap((s) =>
			s.cards.filter((c) => c.card.type === 'table').map((c) => ({ ...c, service: s.service }))
		)
	);
	let allHealthy = $derived(snapshots.every((s) => s.service.status === 'healthy'));

	function getPanelCtx(isActive: boolean): PanelContext {
		return { snapshots, metrics, progress, timeseries, tables, isActive };
	}

	$effect(() => {
		const mq = window.matchMedia('(max-width: 768px)');
		isMobile = mq.matches;
		function onChange(e: MediaQueryListEvent) { isMobile = e.matches; }
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	$effect(() => {
		getMetricsLatest()
			.then((s) => (snapshots = s))
			.catch(() => {});

		const es = connectMetricsSSE((s) => {
			snapshots = s;
			connected = true;
		});

		es.onerror = () => (connected = false);
		es.onopen = () => (connected = true);

		return () => es.close();
	});

	$effect(() => {
		neroRegister().then(() => { neroConnected = true; }).catch(() => {});

		const neroEs = connectNeroEvents((event) => {
			console.log('[nero event]', event);
		});
		neroEs.onopen = () => { neroConnected = true; };
		neroEs.onerror = () => { neroConnected = false; };

		return () => neroEs.close();
	});

	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	$effect(() => {
		getWeather().then((w) => (weather = w)).catch(() => {});
		const id = setInterval(() => {
			getWeather().then((w) => (weather = w)).catch(() => {});
		}, 10 * 60 * 1000);
		return () => clearInterval(id);
	});

	$effect(() => {
		initTheme();
	});

	function resetIdleTimer() {
		if (manualAmbient) return;
		if (ambientMode) exitAmbientMode();
		if (idleTimer) clearTimeout(idleTimer);
		idleTimer = setTimeout(enterAmbientMode, IDLE_TIMEOUT);
	}

	function enterAmbientMode() {
		if (isMobile) return;
		if (focused) {
			focused = false;
			playRelease();
		}
		ambientMode = true;
		ambientRotateTimer = setInterval(() => {
			if (!focused) {
				swipeCooldown = true;
				carouselIndex = ((carouselIndex + 1) % panelIds.length + panelIds.length) % panelIds.length;
				setTimeout(() => { swipeCooldown = false; }, 600);
			}
		}, 8000);
	}

	function exitAmbientMode() {
		ambientMode = false;
		if (ambientRotateTimer) {
			clearInterval(ambientRotateTimer);
			ambientRotateTimer = null;
		}
	}

	$effect(() => {
		const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
		const handler = () => resetIdleTimer();
		for (const ev of events) window.addEventListener(ev, handler);
		idleTimer = setTimeout(enterAmbientMode, IDLE_TIMEOUT);
		return () => {
			for (const ev of events) window.removeEventListener(ev, handler);
			if (idleTimer) clearTimeout(idleTimer);
			if (ambientRotateTimer) clearInterval(ambientRotateTimer);
		};
	});

	let ambientStarted = false;
	let prevHealthy: boolean | null = null;

	$effect(() => {
		if (tracker.hands.length > 0) {
			handleCarouselGesture(tracker.hands);
		}
	});

	$effect(() => {
		setMuted(!soundOn);
		localStorage.setItem('nebula:fx', String(showParticles));
	});

	$effect(() => {
		if (connected && soundOn && !ambientStarted) {
			ambientStarted = true;
			startAmbient();
		}
		return () => { if (ambientStarted) { stopAmbient(); ambientStarted = false; } };
	});

	$effect(() => {
		if (snapshots.length > 0 && prevHealthy !== allHealthy) {
			setAmbientMood(allHealthy);
			prevHealthy = allHealthy;
		}
	});

	let urlInitDone = false;
	$effect(() => {
		const panel = focused ? panelIds[carouselIndex] : mobileExpanded;
		if (!urlInitDone) { urlInitDone = true; return; }
		if (kioskMode) return;
		const url = new URL(window.location.href);
		if (panel) {
			url.searchParams.set('panel', panel);
		} else {
			url.searchParams.delete('panel');
		}
		history.replaceState(null, '', url.pathname + url.search);
	});

	let wasPinching = false;

	function handleCarouselGesture(hands: import('$lib/hud/hands.svelte').HandState[]) {
		const h0 = hands[0];
		if (!h0 || swipeCooldown) return;

		const inView = h0.pinchX > 0.1 && h0.pinchX < 0.9 && h0.pinchY > 0.1 && h0.pinchY < 0.9;

		if (!focused && h0.pinching && !wasPinching && inView) {
			focused = true;
			playGrab();
		} else if (focused && !h0.pinching && wasPinching) {
			focused = false;
			playRelease();
		}
		wasPinching = h0.pinching;

		if (!focused && h0.gesture === 'open' && h0.speed > 0.07 && inView) {
			if (h0.velocityX > 0.07) {
				carouselNav(-1);
			} else if (h0.velocityX < -0.07) {
				carouselNav(1);
			}
		}

		if (h0.gesture === 'peace' && !fistPushed) {
			if (fistStartTime === null) {
				fistStartTime = performance.now();
			} else if (performance.now() - fistStartTime > FIST_HOLD_MS) {
				fistPushed = true;
				const pid = panelIds[carouselIndex];
				startKiosk(`${window.location.origin}?panel=${pid}&kiosk`).catch(() => {});
				kioskPushFlash = true;
				setTimeout(() => { kioskPushFlash = false; }, 1500);
			}
		} else if (h0.gesture !== 'peace') {
			fistStartTime = null;
			fistPushed = false;
		}
	}

	function carouselNav(dir: number) {
		if (focused) return;
		swipeCooldown = true;
		carouselIndex = ((carouselIndex + dir) % panelIds.length + panelIds.length) % panelIds.length;
		playSwipe(dir > 0 ? 'right' : 'left');
		setTimeout(() => { swipeCooldown = false; }, 600);
	}

	function onCameraReady(video: HTMLVideoElement) {
		cameraVideo = video;
	}

	function toggleHands() {
		handTracking = !handTracking;
		if (handTracking && cameraVideo) {
			loadingHands = true;
			tracker.init(cameraVideo).then(() => (loadingHands = false));
		} else if (!handTracking) {
			tracker.destroy();
		}
	}

	function toggleCamera() {
		showCamera = !showCamera;
	}

	function toggleSound() {
		soundOn = !soundOn;
		localStorage.setItem('nebula:sound', String(soundOn));
		setMuted(!soundOn);
		if (!soundOn) {
			stopAmbient();
		} else if (connected) {
			startAmbient();
		}
	}

	function toggleClap() {
		if (isClapActive()) {
			stopClapDetection();
			clapEnabled = false;
		} else {
			startClapDetection(() => {
				if (ambientMode) { manualAmbient = false; exitAmbientMode(); }
				else { manualAmbient = true; enterAmbientMode(); }
			}).then(ok => { clapEnabled = ok; });
		}
	}

	function onKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
			if (e.key === 'Escape') { focused = false; (e.target as HTMLElement).blur(); }
			return;
		}

		if (focused && panelIds[carouselIndex] === 'terminal' && isTerminalActive()) {
			if (e.key === 'Escape') { focused = false; return; }
			if (e.metaKey || e.key.startsWith('F')) return;
			let sent = true;
			if (e.key === 'Enter') sendToTerminal('\r');
			else if (e.key === 'Backspace') sendToTerminal('\x7f');
			else if (e.key === 'Tab') sendToTerminal('\t');
			else if (e.key === 'ArrowUp') sendToTerminal('\x1b[A');
			else if (e.key === 'ArrowDown') sendToTerminal('\x1b[B');
			else if (e.key === 'ArrowRight') sendToTerminal('\x1b[C');
			else if (e.key === 'ArrowLeft') sendToTerminal('\x1b[D');
			else if (e.key === 'Delete') sendToTerminal('\x1b[3~');
			else if (e.key === 'Home') sendToTerminal('\x1b[H');
			else if (e.key === 'End') sendToTerminal('\x1b[F');
			else if (e.ctrlKey && e.key.length === 1) {
				const code = e.key.toLowerCase().charCodeAt(0) - 96;
				if (code > 0 && code < 27) sendToTerminal(String.fromCharCode(code));
			}
			else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) sendToTerminal(e.key);
			else sent = false;
			if (sent) e.preventDefault();
			return;
		}

		if (e.key === '?') { showHelp = !showHelp; return; }
		if (e.key === '/') { e.preventDefault(); showPalette = true; return; }
		if (e.key === 'Escape') {
			if (ambientMode) { manualAmbient = false; exitAmbientMode(); return; }
			if (focused) { focused = false; return; }
			showHelp = false;
			return;
		}
		if (e.key === 'Enter') {
			focused = !focused;
			if (focused) playGrab();
			else playRelease();
			return;
		}
		if (focused) {
			if (e.key === 'k') {
				const pid = panelIds[carouselIndex];
				startKiosk(`${window.location.origin}?panel=${pid}&kiosk`).catch(() => {});
				kioskPushFlash = true;
				setTimeout(() => { kioskPushFlash = false; }, 1500);
			}
			return;
		}
		if (e.key === 'h') toggleHands();
		if (e.key === 's') toggleSound();
		if (e.key === 'c') toggleCamera();
		if (e.key === 'p') showParticles = !showParticles;
		if (e.key === 't') cycleTheme();
		if (e.key === 'm') toggleClap();
		if (e.key === 'a') {
			if (ambientMode) { manualAmbient = false; exitAmbientMode(); }
			else { manualAmbient = true; enterAmbientMode(); }
		}
		if (e.key === 'ArrowLeft') carouselNav(-1);
		if (e.key === 'ArrowRight') carouselNav(1);
	}

	function carouselOffset(idx: number): number {
		const n = panelIds.length;
		let diff = idx - carouselIndex;
		if (diff > n / 2) diff -= n;
		if (diff < -n / 2) diff += n;
		return diff;
	}

	function carouselTransform(idx: number): string {
		const offset = carouselOffset(idx);

		if (focused) {
			if (offset === 0) return 'translateZ(0px) scale(1)';
			const dir = offset > 0 ? 1 : -1;
			return `translateX(${dir * 120}%) translateZ(-200px) scale(0.4)`;
		}

		const x = offset * 36;
		const z = offset === 0 ? 40 : -Math.abs(offset) * 80;
		const ry = offset * -15;
		const scale = offset === 0 ? 0.95 : Math.max(0.6, 0.85 - Math.abs(offset) * 0.1);
		return `translateX(${x}%) translateZ(${z}px) rotateY(${ry}deg) scale(${scale})`;
	}

	function carouselOpacity(idx: number): number {
		const abs = Math.abs(carouselOffset(idx));
		if (focused) return abs === 0 ? 1 : 0.1;
		if (abs === 0) return 1;
		if (abs === 1) return 0.7;
		if (abs === 2) return 0.35;
		return 0.15;
	}

	let touchStartX = 0;
	let touchStartY = 0;

	function onTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function onTouchEnd(e: TouchEvent) {
		if (isMobile || focused) return;
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
			carouselNav(dx < 0 ? 1 : -1);
		}
	}

	function handlePaletteNavigate(panelId: string) {
		carouselIndex = panelIds.indexOf(panelId);
		if (carouselIndex === -1) carouselIndex = 0;
		focused = true;
	}

	function handlePaletteAction(action: string) {
		if (action === 'toggle-sound') toggleSound();
		else if (action === 'toggle-camera') toggleCamera();
		else if (action === 'toggle-hands') toggleHands();
		else if (action === 'toggle-particles') showParticles = !showParticles;
		else if (action === 'cycle-theme') cycleTheme();
		else if (action === 'help') showHelp = true;
	}

	const headerBtnClass = 'pointer-events-auto rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all duration-200';
	const headerBtnInactive = 'border-panel-border/60 text-text-dim/50 hover:border-panel-border hover:text-text-secondary';
	const headerBtnActive = 'border-hud-cyan/40 text-hud-cyan bg-hud-cyan/[0.06] hover:border-hud-cyan/60';
</script>

<svelte:head>
	<title>Nebula</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

{#if kioskMode}
	<div class="relative h-screen w-screen overflow-hidden bg-bg">
		<div class="absolute inset-0 bg-black/40"></div>
		{#if showParticles}
			<Particles ambientMode={false} />
		{/if}
		<div class="relative z-10 flex h-full flex-col p-4">
			<div class="flex-1 min-h-0">
				{#if kioskPanel}
					{@render panelContent(kioskPanel, kioskPanel === 'terminal')}
				{/if}
			</div>
		</div>
	</div>
{:else if isMobile}
	<div class="relative min-h-screen bg-bg font-sans text-text">
		<header class="sticky top-0 z-20 flex items-center justify-between border-b border-panel-border/60 bg-bg/90 backdrop-blur-sm px-4 py-3">
			<div class="flex items-center gap-2.5">
				<div class="h-2.5 w-2.5 rounded-sm border border-hud-cyan/40 bg-hud-cyan/20 {connected ? '' : 'opacity-30'}"
					style={connected ? 'animation: hud-pulse 2s ease-in-out infinite' : ''}></div>
				<span class="font-mono text-xs font-semibold tracking-[0.15em] text-hud-cyan">NEBULA</span>
			</div>
			<div class="flex items-center gap-3">
				<div class="flex items-center gap-1.5">
					<span class="h-1.5 w-1.5 rounded-full {neroConnected ? 'bg-hud-green' : 'bg-text-dim/30'}"></span>
					<span class="font-mono text-[9px] uppercase {neroConnected ? 'text-hud-green/60' : 'text-text-dim/40'}">nero</span>
				</div>
				<span class="font-mono text-[10px] tabular-nums text-text-dim/60">
					{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
				</span>
			</div>
		</header>

		{#if mobileExpanded}
			<div class="fixed inset-0 z-30 flex flex-col bg-bg" style="animation: mobile-slide-up 0.25s ease-out both">
				<div class="flex items-center justify-between border-b border-panel-border/60 px-4 py-3">
					<div class="flex items-center gap-2">
						<span class="h-1.5 w-1.5 rounded-full bg-hud-cyan" style="animation: hud-pulse 2s ease-in-out infinite"></span>
						<span class="font-mono text-[11px] font-medium uppercase tracking-widest text-hud-cyan">{panelLabels[mobileExpanded] ?? mobileExpanded}</span>
					</div>
					<button
						onclick={() => (mobileExpanded = null)}
						class="rounded border border-panel-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-dim transition-colors active:text-text"
					>close</button>
				</div>
				<div class="flex-1 overflow-y-auto p-4" style="min-height: 0">
					{@render panelInner(mobileExpanded)}
				</div>
			</div>
		{/if}

		<div class="space-y-2.5 p-4">
			{#if snapshots.length > 0}
				<div class="flex items-center justify-between rounded-lg border border-panel-border/40 bg-panel/60 px-3.5 py-2.5">
					<StatusBadge
						status={allHealthy ? 'healthy' : 'degraded'}
						label="{snapshots.filter((s) => s.service.status === 'healthy').length}/{snapshots.length} systems"
					/>
					<div class="flex gap-1">
						{#each snapshots as { service }}
							<span class="h-1.5 w-1.5 rounded-full" style="background: {service.color}; opacity: {service.status === 'healthy' ? 0.8 : 0.3}"></span>
						{/each}
					</div>
				</div>
			{/if}

			{#each panelIds as id, i}
				<button
					onclick={() => (mobileExpanded = id)}
					class="group flex w-full flex-col gap-2 rounded-lg border border-panel-border/40 bg-panel/60 p-3.5 text-left transition-all active:scale-[0.98] active:border-hud-cyan/30"
					style="animation: hud-fade-in 0.3s ease-out {i * 0.04}s both"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="h-1.5 w-1.5 rounded-full bg-hud-cyan/50"></span>
							<span class="font-mono text-[11px] font-medium uppercase tracking-widest text-hud-cyan">{panelLabels[id] ?? id}</span>
							{#if id === 'nero'}
								<span class="h-1.5 w-1.5 rounded-full {neroConnected ? 'bg-hud-green' : 'bg-text-dim/30'}"
									style={neroConnected ? 'animation: hud-pulse 2s ease-in-out infinite' : ''}></span>
							{/if}
						</div>
						<span class="font-mono text-[9px] text-text-dim/30 group-active:text-text-dim">open &rarr;</span>
					</div>

					{@render mobilePreview(id)}
				</button>
			{/each}
		</div>
	</div>
{:else}
	<div class="relative h-screen w-screen overflow-hidden bg-bg" role="application" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
		{#if showCamera}
			<CameraFeed onReady={onCameraReady} />
		{/if}
		<div class="absolute inset-0 bg-black/40"></div>
		{#if showParticles}
			<Particles {ambientMode} />
		{/if}

		<div class="relative z-10 flex h-full flex-col">
			<header class="flex items-center justify-between p-5 transition-opacity duration-700" style="animation: hud-fade-in 0.3s ease-out both; {ambientMode ? 'opacity: 0.3' : ''}">
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<div class="h-3 w-3 rounded-sm border border-hud-cyan/40 bg-hud-cyan/20 {connected ? '' : 'opacity-30'}"
							style={connected ? 'animation: hud-pulse 2s ease-in-out infinite' : ''}></div>
						<span class="font-mono text-sm font-semibold tracking-[0.2em] text-hud-cyan">NEBULA</span>
					</div>
					{#if snapshots.length > 0}
						<StatusBadge
							status={allHealthy ? 'healthy' : 'degraded'}
							label="{snapshots.filter((s) => s.service.status === 'healthy').length}/{snapshots.length} systems"
						/>
					{/if}
					<div class="flex items-center gap-1.5">
						<span class="h-1.5 w-1.5 rounded-full {neroConnected ? 'bg-hud-green' : 'bg-text-dim/30'}" style={neroConnected ? 'animation: hud-pulse 2s ease-in-out infinite' : ''}></span>
						<span class="font-mono text-[10px] uppercase tracking-wider {neroConnected ? 'text-hud-green' : 'text-text-dim'}">nero</span>
					</div>
				</div>

				<div class="flex items-center gap-3">
					{#if clapEnabled}
						<span class="flex items-center gap-1.5">
							<span class="h-1.5 w-1.5 rounded-full bg-hud-purple" style="animation: hud-pulse 1.5s ease-in-out infinite"></span>
							<span class="font-mono text-[10px] uppercase text-hud-purple">mic</span>
						</span>
					{/if}
					{#if loadingHands}
						<span class="font-mono text-[10px] text-hud-cyan" style="animation: hud-pulse 1s ease-in-out infinite">LOADING HAND MODEL...</span>
					{/if}
					{#if handTracking && tracker.hands.length > 0}
						<span class="flex items-center gap-1.5">
							<span class="h-1.5 w-1.5 rounded-full bg-hud-green" style="animation: hud-pulse 1.5s ease-in-out infinite"></span>
							<span class="font-mono text-[10px] uppercase text-hud-green">
								{tracker.hands.length} hand{tracker.hands.length > 1 ? 's' : ''}
								{#if tracker.hands[0]?.gesture !== 'none'}
									/ {tracker.hands[0].gesture}
								{/if}
							</span>
						</span>
					{/if}
					<span class="font-mono text-xs tabular-nums text-text-dim">
						{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
					</span>
					<button class="{headerBtnClass} {soundOn ? headerBtnActive : headerBtnInactive}" onclick={toggleSound}>
						{soundOn ? 'sound on' : 'sound off'}
					</button>
					<button class="{headerBtnClass} {showParticles ? headerBtnActive : headerBtnInactive}" onclick={() => (showParticles = !showParticles)}>
						{showParticles ? 'fx on' : 'fx off'}
					</button>
					<button class="{headerBtnClass} {headerBtnInactive}" onclick={toggleCamera}>
						{showCamera ? 'cam on' : 'cam off'}
					</button>
					<button
						class="{headerBtnClass} {handTracking ? headerBtnActive : headerBtnInactive}"
						onclick={toggleHands}
					>
						{handTracking ? 'hands on' : 'hands off'}
					</button>
				</div>
			</header>

			<div class="relative flex-1 flex flex-col items-center justify-center" style="perspective: 1200px">
				<div class="relative transition-all duration-500 ease-out" style="transform-style: preserve-3d; {focused ? 'width: 62%; height: 88%' : 'width: 44%; height: 75%'}">
					{#each panelIds as id, idx (id)}
						{@const dist = Math.abs(carouselOffset(idx))}
						{#if dist <= 3 || (focused && dist === 0)}
						<div
							class="absolute inset-0 transition-all duration-500 ease-out {focused && carouselOffset(idx) === 0 ? '' : 'pointer-events-none'}"
							style="transform-style: preserve-3d; transform: {carouselTransform(idx)}; opacity: {carouselOpacity(idx)};
								{carouselOffset(idx) === 0 && !focused ? 'box-shadow: 0 0 20px rgba(0, 229, 255, 0.12), inset 0 0 1px rgba(0, 229, 255, 0.2)' : ''}"
							ondblclick={() => { if (carouselOffset(idx) === 0) { focused = !focused; focused ? playGrab() : playRelease(); } }}
							role="button"
							tabindex="-1"
						>
							{@render panelContent(id, focused && carouselOffset(idx) === 0)}
						</div>
						{/if}
					{/each}
				</div>

				{#if !focused}
					<div class="mt-5 flex items-center gap-3" style="animation: hud-fade-in 0.3s ease-out both">
						<button
							class="flex h-7 w-7 items-center justify-center rounded border border-panel-border/40 font-mono text-xs text-text-dim/60 transition-colors hover:border-hud-cyan/40 hover:text-hud-cyan"
							onclick={() => carouselNav(-1)}
						>&larr;</button>
						<div class="flex gap-1">
							{#each panelIds as id, idx}
								<button
									class="flex items-center justify-center rounded px-2 py-1 transition-all duration-300 {idx === carouselIndex ? 'bg-hud-cyan/10 border border-hud-cyan/20' : 'border border-transparent hover:bg-white/[0.03]'}"
									onclick={() => { playSwipe(idx > carouselIndex ? 'right' : 'left'); carouselIndex = idx; }}
									aria-label={id}
								>
									<span class="font-mono text-[9px] uppercase tracking-wider {idx === carouselIndex ? 'text-hud-cyan' : 'text-text-dim/35'}">{panelLabels[id] ?? id}</span>
								</button>
							{/each}
						</div>
						<button
							class="flex h-7 w-7 items-center justify-center rounded border border-panel-border/40 font-mono text-xs text-text-dim/60 transition-colors hover:border-hud-cyan/40 hover:text-hud-cyan"
							onclick={() => carouselNav(1)}
						>&rarr;</button>
					</div>
					<div class="mt-2 font-mono text-[9px] text-text-dim/25 tracking-wide">
						enter to focus / arrows to browse
					</div>
				{:else}
					<button
						class="mt-3 font-mono text-[9px] text-text-dim/40 hover:text-text-dim transition-colors"
						onclick={() => { focused = false; playRelease(); }}
					>
						esc to close
					</button>
				{/if}
			</div>
		</div>

		{#if handTracking}
			<HandOverlay hands={tracker.hands} grabbed={false} />
		{/if}

		{#if showHelp}
			<div
				class="absolute inset-0 z-50 flex items-center justify-center bg-black/60"
				onclick={() => showHelp = false}
				onkeydown={() => {}}
				role="button"
				tabindex="-1"
			>
				<div class="rounded-lg border border-panel-border bg-surface/95 p-6 font-mono text-sm" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog" tabindex="-1">
					<div class="mb-4 text-xs font-semibold tracking-[0.2em] text-hud-cyan">KEYBOARD SHORTCUTS</div>
					<div class="space-y-2 text-text-secondary">
						<div class="flex justify-between gap-8"><span>Toggle hands</span><span class="text-text">H</span></div>
						<div class="flex justify-between gap-8"><span>Toggle sound</span><span class="text-text">S</span></div>
						<div class="flex justify-between gap-8"><span>Toggle camera</span><span class="text-text">C</span></div>
						<div class="flex justify-between gap-8"><span>Toggle particles</span><span class="text-text">P</span></div>
						<div class="flex justify-between gap-8"><span>Cycle theme</span><span class="text-text">T</span></div>
						<div class="flex justify-between gap-8"><span>Toggle ambient / clock</span><span class="text-text">A</span></div>
						<div class="flex justify-between gap-8"><span>Carousel prev / next</span><span class="text-text">&larr; &rarr;</span></div>
						<div class="flex justify-between gap-8"><span>Focus / unfocus panel</span><span class="text-text">ENTER</span></div>
						<div class="flex justify-between gap-8"><span>Push to kiosk (focused)</span><span class="text-text">K</span></div>
						<div class="flex justify-between gap-8"><span>Double-clap ambient</span><span class="text-text">M</span></div>
						<div class="flex justify-between gap-8"><span>Command palette</span><span class="text-text">/</span></div>
						<div class="flex justify-between gap-8"><span>This menu</span><span class="text-text">?</span></div>
						<div class="flex justify-between gap-8"><span>Close / unfocus</span><span class="text-text">ESC</span></div>
					</div>
					<div class="mt-4 border-t border-panel-border pt-3 text-xs text-text-dim">
						<div class="mb-2 font-semibold tracking-[0.15em] text-hud-cyan/70">GESTURES</div>
						<div class="space-y-1">
							<div>Open palm swipe to navigate carousel</div>
							<div>Pinch to focus panel</div>
							<div>Hold peace sign to push to kiosk</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if ambientMode}
			<div class="absolute bottom-6 left-6 z-20 flex items-center gap-2 transition-opacity duration-700" style="animation: hud-fade-in 0.5s ease-out both">
				<span class="h-1.5 w-1.5 rounded-full bg-hud-cyan/40" style="animation: hud-pulse 3s ease-in-out infinite"></span>
				<span class="font-mono text-[9px] uppercase tracking-widest text-text-dim/30">ambient</span>
			</div>
		{/if}

		{#if kioskPushFlash}
			<div class="absolute inset-x-0 top-16 z-50 flex justify-center" style="animation: hud-fade-in 0.2s ease-out both">
				<div class="flex items-center gap-2 rounded border border-hud-green/40 bg-panel/90 px-4 py-2 backdrop-blur-sm">
					<svg class="h-3.5 w-3.5 text-hud-green" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="9" rx="1"/><line x1="8" y1="12" x2="8" y2="14"/><line x1="5" y1="14" x2="11" y2="14"/></svg>
					<span class="font-mono text-[11px] uppercase tracking-wider text-hud-green">pushed to kiosk</span>
				</div>
			</div>
		{/if}

		<svg class="pointer-events-none absolute inset-0 h-full w-full" style="animation: hud-fade-in 0.6s ease-out 0.5s both">
			<line x1="0" y1="1" x2="100%" y2="1" stroke="rgba(77, 168, 255, 0.15)" stroke-width="1" />
			<line x1="0" y1="100%" x2="100%" y2="100%" stroke="rgba(77, 168, 255, 0.15)" stroke-width="1" transform="translate(0, -1)" />
			<line x1="1" y1="0" x2="1" y2="100%" stroke="rgba(77, 168, 255, 0.15)" stroke-width="1" />
			<line x1="100%" y1="0" x2="100%" y2="100%" stroke="rgba(77, 168, 255, 0.15)" stroke-width="1" transform="translate(-1, 0)" />

			<rect x="8" y="8" width="16" height="16" fill="none" stroke="rgba(77, 168, 255, 0.3)" stroke-width="1" />
			<rect x="calc(100% - 24px)" y="8" width="16" height="16" fill="none" stroke="rgba(77, 168, 255, 0.3)" stroke-width="1" />
			<rect x="8" y="calc(100% - 24px)" width="16" height="16" fill="none" stroke="rgba(77, 168, 255, 0.3)" stroke-width="1" />
			<rect x="calc(100% - 24px)" y="calc(100% - 24px)" width="16" height="16" fill="none" stroke="rgba(77, 168, 255, 0.3)" stroke-width="1" />
		</svg>

		<ClockOverlay visible={ambientMode} {weather} />
	</div>
{/if}

{#if isToastVisible()}
	<div
		class="fixed top-6 left-1/2 z-[100] -translate-x-1/2 rounded border border-panel-border bg-surface/95 px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-accent backdrop-blur-sm"
		style="animation: hud-fade-in 0.15s ease-out both; box-shadow: 0 0 20px var(--color-glow)"
	>
		{getThemeLabel()}
	</div>
{/if}

<CommandPalette
	open={showPalette}
	{panelIds}
	{panelLabels}
	onNavigate={handlePaletteNavigate}
	onAction={handlePaletteAction}
	onClose={() => (showPalette = false)}
/>

<LofiPlayer {soundOn} />

{#snippet panelContent(id: string, isActive?: boolean)}
	{@const def = panelMap.get(id)}
	{#if def}
		{@const Component = def.component}
		<HudPanel title={def.label} panelId={id} class="h-full">
			<Component {...(def.getProps?.(getPanelCtx(isActive ?? false)) ?? {})} />
		</HudPanel>
	{/if}
{/snippet}

{#snippet panelInner(id: string)}
	{@const def = panelMap.get(id)}
	{#if def}
		{@const Component = def.component}
		<Component {...(def.getProps?.(getPanelCtx(false)) ?? {})} />
	{/if}
{/snippet}

{#snippet mobilePreview(id: string)}
	{#if id === 'hello'}
		<div class="flex items-baseline gap-3">
			<span class="font-mono text-sm tabular-nums text-text-secondary">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
			<span class="font-mono text-[9px] text-text-dim/40">{now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span>
		</div>
	{:else if id === 'vitals' && metrics.length > 0}
		<div class="flex flex-wrap gap-x-4 gap-y-1">
			{#each metrics.slice(0, 4) as { card, data, serviceName }}
				{@const m = data as MetricData}
				<div class="flex items-baseline gap-1.5">
					<span class="font-mono text-[9px] text-text-dim/50">{card.title}</span>
					<span class="font-mono text-[11px] tabular-nums text-text-secondary">{m.value}<span class="text-[8px] text-text-dim/40">{m.unit}</span></span>
				</div>
			{/each}
		</div>
	{:else if id === 'capacity' && progress.length > 0}
		<div class="flex w-full gap-2">
			{#each progress.slice(0, 3) as { card, data, service }}
				{@const p = data as ProgressData}
				{@const pct = p.max > 0 ? Math.round((p.value / p.max) * 100) : 0}
				<div class="flex-1">
					<div class="mb-1 flex items-baseline justify-between">
						<span class="font-mono text-[8px] text-text-dim/40 truncate">{card.title}</span>
						<span class="font-mono text-[9px] tabular-nums text-text-dim/60">{pct}%</span>
					</div>
					<div class="h-1 w-full overflow-hidden rounded-full bg-white/5">
						<div class="h-full rounded-full" style="width: {pct}%; background: {service.color}"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if id === 'charts' && timeseries.length > 0}
		<div class="flex items-center gap-3">
			{#each timeseries.slice(0, 3) as { card, data }}
				{@const t = data as TimeseriesData}
				{@const latest = t.points[t.points.length - 1] ?? 0}
				<div class="flex items-baseline gap-1.5">
					<span class="font-mono text-[9px] text-text-dim/50">{card.title}</span>
					<span class="font-mono text-[11px] tabular-nums text-text-secondary">{latest}<span class="text-[8px] text-text-dim/40">{t.unit}</span></span>
				</div>
			{/each}
		</div>
	{:else if id === 'system' && snapshots.length > 0}
		<div class="flex flex-wrap gap-x-3 gap-y-1">
			{#each snapshots as { service }}
				<div class="flex items-center gap-1.5">
					<span class="h-1.5 w-1.5 rounded-full" style="background: {service.color}"></span>
					<span class="font-mono text-[9px] {service.status === 'healthy' ? 'text-text-dim/60' : 'text-hud-yellow'}">{service.name}</span>
				</div>
			{/each}
		</div>
	{:else}
		{@const def = panelMap.get(id)}
		<span class="font-mono text-[9px] text-text-dim/40">{def?.label ?? id}</span>
	{/if}
{/snippet}
