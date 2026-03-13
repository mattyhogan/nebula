<script lang="ts">
	let { status, label }: { status: 'healthy' | 'degraded' | 'down'; label: string } = $props();

	let dotColor = $derived(
		status === 'healthy' ? 'bg-hud-green' : status === 'degraded' ? 'bg-hud-yellow' : 'bg-hud-red'
	);
	let textColor = $derived(
		status === 'healthy' ? 'text-hud-green' : status === 'degraded' ? 'text-hud-yellow' : 'text-hud-red'
	);
	let glowColor = $derived(
		status === 'healthy' ? 'rgba(0, 230, 118, 0.3)' : status === 'degraded' ? 'rgba(255, 215, 64, 0.3)' : 'rgba(255, 82, 82, 0.3)'
	);
</script>

<div class="flex items-center gap-2">
	<span class="h-2 w-2 rounded-full {dotColor}" style="box-shadow: 0 0 8px {glowColor}; animation: hud-pulse 2s ease-in-out infinite"></span>
	<span class="font-mono text-[11px] font-medium uppercase tracking-wider {textColor}">{label}</span>
</div>
