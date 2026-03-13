<script lang="ts">
	import { getActivityHeatmap, type HeatmapDay } from '$lib/api';

	let days: HeatmapDay[] = $state([]);
	let loading = $state(true);
	let hoveredDay: { date: string; count: number; x: number; y: number } | null = $state(null);

	const WEEKS = 12;
	const TOTAL_DAYS = WEEKS * 7;
	const CELL_SIZE = 11;
	const CELL_GAP = 2;

	const maxCount = $derived(Math.max(1, ...days.map((d) => d.count)));

	const grid = $derived.by(() => {
		const today = new Date();
		const map = new Map<string, number>();
		for (const d of days) map.set(d.date, d.count);

		const cells: { date: string; count: number; col: number; row: number }[] = [];
		for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const dateStr = d.toISOString().slice(0, 10);
			const dayOfWeek = d.getDay();
			const daysFromEnd = i;
			const col = WEEKS - 1 - Math.floor(daysFromEnd / 7);
			const row = dayOfWeek;
			cells.push({ date: dateStr, count: map.get(dateStr) ?? 0, col, row });
		}
		return cells;
	});

	const monthLabels = $derived.by(() => {
		const today = new Date();
		const labels: { label: string; col: number }[] = [];
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		let lastMonth = -1;
		for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const month = d.getMonth();
			const col = WEEKS - 1 - Math.floor(i / 7);
			if (month !== lastMonth) {
				labels.push({ label: months[month], col });
				lastMonth = month;
			}
		}
		return labels;
	});

	function cellColor(count: number): string {
		if (count === 0) return 'rgba(255, 255, 255, 0.03)';
		const ratio = count / maxCount;
		if (ratio < 0.25) return 'rgba(0, 229, 255, 0.15)';
		if (ratio < 0.5) return 'rgba(0, 229, 255, 0.35)';
		if (ratio < 0.75) return 'rgba(0, 229, 255, 0.6)';
		return 'rgba(0, 230, 180, 0.85)';
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function onCellEnter(e: MouseEvent, cell: { date: string; count: number }) {
		const rect = (e.target as HTMLElement).getBoundingClientRect();
		const parent = (e.target as HTMLElement).closest('.heatmap-container')?.getBoundingClientRect();
		if (!parent) return;
		hoveredDay = {
			date: cell.date,
			count: cell.count,
			x: rect.left - parent.left + rect.width / 2,
			y: rect.top - parent.top - 4
		};
	}

	function onCellLeave() {
		hoveredDay = null;
	}

	async function refresh() {
		try {
			days = await getActivityHeatmap();
		} catch {}
		loading = false;
	}

	$effect(() => {
		refresh();
		const id = setInterval(refresh, 5 * 60 * 1000);
		return () => clearInterval(id);
	});

	const LEFT_PAD = 20;
	const TOP_PAD = 14;
	const gridW = $derived(WEEKS * (CELL_SIZE + CELL_GAP));
	const gridH = $derived(7 * (CELL_SIZE + CELL_GAP));
</script>

<div class="heatmap-container relative flex h-full flex-col gap-3">
	{#if loading && days.length === 0}
		<div class="flex flex-1 items-center justify-center">
			<span class="font-mono text-[10px] text-text-dim/30" style="animation: hud-pulse 1.5s ease-in-out infinite">loading activity...</span>
		</div>
	{:else if days.length === 0}
		<div class="flex flex-1 items-center justify-center">
			<span class="font-mono text-[10px] text-text-dim/30">no activity data available</span>
		</div>
	{:else}
		<div class="relative overflow-hidden rounded-md border border-panel-border/20 bg-white/[0.015] p-3">
			{#if hoveredDay}
				<div
					class="pointer-events-none absolute z-10 rounded border border-panel-border bg-panel px-2 py-1 font-mono text-[9px] text-text-dim whitespace-nowrap"
					style="left: {hoveredDay.x}px; top: {hoveredDay.y}px; transform: translate(-50%, -100%)"
				>
					<span class="text-hud-cyan">{hoveredDay.count}</span> on {formatDate(hoveredDay.date)}
				</div>
			{/if}

			<svg
				width={LEFT_PAD + gridW + 4}
				height={TOP_PAD + gridH + 4}
				class="w-full"
				viewBox="0 0 {LEFT_PAD + gridW + 4} {TOP_PAD + gridH + 4}"
				preserveAspectRatio="xMidYMid meet"
			>
				{#each monthLabels as { label, col }}
					<text
						x={LEFT_PAD + col * (CELL_SIZE + CELL_GAP)}
						y={10}
						class="fill-current text-text-dim/40"
						font-family="monospace"
						font-size="8"
					>{label}</text>
				{/each}

				<text x="0" y={TOP_PAD + 1 * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2} class="fill-current text-text-dim/30" font-family="monospace" font-size="7">M</text>
				<text x="0" y={TOP_PAD + 3 * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2} class="fill-current text-text-dim/30" font-family="monospace" font-size="7">W</text>
				<text x="0" y={TOP_PAD + 5 * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2} class="fill-current text-text-dim/30" font-family="monospace" font-size="7">F</text>

				{#each grid as cell}
					<rect
						x={LEFT_PAD + cell.col * (CELL_SIZE + CELL_GAP)}
						y={TOP_PAD + cell.row * (CELL_SIZE + CELL_GAP)}
						width={CELL_SIZE}
						height={CELL_SIZE}
						rx="2"
						fill={cellColor(cell.count)}
						role="presentation"
						class="cursor-pointer transition-opacity duration-100 hover:opacity-80"
						onmouseenter={(e) => onCellEnter(e, cell)}
						onmouseleave={onCellLeave}
					/>
				{/each}
			</svg>
		</div>

		<div class="flex items-center gap-2 font-mono text-[9px] text-text-dim/30">
			<span>less</span>
			<div class="flex gap-0.5">
				<span class="inline-block h-[10px] w-[10px] rounded-sm" style="background: rgba(255, 255, 255, 0.03)"></span>
				<span class="inline-block h-[10px] w-[10px] rounded-sm" style="background: rgba(0, 229, 255, 0.15)"></span>
				<span class="inline-block h-[10px] w-[10px] rounded-sm" style="background: rgba(0, 229, 255, 0.35)"></span>
				<span class="inline-block h-[10px] w-[10px] rounded-sm" style="background: rgba(0, 229, 255, 0.6)"></span>
				<span class="inline-block h-[10px] w-[10px] rounded-sm" style="background: rgba(0, 230, 180, 0.85)"></span>
			</div>
			<span>more</span>
		</div>

		<div class="font-mono text-[9px] text-text-dim/20 tracking-wide">
			{days.filter((d) => d.count > 0).length} active days / {TOTAL_DAYS} total
		</div>
	{/if}
</div>
