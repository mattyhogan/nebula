<script lang="ts">
	let { active = false }: { active?: boolean } = $props();

	type Status = 'idle' | 'connecting' | 'connected' | 'disconnected';

	let status: Status = $state('idle');
	let termContainer: HTMLElement | undefined = $state();
	let terminal: import('xterm').Terminal | null = null;
	let ws: WebSocket | null = null;
	let fitAddon: import('@xterm/addon-fit').FitAddon | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectDelay = 1000;
	let reconnectAttempts = 0;
	let initialized = false;

	function getWsUrl(): string {
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		return `${proto}://${location.host}/terminal`;
	}

	function sendRaw(data: string) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(data);
		}
	}

	function connect(term: import('xterm').Terminal) {
		if (ws) {
			try { ws.close(); } catch {}
		}

		status = 'connecting';
		const socket = new WebSocket(getWsUrl());
		socket.binaryType = 'arraybuffer';

		socket.onopen = () => {
			status = 'connected';
			reconnectDelay = 1000;
			reconnectAttempts = 0;
			(window as any).__terminalSend = sendRaw;
		};

		socket.onmessage = (e) => {
			const data = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : e.data;
			term.write(data);
		};

		socket.onclose = () => {
			status = 'disconnected';
			(window as any).__terminalSend = null;
			if (active && reconnectAttempts < 3) {
				scheduleReconnect(term);
			}
		};

		socket.onerror = () => {};

		ws = socket;
	}

	function scheduleReconnect(term: import('xterm').Terminal) {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		reconnectAttempts++;
		reconnectTimer = setTimeout(() => {
			reconnectDelay = Math.min(reconnectDelay * 2, 10000);
			connect(term);
		}, reconnectDelay);
	}

	function manualReconnect() {
		reconnectAttempts = 0;
		reconnectDelay = 1000;
		if (terminal) connect(terminal);
	}

	async function initTerminal() {
		if (initialized || !termContainer) return;
		initialized = true;

		const { Terminal } = await import('xterm');
		const { FitAddon } = await import('@xterm/addon-fit');
		await import('xterm/css/xterm.css');

		const term = new Terminal({
			cursorBlink: true,
			fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
			fontSize: 13,
			lineHeight: 1.2,
			disableStdin: true,
			theme: {
				background: '#0a0e14',
				foreground: '#b0bec5',
				cursor: '#00e5ff',
				cursorAccent: '#0a0e14',
				selectionBackground: 'rgba(0, 229, 255, 0.15)',
				black: '#0a0e14',
				red: '#ff5252',
				green: '#00e676',
				yellow: '#ffd740',
				blue: '#4da8ff',
				magenta: '#b388ff',
				cyan: '#00e5ff',
				white: '#b0bec5',
				brightBlack: '#546e7a',
				brightRed: '#ff8a80',
				brightGreen: '#69f0ae',
				brightYellow: '#ffe57f',
				brightBlue: '#82b1ff',
				brightMagenta: '#ea80fc',
				brightCyan: '#84ffff',
				brightWhite: '#eceff1',
			},
			allowTransparency: true,
			scrollback: 5000,
		});

		const fit = new FitAddon();
		term.loadAddon(fit);
		term.open(termContainer);

		requestAnimationFrame(() => fit.fit());

		terminal = term;
		fitAddon = fit;

		connect(term);

		const resizeObserver = new ResizeObserver(() => {
			requestAnimationFrame(() => {
				try { fit.fit(); } catch {}
			});
		});
		resizeObserver.observe(termContainer);
	}

	function cleanup() {
		if (reconnectTimer) clearTimeout(reconnectTimer);
		reconnectTimer = null;
		(window as any).__terminalSend = null;
		try { ws?.close(); } catch {}
		ws = null;
		try { terminal?.dispose(); } catch {}
		terminal = null;
		fitAddon = null;
		initialized = false;
		status = 'idle';
	}

	$effect(() => {
		if (termContainer && !initialized) {
			initTerminal();
		}

		return () => cleanup();
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="flex h-full flex-col gap-2" role="application" tabindex="-1" onmousedown={(e) => { if ((e.target as HTMLElement)?.closest('.xterm')) e.preventDefault(); }}>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<span class="h-1.5 w-1.5 rounded-full {status === 'connected' ? 'bg-hud-green' : status === 'connecting' ? 'bg-hud-yellow' : 'bg-hud-red/60'}"
				style={status === 'connecting' ? 'animation: hud-pulse 1s ease-in-out infinite' : status === 'connected' ? 'box-shadow: 0 0 6px rgba(0, 230, 118, 0.4)' : ''}
			></span>
			<span class="font-mono text-[9px] uppercase tracking-wider {status === 'connected' ? 'text-hud-green/60' : status === 'connecting' ? 'text-hud-yellow/60' : 'text-hud-red/50'}">
				{status}
			</span>
		</div>
		{#if status === 'disconnected'}
			<button
				onclick={manualReconnect}
				class="rounded border border-hud-cyan/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-hud-cyan transition-colors hover:border-hud-cyan/60"
			>
				reconnect
			</button>
		{/if}
	</div>
	<div
		bind:this={termContainer}
		class="min-h-0 flex-1 overflow-hidden rounded"
		style="background: #0a0e14"
	></div>
</div>
