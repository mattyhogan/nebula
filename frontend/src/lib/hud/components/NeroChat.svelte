<script lang="ts">
	import { neroChat, getNeroHistory, type NeroActivity } from '$lib/api';

	type FeedItem =
		| { kind: 'message'; role: 'user' | 'nero'; text: string; time: string; medium?: string }
		| { kind: 'activity'; activity: NeroActivity };

	let feed: FeedItem[] = $state([]);
	let input = $state('');
	let streaming = $state(false);
	let loaded = $state(false);
	let chatContainer: HTMLElement | undefined = $state();

	function scrollBottom() {
		requestAnimationFrame(() => {
			if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
		});
	}

	function formatTime(dateStr: string): string {
		try {
			const d = new Date(dateStr);
			return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch { return ''; }
	}

	$effect(() => {
		getNeroHistory().then((msgs) => {
			feed = msgs.map((m) => ({
				kind: 'message' as const,
				role: m.role === 'user' ? 'user' as const : 'nero' as const,
				text: m.content,
				time: formatTime(m.created_at),
				medium: m.medium
			}));
			loaded = true;
			scrollBottom();
		}).catch(() => { loaded = true; });
	});

	async function send() {
		const text = input.trim();
		if (!text || streaming) return;

		input = '';
		streaming = true;

		feed.push({
			kind: 'message',
			role: 'user',
			text,
			time: formatTime(new Date().toISOString())
		});
		feed.push({
			kind: 'message',
			role: 'nero',
			text: '',
			time: ''
		});
		scrollBottom();

		const lastMsgIdx = feed.length - 1;

		await neroChat(text, {
			onChunk(chunk) {
				const item = feed[lastMsgIdx];
				if (item.kind === 'message') {
					item.text += chunk;
					scrollBottom();
				}
			},
			onActivity(activity) {
				feed.splice(lastMsgIdx, 0, { kind: 'activity', activity });
				scrollBottom();
			},
			onDone(content) {
				const item = feed[feed.length - 1];
				if (item.kind === 'message' && item.role === 'nero') {
					item.time = formatTime(new Date().toISOString());
					if (!item.text && content) item.text = content;
				}
				streaming = false;
			},
			onError(err) {
				const item = feed[feed.length - 1];
				if (item.kind === 'message' && item.role === 'nero') {
					item.text = `[error: ${err}]`;
				}
				streaming = false;
			}
		});

		if (streaming) streaming = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			send();
		}
	}

	function toolStatusColor(status: NeroActivity['status']): string {
		if (status === 'complete') return 'text-hud-green';
		if (status === 'running') return 'text-hud-cyan';
		if (status === 'error' || status === 'denied') return 'text-hud-red';
		if (status === 'pending') return 'text-hud-yellow';
		return 'text-text-dim';
	}

	function toolStatusIcon(status: NeroActivity['status']): string {
		if (status === 'complete') return '\u2713';
		if (status === 'running') return '\u25CB';
		if (status === 'error') return '\u2717';
		if (status === 'denied') return '\u2715';
		if (status === 'pending') return '\u2022';
		return '\u2013';
	}

	function truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n) + '...' : s;
	}
</script>

<div class="flex h-full flex-col gap-2">
	<div
		bind:this={chatContainer}
		class="flex-1 space-y-2.5 overflow-y-auto pr-1"
		style="scrollbar-width: thin; scrollbar-color: rgba(77,168,255,0.15) transparent"
	>
		{#if !loaded}
			<div class="flex h-full items-center justify-center">
				<span class="font-mono text-[10px] text-text-dim" style="animation: hud-pulse 1s ease-in-out infinite">loading history...</span>
			</div>
		{:else if feed.length === 0}
			<div class="flex h-full items-center justify-center">
				<span class="font-mono text-[10px] text-text-dim">talk to nero</span>
			</div>
		{/if}

		{#each feed as item}
			{#if item.kind === 'message'}
				<div class="flex flex-col gap-0.5">
					<div class="flex items-baseline gap-2">
						<span class="font-mono text-[10px] uppercase tracking-wider {item.role === 'user' ? 'text-hud-cyan/60' : 'text-hud-green/60'}">
							{item.role === 'user' ? 'you' : 'nero'}
						</span>
						{#if item.time}
							<span class="font-mono text-[8px] text-text-dim/40">{item.time}</span>
						{/if}
						{#if item.medium && item.medium !== 'api'}
							<span class="font-mono text-[8px] text-text-dim/30">via {item.medium}</span>
						{/if}
					</div>
					<div class="font-mono text-sm leading-relaxed whitespace-pre-wrap {item.role === 'user' ? 'text-text-secondary' : 'text-text'}">
						{item.text}{#if streaming && item.role === 'nero' && item === feed[feed.length - 1]}<span class="inline-block w-1.5 h-3 bg-hud-cyan/60 ml-0.5" style="animation: hud-pulse 0.8s ease-in-out infinite"></span>{/if}
					</div>
				</div>
			{:else if item.kind === 'activity'}
				<div class="flex items-start gap-1.5 rounded border-l-2 border-hud-purple/30 bg-hud-purple/5 px-2 py-1">
					<span class="font-mono text-[10px] {toolStatusColor(item.activity.status)}">{toolStatusIcon(item.activity.status)}</span>
					<div class="flex-1 min-w-0">
						<div class="flex items-baseline gap-1.5">
							<span class="font-mono text-[10px] font-medium text-hud-purple">{item.activity.displayName || item.activity.tool}</span>
							<span class="font-mono text-[8px] {toolStatusColor(item.activity.status)}">{item.activity.status}</span>
						</div>
						{#if Object.keys(item.activity.args).length > 0}
							<div class="font-mono text-[9px] text-text-dim/50 truncate">
								{truncate(JSON.stringify(item.activity.args), 80)}
							</div>
						{/if}
						{#if item.activity.result}
							<div class="mt-0.5 font-mono text-[9px] text-text-dim/60 truncate">
								{truncate(item.activity.result, 120)}
							</div>
						{/if}
						{#if item.activity.error}
							<div class="mt-0.5 font-mono text-[9px] text-hud-red/70 truncate">
								{item.activity.error}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="flex gap-2 border-t border-panel-border pt-2">
		<input
			type="text"
			bind:value={input}
			onkeydown={onKeydown}
			placeholder="message nero..."
			disabled={streaming}
			class="flex-1 rounded border border-panel-border bg-black/30 px-2.5 py-1.5 font-mono text-sm text-text placeholder:text-text-dim/40 focus:border-hud-cyan/40 focus:outline-none disabled:opacity-40"
		/>
		<button
			onclick={send}
			disabled={streaming || !input.trim()}
			class="rounded border border-hud-cyan/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-hud-cyan transition-colors hover:border-hud-cyan/60 disabled:opacity-30"
		>
			send
		</button>
	</div>
</div>
