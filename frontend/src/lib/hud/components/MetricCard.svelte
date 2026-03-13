<script lang="ts">
	import type { MetricData } from '$lib/types';

	let { title, data, service }: { title: string; data: MetricData; service?: string } = $props();

	function color(value: number, thresholds?: { warn: number; crit: number }): string {
		if (!thresholds) return 'text-text';
		if (value >= thresholds.crit) return 'text-hud-red';
		if (value >= thresholds.warn) return 'text-hud-yellow';
		return 'text-hud-green';
	}

	function glowColor(value: number, thresholds?: { warn: number; crit: number }): string {
		if (!thresholds) return 'transparent';
		if (value >= thresholds.crit) return 'rgba(255, 82, 82, 0.15)';
		if (value >= thresholds.warn) return 'rgba(255, 215, 64, 0.1)';
		return 'transparent';
	}
</script>

<div class="flex items-baseline justify-between rounded-md bg-white/[0.03] px-3 py-2.5" style="box-shadow: inset 0 0 20px {glowColor(data.value, data.thresholds)}">
	<div class="flex flex-col gap-0.5">
		<span class="font-mono text-[10px] uppercase tracking-widest text-text-dim/60">{title}</span>
		{#if service}<span class="font-mono text-[9px] text-text-dim/40">{service}</span>{/if}
	</div>
	<span class="font-mono text-2xl font-semibold tabular-nums {color(data.value, data.thresholds)}">
		{data.value}<span class="ml-0.5 text-xs font-normal text-text-dim/40">{data.unit}</span>
	</span>
</div>
