<script lang="ts">
	import { getNetwork, sendWol, type NetworkData, type NetworkDevice } from '$lib/api';

	let data: NetworkData | null = $state(null);
	let loading = $state(true);
	let selected: NetworkDevice | null = $state(null);
	let hoveredIndex: number | null = $state(null);
	let wolStatus: Record<string, 'sending' | 'sent' | 'failed'> = $state({});

	const CX = 200;
	const CY = 180;
	const RADIUS = 130;
	const VIEW_W = 400;
	const VIEW_H = 360;

	const vendorColors: Record<string, string> = {
		'Raspberry Pi': '#22c55e',
		'Apple': '#a78bfa',
		'Samsung': '#60a5fa',
		'Google': '#f59e0b',
		'Amazon': '#f97316',
		'Intel': '#06b6d4',
		'TP-Link': '#34d399',
		'Netgear': '#818cf8',
		'Synology': '#10b981',
		'Ubiquiti': '#3b82f6',
		'VMware': '#8b5cf6',
		'Microsoft (Hyper-V)': '#0ea5e9',
		'Espressif (ESP)': '#fbbf24',
		'Dell': '#64748b',
	};

	function colorForDevice(d: NetworkDevice): string {
		if (d.vendor && vendorColors[d.vendor]) return vendorColors[d.vendor];
		return 'rgb(0,229,255)';
	}

	const devicePositions = $derived.by(() => {
		if (!data || data.devices.length === 0) return [];
		const count = data.devices.length;
		return data.devices.map((device, i) => {
			const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
			const jitter = ((i * 7) % 11) / 11 * 0.15 + 0.85;
			const r = RADIUS * jitter;
			return {
				device,
				x: CX + Math.cos(angle) * r,
				y: CY + Math.sin(angle) * r,
				isGateway: data!.gateway !== null && device.ip === data!.gateway,
			};
		});
	});

	const deviceLabel = $derived.by(() => {
		return (d: NetworkDevice) => {
			if (d.hostname) {
				const h = d.hostname.replace(/\.local$/, '').replace(/\.lan$/, '');
				return h.length > 14 ? h.slice(0, 12) + '..' : h;
			}
			return d.ip.split('.').slice(-2).join('.');
		};
	});

	async function refresh() {
		try {
			const d = await getNetwork();
			if (d) data = d;
		} catch {}
		loading = false;
	}

	function handleNodeClick(device: NetworkDevice) {
		selected = selected?.mac === device.mac ? null : device;
	}

	async function handleWol(mac: string) {
		wolStatus[mac] = 'sending';
		const ok = await sendWol(mac);
		wolStatus[mac] = ok ? 'sent' : 'failed';
		setTimeout(() => { delete wolStatus[mac]; wolStatus = wolStatus; }, 2500);
	}

	$effect(() => {
		refresh();
		const id = setInterval(refresh, 60_000);
		return () => clearInterval(id);
	});
</script>

