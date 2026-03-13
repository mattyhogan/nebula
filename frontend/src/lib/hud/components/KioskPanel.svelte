<script lang="ts">
	import {
		getStatus,
		startKiosk,
		stopKiosk,
		openTerminal,
		getFavorites,
		addFavorite,
		deleteFavorite,
		getZoom,
		setZoom,
		restartKiosk,
		type KioskMode,
		type Favorite,
		type FavoriteType
	} from '$lib/api';

	let status: KioskMode = $state('idle');
	let favorites: Favorite[] = $state([]);
	let zoom: number = $state(1.0);
	let urlInput = $state('');
	let cmdInput = $state('');
	let toast = $state('');
	let toastVisible = $state(false);
	let adding = $state(false);
	let favName = $state('');
	let favType: FavoriteType = $state('url');
	let favValue = $state('');

	const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

	function statusColor(s: KioskMode): string {
		if (s === 'browser') return 'text-hud-green';
		if (s === 'terminal') return 'text-hud-cyan';
		return 'text-text-dim';
	}

	function showToast(msg: string) {
		toast = msg;
		toastVisible = true;
		setTimeout(() => (toastVisible = false), 2000);
	}

	async function pollStatus() {
		try { status = await getStatus(); } catch {}
	}

	async function handleStart(url?: string) {
		try {
			const out = await startKiosk(url || undefined);
			showToast(out);
			pollStatus();
		} catch (e: any) { showToast('error: ' + e.message); }
	}

	async function handleStop() {
		try {
			const out = await stopKiosk();
			showToast(out);
			pollStatus();
		} catch (e: any) { showToast('error: ' + e.message); }
	}

	async function handleTerminal(command?: string) {
		try {
			const out = await openTerminal(command || undefined);
			showToast(out);
			pollStatus();
		} catch (e: any) { showToast('error: ' + e.message); }
	}

	async function handleRunFavorite(fav: Favorite) {
		if (fav.type === 'url') await handleStart(fav.value);
		else await handleTerminal(fav.value);
	}

	async function handleAddFavorite() {
		if (!favName.trim() || !favValue.trim()) { showToast('fill in all fields'); return; }
		try {
			favorites = await addFavorite(favName.trim(), favType, favValue.trim());
			adding = false;
			favName = '';
			favValue = '';
			showToast('saved');
		} catch (e: any) { showToast('error: ' + e.message); }
	}

	async function handleDeleteFavorite(id: string) {
		try {
			favorites = await deleteFavorite(id);
			showToast('removed');
		} catch (e: any) { showToast('error: ' + e.message); }
	}

	async function handleZoom(level: number) {
		try {
			await setZoom(level);
			zoom = level;
			showToast(`zoom ${level}x - restarting`);
			await restartKiosk();
			pollStatus();
		} catch (e: any) { showToast('error: ' + e.message); }
	}

	async function zoomStep(dir: number) {
		const idx = ZOOM_STEPS.indexOf(zoom);
		const next = idx === -1
			? (dir > 0 ? ZOOM_STEPS.find(z => z > zoom) ?? zoom : [...ZOOM_STEPS].reverse().find(z => z < zoom) ?? zoom)
			: ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir))];
		if (next !== zoom) await handleZoom(next);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT') {
				e.preventDefault();
				e.stopPropagation();
			}
		}
	}

	$effect(() => {
		pollStatus();
		getFavorites().then((f) => (favorites = f)).catch(() => {});
		getZoom().then((z) => (zoom = z)).catch(() => {});
		const interval = setInterval(pollStatus, 5000);
		return () => clearInterval(interval);
	});
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto pr-1" style="scrollbar-width: thin; scrollbar-color: rgba(77,168,255,0.15) transparent">
	<div class="flex items-center justify-between">
		<span class="font-mono text-xs uppercase tracking-wider {statusColor(status)}">{status}</span>
		<div class="flex gap-2">
			<button
				onclick={() => handleStart()}
				class="rounded border border-hud-green/30 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-hud-green transition-colors hover:border-hud-green/60 hover:bg-hud-green/5"
			>start</button>
			<button
				onclick={handleStop}
				class="rounded border border-hud-red/30 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-hud-red transition-colors hover:border-hud-red/60 hover:bg-hud-red/5"
			>stop</button>
		</div>
	</div>

	<div class="space-y-1">
		<span class="font-mono text-[10px] uppercase tracking-wider text-text-dim/50">zoom</span>
		<div class="flex items-center gap-2">
			<button
				onclick={() => zoomStep(-1)}
				class="flex h-8 w-8 items-center justify-center rounded border border-panel-border font-mono text-sm text-text-dim transition-colors hover:border-hud-cyan/40 hover:text-text"
			>-</button>
			<div class="flex flex-1 items-center justify-center gap-1">
				<span class="font-mono text-lg font-medium tabular-nums text-text">{zoom}</span>
				<span class="font-mono text-[11px] text-text-dim/50">x</span>
			</div>
			<button
				onclick={() => zoomStep(1)}
				class="flex h-8 w-8 items-center justify-center rounded border border-panel-border font-mono text-sm text-text-dim transition-colors hover:border-hud-cyan/40 hover:text-text"
			>+</button>
		</div>
		<div class="flex flex-wrap gap-1">
			{#each ZOOM_STEPS as step}
				<button
					onclick={() => handleZoom(step)}
					class="rounded px-2 py-1 font-mono text-[10px] tabular-nums transition-colors {step === zoom ? 'bg-hud-cyan/15 text-hud-cyan border border-hud-cyan/30' : 'border border-panel-border/50 text-text-dim/50 hover:text-text-dim hover:border-panel-border'}"
				>{step}x</button>
			{/each}
		</div>
	</div>

	<div class="flex gap-2">
		<input
			type="url"
			bind:value={urlInput}
			onkeydown={onKeydown}
			placeholder="https://..."
			class="flex-1 rounded border border-panel-border bg-black/30 px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim/40 focus:border-hud-cyan/40 focus:outline-none"
		/>
		<button
			onclick={() => { handleStart(urlInput); urlInput = ''; }}
			class="rounded border border-panel-border px-3 py-2 font-mono text-[11px] uppercase text-text-dim transition-colors hover:border-hud-cyan/40 hover:text-text"
		>go</button>
	</div>

	<div class="flex gap-2">
		<input
			type="text"
			bind:value={cmdInput}
			onkeydown={onKeydown}
			placeholder="terminal cmd"
			class="flex-1 rounded border border-panel-border bg-black/30 px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim/40 focus:border-hud-cyan/40 focus:outline-none"
		/>
		<button
			onclick={() => { handleTerminal(cmdInput); cmdInput = ''; }}
			class="rounded border border-panel-border px-3 py-2 font-mono text-[11px] uppercase text-text-dim transition-colors hover:border-hud-cyan/40 hover:text-text"
		>run</button>
	</div>

	<button
		onclick={() => handleTerminal()}
		class="w-full rounded border border-panel-border py-2 font-mono text-[11px] uppercase tracking-wider text-text-dim transition-colors hover:border-hud-cyan/40 hover:text-text hover:bg-white/[0.02]"
	>open terminal</button>

	<div class="mt-1">
		<div class="mb-2 flex items-center justify-between">
			<span class="font-mono text-[10px] uppercase tracking-wider text-text-dim/50">favorites</span>
			<button
				onclick={() => (adding = !adding)}
				class="font-mono text-[11px] text-hud-cyan/60 hover:text-hud-cyan transition-colors"
			>{adding ? 'cancel' : '+ add'}</button>
		</div>

		{#if adding}
			<div class="mb-3 space-y-2 rounded border border-hud-purple/20 bg-hud-purple/5 p-3">
				<input
					type="text"
					bind:value={favName}
					placeholder="name"
					class="w-full rounded border border-panel-border bg-black/30 px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim/40 focus:border-hud-cyan/40 focus:outline-none"
				/>
				<div class="flex gap-2">
					<select
						bind:value={favType}
						class="rounded border border-panel-border bg-black/30 px-3 py-2 font-mono text-xs text-text focus:outline-none"
					>
						<option value="url">url</option>
						<option value="command">cmd</option>
					</select>
					<input
						type="text"
						bind:value={favValue}
						placeholder="https://... or htop"
						class="flex-1 rounded border border-panel-border bg-black/30 px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim/40 focus:border-hud-cyan/40 focus:outline-none"
					/>
				</div>
				<button
					onclick={handleAddFavorite}
					class="w-full rounded border border-hud-cyan/30 py-2 font-mono text-[11px] uppercase tracking-wider text-hud-cyan transition-colors hover:border-hud-cyan/60 hover:bg-hud-cyan/5"
				>save</button>
			</div>
		{/if}

		<div class="space-y-1.5">
			{#each favorites as fav (fav.id)}
				<button
					onclick={() => handleRunFavorite(fav)}
					class="group flex w-full items-center justify-between rounded border border-panel-border/50 bg-black/20 px-3 py-2.5 text-left transition-colors hover:border-panel-border-hover hover:bg-white/[0.02]"
				>
					<div class="min-w-0">
						<span class="block font-mono text-xs text-text truncate">{fav.name}</span>
						<span class="block font-mono text-[9px] text-text-dim/40 truncate">{fav.type}: {fav.value}</span>
					</div>
					<span
						onclick={(e) => { e.stopPropagation(); handleDeleteFavorite(fav.id); }}
						onkeydown={() => {}}
						role="button"
						tabindex="-1"
						class="hidden font-mono text-sm text-text-dim/40 hover:text-hud-red group-hover:block"
					>&times;</span>
				</button>
			{/each}
		</div>
	</div>

	{#if toastVisible}
		<div class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded border border-panel-border bg-panel px-4 py-2 font-mono text-xs text-text shadow-lg">
			{toast}
		</div>
	{/if}
</div>
