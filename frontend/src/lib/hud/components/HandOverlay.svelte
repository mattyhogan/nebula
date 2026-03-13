<script lang="ts">
	import type { HandState } from '$lib/hud/hands.svelte';

	let { hands, grabbed }: { hands: HandState[]; grabbed: boolean } = $props();

	function cursorColor(hand: HandState): string {
		if (hand.pinching && grabbed) return '#00e676';
		if (hand.pinching) return '#00e5ff';
		if (hand.gesture === 'fist') return '#ff5252';
		if (hand.gesture === 'open') return 'rgba(77, 168, 255, 0.5)';
		if (hand.gesture === 'point') return 'rgba(255, 215, 64, 0.6)';
		if (hand.gesture === 'peace') return 'rgba(179, 136, 255, 0.6)';
		return 'rgba(77, 168, 255, 0.4)';
	}

	function gestureLabel(hand: HandState): string {
		if (hand.pinching && grabbed) return 'GRAB';
		if (hand.pinching) return 'PINCH';
		if (hand.gesture === 'none') return '';
		return hand.gesture.toUpperCase();
	}
</script>

<svg class="pointer-events-none absolute inset-0 z-20 h-full w-full">
	{#each hands as hand}
		{@const cx = hand.pinchX * 100}
		{@const cy = hand.pinchY * 100}
		{@const r = hand.pinching ? 1.2 : 1.8}
		{@const color = cursorColor(hand)}
		{@const label = gestureLabel(hand)}

		<circle
			cx="{cx}%"
			cy="{cy}%"
			r="{r}%"
			fill="none"
			stroke={color}
			stroke-width="1.5"
			opacity={hand.pinching ? 1 : 0.6}
		/>

		{#if hand.pinching}
			<circle cx="{cx}%" cy="{cy}%" r="0.4%" fill={color} />
			<circle
				cx="{cx}%"
				cy="{cy}%"
				r="{r + 0.8}%"
				fill="none"
				stroke={color}
				stroke-width="0.5"
				opacity="0.3"
				style="animation: hud-pulse 1s ease-in-out infinite"
			/>
		{/if}

		{#each [hand.landmarks[4], hand.landmarks[8]] as tip}
			<circle cx="{tip.x * 100}%" cy="{tip.y * 100}%" r="0.25%" fill={color} opacity="0.6" />
		{/each}

		{#if !hand.pinching}
			<line
				x1="{hand.landmarks[4].x * 100}%"
				y1="{hand.landmarks[4].y * 100}%"
				x2="{hand.landmarks[8].x * 100}%"
				y2="{hand.landmarks[8].y * 100}%"
				stroke={color}
				stroke-width="0.5"
				stroke-dasharray="4 3"
				opacity="0.3"
			/>
		{/if}

		{#if label}
			<text
				x="{cx}%"
				y="{cy - r - 1.2}%"
				text-anchor="middle"
				fill={color}
				font-family="var(--font-mono)"
				font-size="9"
				letter-spacing="0.1em"
			>{label}</text>
		{/if}
	{/each}
</svg>
