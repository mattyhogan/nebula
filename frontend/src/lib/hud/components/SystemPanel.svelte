<script lang="ts">
	import type { ServiceSnapshot, TableData } from '$lib/types';
	import TableCard from './TableCard.svelte';

	let { snapshots = [], tables = [] }: { snapshots: ServiceSnapshot[]; tables: { card: any; data: any }[] } = $props();
</script>

<div class="space-y-2.5">
	{#each snapshots as { service }}
		<div class="flex items-center gap-2.5 rounded-md bg-white/[0.03] px-3 py-2">
			<span class="h-2 w-2 rounded-full" style="background: {service.color}; box-shadow: 0 0 8px {service.color}40"></span>
			<span class="font-mono text-sm text-text">{service.name}</span>
			<span class="ml-auto font-mono text-[10px] uppercase tracking-wider {service.status === 'healthy' ? 'text-hud-green' : 'text-hud-yellow'}">{service.status}</span>
		</div>
	{/each}
	{#each tables as { card, data }}
		<TableCard title={card.title} data={data as TableData} />
	{/each}
</div>
