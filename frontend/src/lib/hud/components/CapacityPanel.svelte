<script lang="ts">
	import type { ProgressData } from '$lib/types';
	import ProgressCard from './ProgressCard.svelte';

	let { progress = [] }: { progress: { card: any; data: any; service: any }[] } = $props();
</script>

{#if progress.length > 0}
	<div class="space-y-2.5">
		{#each progress as { card, data, service }}
			<ProgressCard title={card.title} data={data as ProgressData} color={service.color} service={service.name} />
		{/each}
	</div>
{:else}
	<div class="flex h-full items-center justify-center"><span class="font-mono text-[10px] text-text-dim">waiting for data</span></div>
{/if}
