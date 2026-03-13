<script lang="ts">
	import type { ProgressData } from '$lib/types';

	let { title, data, color = '#4da8ff', service }: { title: string; data: ProgressData; color?: string; service?: string } = $props();

	let pct = $derived(data.max > 0 ? Math.round((data.value / data.max) * 100) : 0);
	let barColor = $derived(pct > 90 ? '#ff5252' : pct > 75 ? '#ffd740' : color);
</script>

<div class="rounded-md bg-white/[0.03] px-3 py-2.5">
	<div class="mb-2.5 flex items-baseline justify-between">
		<div class="flex flex-col gap-0.5">
			<span class="font-mono text-[10px] uppercase tracking-widest text-text-dim/60">{title}</span>
			{#if service}<span class="font-mono text-[9px] text-text-dim/40">{service}</span>{/if}
		</div>
		<div class="flex items-baseline gap-2">
			<span class="font-mono text-sm tabular-nums text-text-secondary">{data.label}</span>
			<span class="font-mono text-[10px] tabular-nums text-text-dim/40">{pct}%</span>
		</div>
	</div>
	<div class="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
		<div
			class="h-full rounded-full transition-all duration-700"
			style="width: {pct}%; background: linear-gradient(90deg, {color}, {barColor}); box-shadow: 0 0 10px {barColor}40"
		></div>
		{#each [25, 50, 75] as tick}
			<div class="absolute top-0 h-full w-px bg-white/[0.06]" style="left: {tick}%"></div>
		{/each}
	</div>
</div>
