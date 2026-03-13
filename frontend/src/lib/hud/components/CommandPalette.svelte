<script lang="ts">
	let {
		open,
		panelIds,
		panelLabels,
		onNavigate,
		onAction,
		onClose
	}: {
		open: boolean;
		panelIds: string[];
		panelLabels: Record<string, string>;
		onNavigate: (panelId: string) => void;
		onAction: (action: string) => void;
		onClose: () => void;
	} = $props();

	type ResultItem = {
		id: string;
		label: string;
		type: 'panel' | 'action' | 'command';
		prefix: string;
	};

	let query = $state('');
	let selectedIndex = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();

	const actions: ResultItem[] = [
		{ id: 'toggle-sound', label: 'Toggle Sound', type: 'action', prefix: 'ACT' },
		{ id: 'toggle-camera', label: 'Toggle Camera', type: 'action', prefix: 'ACT' },
		{ id: 'toggle-hands', label: 'Toggle Hands', type: 'action', prefix: 'ACT' },
		{ id: 'toggle-particles', label: 'Toggle Particles', type: 'action', prefix: 'ACT' },
		{ id: 'toggle-view', label: 'Toggle View Mode', type: 'action', prefix: 'ACT' },
	];

	const commands: ResultItem[] = [
		{ id: 'help', label: 'Help', type: 'command', prefix: 'CMD' },
	];

	let allItems = $derived<ResultItem[]>([
		...panelIds.map((id) => ({
			id,
			label: panelLabels[id] ?? id,
			type: 'panel' as const,
			prefix: 'PNL',
		})),
		...actions,
		...commands,
	]);

	let results = $derived(filterItems(query, allItems));

	function filterItems(q: string, items: ResultItem[]): ResultItem[] {
		const needle = q.toLowerCase().trim();
		if (!needle) return items.slice(0, 8);
		return items
			.filter((item) => item.label.toLowerCase().includes(needle) || item.id.toLowerCase().includes(needle))
			.slice(0, 8);
	}

	$effect(() => {
		if (open) {
			query = '';
			selectedIndex = 0;
			requestAnimationFrame(() => inputEl?.focus());
		}
	});

	$effect(() => {
		query;
		selectedIndex = 0;
	});

	function highlightMatch(text: string, q: string): string {
		if (!q.trim()) return text;
		const lower = text.toLowerCase();
		const idx = lower.indexOf(q.toLowerCase());
		if (idx === -1) return text;
		const before = text.slice(0, idx);
		const match = text.slice(idx, idx + q.length);
		const after = text.slice(idx + q.length);
		return `${before}<span class="text-hud-cyan">${match}</span>${after}`;
	}

	function execute(item: ResultItem) {
		if (item.type === 'panel') {
			onNavigate(item.id);
		} else {
			onAction(item.id);
		}
		onClose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			onClose();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % results.length;
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + results.length) % results.length;
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			if (results[selectedIndex]) {
				execute(results[selectedIndex]);
			}
			return;
		}
	}

	function prefixColor(type: string): string {
		if (type === 'panel') return 'text-hud-cyan/60';
		if (type === 'action') return 'text-hud-green/60';
		return 'text-hud-yellow/60';
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm pt-[18vh]"
		onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		onkeydown={() => {}}
		role="button"
		tabindex="-1"
		style="animation: cp-backdrop-in 0.15s ease-out both"
	>
		<div
			class="w-full max-w-md rounded-lg border border-panel-border/60 bg-surface/95 shadow-2xl"
			style="animation: cp-panel-in 0.2s ease-out both; box-shadow: 0 0 40px rgba(0, 229, 255, 0.08), 0 0 80px rgba(0, 0, 0, 0.5)"
		>
			<div class="flex items-center gap-3 border-b border-panel-border/40 px-4 py-3">
				<span class="font-mono text-[10px] font-semibold tracking-[0.2em] text-hud-cyan/50">&#9655;</span>
				<input
					bind:this={inputEl}
					bind:value={query}
					onkeydown={onKeydown}
					type="text"
					placeholder="search panels, actions..."
					class="flex-1 bg-transparent font-mono text-sm text-text placeholder:text-text-dim/30 outline-none caret-hud-cyan"
					spellcheck="false"
					autocomplete="off"
				/>
				<span class="rounded border border-panel-border/40 px-1.5 py-0.5 font-mono text-[9px] text-text-dim/30">ESC</span>
			</div>

			{#if results.length > 0}
				<div class="max-h-80 overflow-y-auto py-1.5">
					{#each results as item, i}
						<button
							class="group flex w-full items-center gap-3 px-4 py-2 text-left transition-all duration-150
								{i === selectedIndex ? 'bg-hud-cyan/[0.06] border-l-2 border-hud-cyan/50' : 'border-l-2 border-transparent hover:bg-white/[0.02]'}"
							onclick={() => execute(item)}
							onmouseenter={() => (selectedIndex = i)}
							style="animation: cp-result-in 0.15s ease-out {i * 0.03}s both"
						>
							<span class="w-7 rounded border border-panel-border/30 bg-white/[0.02] px-1 py-0.5 text-center font-mono text-[8px] font-semibold tracking-wider {prefixColor(item.type)}">
								{item.prefix}
							</span>
							<span class="flex-1 font-mono text-xs {i === selectedIndex ? 'text-text' : 'text-text-secondary'}">
								{@html highlightMatch(item.label, query)}
							</span>
							{#if i === selectedIndex}
								<span class="font-mono text-[9px] text-text-dim/30">&#9166;</span>
							{/if}
						</button>
					{/each}
				</div>
			{:else}
				<div class="px-4 py-6 text-center font-mono text-xs text-text-dim/40">
					no results
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	@keyframes cp-backdrop-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes cp-panel-in {
		from { opacity: 0; transform: translateY(-8px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
	@keyframes cp-result-in {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
