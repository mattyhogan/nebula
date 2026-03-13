<script lang="ts">
	import type { TimeseriesData } from '$lib/types';

	let { title, data, color = '#4da8ff', service }: { title: string; data: TimeseriesData; color?: string; service?: string } = $props();

	let pts = $derived(data.points.slice(-40));
	let latest = $derived(pts[pts.length - 1] ?? 0);
	let tMin = $derived(data.min ?? Math.min(...pts));
	let tMax = $derived(data.max ?? Math.max(...pts));

	function polyline(points: number[], w: number, h: number, min: number, max: number): string {
		const range = max - min || 1;
		return points
			.map((v, i) => {
				const x = points.length > 1 ? (i / (points.length - 1)) * w : w / 2;
				const y = h - 2 - ((v - min) / range) * (h - 4);
				return `${x},${y}`;
			})
			.join(' ');
	}

	function area(points: number[], w: number, h: number, min: number, max: number): string {
		return `0,${h} ${polyline(points, w, h, min, max)} ${w},${h}`;
	}

	const uid = $derived(`sg-${title}-${Math.random().toString(36).slice(2, 6)}`);
</script>

<div class="rounded-md bg-white/[0.03] px-3 py-2.5">
	<div class="mb-2 flex items-baseline justify-between">
		<div class="flex flex-col gap-0.5">
			<span class="font-mono text-[10px] uppercase tracking-widest text-text-dim/60">{title}</span>
			{#if service}<span class="font-mono text-[9px] text-text-dim/40">{service}</span>{/if}
		</div>
		<span class="font-mono text-lg font-semibold tabular-nums text-text">
			{latest}<span class="ml-0.5 text-[10px] font-normal text-text-dim/40">{data.unit}</span>
		</span>
	</div>
	<div class="relative">
		<svg viewBox="0 0 200 56" class="h-14 w-full" preserveAspectRatio="none">
			<defs>
				<linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.18" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>
			{#each [0.25, 0.5, 0.75] as frac}
				<line x1="0" y1={56 * frac} x2="200" y2={56 * frac} stroke="rgba(255,255,255,0.03)" stroke-width="1" />
			{/each}
			<polygon points={area(pts, 200, 56, tMin, tMax)} fill="url(#{uid})" />
			<polyline
				points={polyline(pts, 200, 56, tMin, tMax)}
				fill="none"
				stroke={color}
				stroke-width="1.5"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		</svg>
		<div class="absolute right-0 top-0 flex flex-col justify-between h-full pointer-events-none py-0.5">
			<span class="font-mono text-[8px] tabular-nums text-text-dim/25">{Math.round(tMax)}</span>
			<span class="font-mono text-[8px] tabular-nums text-text-dim/25">{Math.round(tMin)}</span>
		</div>
	</div>
</div>
