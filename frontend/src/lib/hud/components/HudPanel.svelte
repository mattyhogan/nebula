<script lang="ts">
	import type { Snippet } from 'svelte';
	import { startKiosk } from '$lib/api';

	let { title, panelId, children, class: className = '' }: { title?: string; panelId?: string; children: Snippet; class?: string } = $props();

	let pushing = $state(false);

	async function pushToKiosk() {
		if (!panelId || pushing) return;
		pushing = true;
		try {
			await startKiosk(`${window.location.origin}?panel=${panelId}&kiosk`);
		} catch {}
		setTimeout(() => { pushing = false; }, 1500);
	}
</script>

<div
	class="flex flex-col overflow-hidden rounded-lg border border-panel-border bg-panel {className}"
	style="animation: hud-fade-in 0.4s ease-out both; box-shadow: 0 0 16px rgba(77, 168, 255, 0.08), inset 0 0 12px rgba(77, 168, 255, 0.03)"
>
	{#if title}
		<div class="relative flex shrink-0 items-center gap-2.5 border-b border-panel-border/60 px-4 py-2.5">
			<div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-hud-cyan/25 to-transparent"></div>
			<span class="h-1.5 w-1.5 rounded-full bg-hud-cyan/80" style="box-shadow: 0 0 6px rgba(0, 229, 255, 0.4); animation: hud-pulse 2s ease-in-out infinite"></span>
			<span class="flex-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-hud-cyan/90">{title}</span>
			{#if panelId}
				<button
					onclick={pushToKiosk}
					class="flex items-center gap-1 rounded border border-panel-border/50 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-text-dim/40 transition-all hover:border-hud-cyan/30 hover:text-hud-cyan/70 {pushing ? 'border-hud-green/40 text-hud-green/60' : ''}"
					title="Push to kiosk display"
				>
					{#if pushing}
						<svg class="h-2.5 w-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
						sent
					{:else}
						<svg class="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="9" rx="1"/><line x1="8" y1="12" x2="8" y2="14"/><line x1="5" y1="14" x2="11" y2="14"/></svg>
						kiosk
					{/if}
				</button>
			{/if}
		</div>
	{/if}
	<div class="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
		{@render children()}
	</div>
</div>
