<script lang="ts">
	import type { MetricData } from '$lib/types';
	import MetricCard from './MetricCard.svelte';

	let { metrics = [] }: { metrics: { card: any; data: any; serviceName: string }[] } = $props();
</script>

{#if metrics.length > 0}
	<div class="space-y-2.5">
		{#each metrics as { card, data, serviceName }}
			<MetricCard title={card.title} data={data as MetricData} service={serviceName} />
		{/each}
	</div>
{:else}
	<div class="flex h-full items-center justify-center"><span class="font-mono text-[10px] text-text-dim">waiting for data</span></div>
{/if}
