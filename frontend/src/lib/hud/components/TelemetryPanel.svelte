<script lang="ts">
	import type { TimeseriesData } from '$lib/types';
	import SparklineCard from './SparklineCard.svelte';

	let { timeseries = [] }: { timeseries: { card: any; data: any; service: any }[] } = $props();
</script>

{#if timeseries.length > 0}
	<div class="space-y-2.5">
		{#each timeseries as { card, data, service }}
			<SparklineCard title={card.title} data={data as TimeseriesData} color={service.color} service={service.name} />
		{/each}
	</div>
{:else}
	<div class="flex h-full items-center justify-center"><span class="font-mono text-[10px] text-text-dim">waiting for data</span></div>
{/if}
