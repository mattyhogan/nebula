<script lang="ts">
	import type { TableData } from '$lib/types';

	let { title, data }: { title: string; data: TableData } = $props();
</script>

<div class="rounded-md bg-white/[0.03] px-3 py-2.5">
	<span class="mb-2 block font-mono text-[10px] uppercase tracking-widest text-text-dim/60">{title}</span>
	{#each data.rows as row, i}
		<div class="flex items-center justify-between gap-3 py-1.5 transition-colors hover:bg-white/[0.02] {i < data.rows.length - 1 ? 'border-b border-white/[0.04]' : ''}">
			<span class="shrink-0 font-mono text-[11px] text-text-dim/60">{row.key}</span>
			<span class="truncate font-mono text-[11px] tabular-nums text-text">{row.value}</span>
		</div>
	{/each}
</div>
