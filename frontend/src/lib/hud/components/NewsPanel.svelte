<script lang="ts">
	import { getNews, type NewsItem } from '$lib/api';

	let items: NewsItem[] = $state([]);
	let loaded = $state(false);
	let expandedIdx: number | null = $state(null);

	const sourceColors: Record<string, string> = {
		'HN': 'bg-amber-500/20 text-amber-400',
		'WSJ': 'bg-sky-500/15 text-sky-400',
		'TC': 'bg-emerald-500/15 text-emerald-400',
		'Reuters': 'bg-orange-500/15 text-orange-400',
		'Verge': 'bg-purple-500/15 text-purple-400',
	};

	const sourceDots: Record<string, string> = {
		'HN': 'bg-amber-400',
		'WSJ': 'bg-sky-400',
		'TC': 'bg-emerald-400',
		'Reuters': 'bg-orange-400',
		'Verge': 'bg-purple-400',
	};

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	}

	$effect(() => {
		getNews().then((n) => { items = n; loaded = true; }).catch(() => { loaded = true; });
		const id = setInterval(() => {
			getNews().then((n) => (items = n)).catch(() => {});
		}, 15 * 60 * 1000);
		return () => clearInterval(id);
	});
</script>

<div class="flex h-full flex-col overflow-y-auto pr-1" style="scrollbar-width: thin; scrollbar-color: rgba(77,168,255,0.12) transparent">
	{#if !loaded}
		<div class="flex h-full items-center justify-center">
			<span class="font-mono text-[10px] text-text-dim" style="animation: hud-pulse 1s ease-in-out infinite">loading feed...</span>
		</div>
	{:else if items.length === 0}
		<div class="flex h-full items-center justify-center">
			<span class="font-mono text-[10px] text-text-dim">no stories</span>
		</div>
	{:else}
		<div class="space-y-1">
			{#each items as item, i}
				<a
					href={item.url}
					target="_blank"
					rel="noopener"
					class="group block rounded-lg px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.04]"
					style="animation: hud-fade-in 0.15s ease-out {i * 0.02}s both"
					onmouseenter={() => expandedIdx = i}
					onmouseleave={() => expandedIdx = null}
				>
					<div class="flex items-start gap-2.5">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full {sourceDots[item.source] ?? 'bg-text-dim/40'}"></span>
						<div class="flex-1 min-w-0">
							<h3 class="text-[13px] font-medium leading-snug text-text/90 group-hover:text-hud-cyan transition-colors duration-200">{item.title}</h3>

							{#if item.summary}
								<p class="mt-1 text-[11px] leading-relaxed text-text-dim/50 line-clamp-2">{item.summary}</p>
							{/if}

							<div class="mt-1.5 flex items-center gap-2">
								<span class="inline-flex rounded-full px-1.5 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider {sourceColors[item.source] ?? 'bg-white/5 text-text-dim'}">{item.source}</span>
								<span class="font-mono text-[9px] text-text-dim/30">{timeAgo(item.published)}</span>
								{#if item.score}
									<span class="font-mono text-[9px] tabular-nums text-amber-400/40">{item.score} pts</span>
								{/if}
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