<div class="flex h-full flex-col gap-3">
	{#if data}
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="font-mono text-[11px] tabular-nums text-text-secondary">{data.devices.length}</span>
				<span class="font-mono text-[10px] uppercase tracking-wider text-text-dim/50">devices</span>
			</div>
			{#if data.gateway}
				<div class="flex items-center gap-1.5">
					<span class="font-mono text-[9px] uppercase tracking-wider text-text-dim/40">gw</span>
					<span class="font-mono text-[10px] tabular-nums text-text-dim/60">{data.gateway}</span>
				</div>
			{/if}
		</div>
	{/if}

	<div class="relative w-full overflow-hidden rounded-md border border-panel-border/20 bg-white/[0.015]" style="aspect-ratio: {VIEW_W}/{VIEW_H}">
		<svg viewBox="0 0 {VIEW_W} {VIEW_H}" class="h-full w-full" preserveAspectRatio="xMidYMid meet">
			<defs>
				<filter id="gw-glow">
					<feGaussianBlur stdDeviation="3" result="blur" />
					<feMerge>
						<feMergeNode in="blur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				<radialGradient id="gw-grad" cx="50%" cy="50%" r="50%">
					<stop offset="0%" stop-color="rgba(0,229,255,0.15)" />
					<stop offset="100%" stop-color="rgba(0,229,255,0)" />
				</radialGradient>
			</defs>

			{#each devicePositions as pos, i}
				<line
					x1={CX}
					y1={CY}
					x2={pos.x}
					y2={pos.y}
					stroke="rgba(0,229,255,0.08)"
					stroke-width="0.5"
					stroke-dasharray={pos.isGateway ? 'none' : '2,2'}
				/>
			{/each}

			<circle cx={CX} cy={CY} r="20" fill="url(#gw-grad)" />
			<circle cx={CX} cy={CY} r="7" fill="rgba(0,229,255,0.12)" filter="url(#gw-glow)" />
			<circle cx={CX} cy={CY} r="4" fill="rgb(0,229,255)" />
			<circle cx={CX} cy={CY} r="10" fill="none" stroke="rgba(0,229,255,0.15)" stroke-width="0.4" style="animation: hud-pulse 3s ease-in-out infinite" />
			<text x={CX} y={CY + 18} text-anchor="middle" fill="rgba(0,229,255,0.5)" font-family="JetBrains Mono, monospace" font-size="7">GATEWAY</text>

			{#each devicePositions as pos, i}
				{@const isHovered = hoveredIndex === i}
				{@const isSelected = selected?.mac === pos.device.mac}
				{@const nodeR = pos.isGateway ? 5 : 3.5}
				{@const color = colorForDevice(pos.device)}
				<g
					style="cursor: pointer"
					onpointerenter={() => hoveredIndex = i}
					onpointerleave={() => hoveredIndex = null}
					onclick={() => handleNodeClick(pos.device)}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNodeClick(pos.device); } }}
					role="button"
					tabindex="0"
				>
					{#if isHovered || isSelected}
						<circle cx={pos.x} cy={pos.y} r={nodeR + 6} fill="rgba(0,229,255,0.04)" />
						<line
							x1={CX}
							y1={CY}
							x2={pos.x}
							y2={pos.y}
							stroke="rgba(0,229,255,0.25)"
							stroke-width="1"
						/>
					{/if}

					<circle cx={pos.x} cy={pos.y} r={nodeR + 2} fill="none" stroke="{color}" stroke-opacity="0.15" stroke-width="0.4" style="animation: hud-pulse 2.5s ease-in-out {(i * 0.3) % 2}s infinite" />
					<circle cx={pos.x} cy={pos.y} r={nodeR} fill="{color}" fill-opacity="{isHovered || isSelected ? 0.9 : 0.6}" />

					<text
						x={pos.x}
						y={pos.y - nodeR - 4}
						text-anchor="middle"
						fill="rgba(255,255,255,{isHovered || isSelected ? 0.7 : 0.3})"
						font-family="JetBrains Mono, monospace"
						font-size="{isHovered || isSelected ? 8 : 7}"
					>{deviceLabel(pos.device)}</text>
				</g>
			{/each}
		</svg>

		{#if !data && loading}
			<div class="absolute inset-0 flex items-center justify-center">
				<span class="font-mono text-[10px] text-text-dim/30" style="animation: hud-pulse 1.5s ease-in-out infinite">scanning network...</span>
			</div>
		{/if}
	</div>

	{#if selected}
		<div class="rounded-md border border-panel-border/20 bg-white/[0.02] px-3 py-2.5 space-y-1.5" style="animation: hud-fade-in 0.2s ease-out both">
			<div class="flex items-center justify-between">
				<span class="font-mono text-[11px] text-text">{selected.hostname ?? selected.ip}</span>
				<div class="flex items-center gap-2">
					{#if selected.mac}
						<button
							onclick={() => handleWol(selected!.mac)}
							disabled={wolStatus[selected.mac] === 'sending'}
							class="font-mono text-[8px] uppercase tracking-wider transition-colors {wolStatus[selected.mac] === 'sent' ? 'text-emerald-400' : wolStatus[selected.mac] === 'failed' ? 'text-red-400' : wolStatus[selected.mac] === 'sending' ? 'text-cyan-400/50' : 'text-cyan-400/60 hover:text-cyan-300'}"
						>{wolStatus[selected.mac] === 'sent' ? 'wol sent' : wolStatus[selected.mac] === 'failed' ? 'wol fail' : wolStatus[selected.mac] === 'sending' ? 'sending...' : 'wol'}</button>
					{/if}
					<button
						onclick={() => selected = null}
						class="font-mono text-[8px] uppercase tracking-wider text-text-dim/30 hover:text-text-dim transition-colors"
					>close</button>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-x-4 gap-y-1">
				<div>
					<span class="font-mono text-[8px] uppercase tracking-wider text-text-dim/40">ip</span>
					<div class="font-mono text-[10px] tabular-nums text-text-secondary">{selected.ip}</div>
				</div>
				<div>
					<span class="font-mono text-[8px] uppercase tracking-wider text-text-dim/40">mac</span>
					<div class="font-mono text-[10px] tabular-nums text-text-secondary">{selected.mac}</div>
				</div>
				{#if selected.vendor}
					<div>
						<span class="font-mono text-[8px] uppercase tracking-wider text-text-dim/40">vendor</span>
						<div class="font-mono text-[10px] text-text-secondary">{selected.vendor}</div>
					</div>
				{/if}
				{#if selected.hostname}
					<div>
						<span class="font-mono text-[8px] uppercase tracking-wider text-text-dim/40">host</span>
						<div class="font-mono text-[10px] text-text-secondary">{selected.hostname}</div>
					</div>
				{/if}
			</div>
		</div>
	{:else if data && data.devices.length > 0}
		<div class="flex flex-wrap gap-x-3 gap-y-1">
			{#each [...new Set(data.devices.map(d => d.vendor).filter(Boolean))] as vendor}
				{@const color = vendorColors[vendor ?? ''] ?? 'rgb(0,229,255)'}
				<div class="flex items-center gap-1.5">
					<span class="h-1.5 w-1.5 rounded-full" style="background: {color}"></span>
					<span class="font-mono text-[8px] text-text-dim/40">{vendor}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if data}
		<div class="font-mono text-[9px] text-text-dim/25 tracking-wide">
			scanned {new Date(data.scanned_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
		</div>
	{/if}
</div>
