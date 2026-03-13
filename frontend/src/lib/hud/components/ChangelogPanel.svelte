<script lang="ts">
	import { getChangelog, getChangelogRepos, getChangelogPrefs, saveChangelogPrefs, type ChangelogCommit, type GHRepo } from '$lib/api';

	let commits: ChangelogCommit[] = $state([]);
	let repos: GHRepo[] = $state([]);
	let selectedRepos: Set<string> = $state(new Set());
	let search = $state('');
	let showPicker = $state(false);
	let loaded = $state(false);
	let loadingCommits = $state(false);

	function toggleRepo(fullName: string) {
		const next = new Set(selectedRepos);
		if (next.has(fullName)) next.delete(fullName);
		else next.add(fullName);
		selectedRepos = next;
		saveChangelogPrefs([...selectedRepos]);
		fetchCommits();
	}

	let filteredRepos = $derived(
		repos.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
	);

	async function fetchCommits() {
		if (selectedRepos.size === 0) { commits = []; return; }
		loadingCommits = true;
		commits = await getChangelog([...selectedRepos]);
		loadingCommits = false;
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		const days = Math.floor(hrs / 24);
		if (days < 30) return `${days}d ago`;
		return `${Math.floor(days / 30)}mo ago`;
	}

	function dateLabel(dateStr: string): string {
		const d = new Date(dateStr);
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const commitDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
		const diffDays = Math.floor((today.getTime() - commitDay.getTime()) / 86400000);
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	const REPO_COLORS = ['text-hud-cyan', 'text-hud-yellow', 'text-hud-purple', 'text-hud-green', 'text-hud-red', 'text-orange', 'text-hud-blue', 'text-magenta'];
	let repoColorMap: Map<string, string> = $derived.by(() => {
		const m = new Map<string, string>();
		let i = 0;
		for (const repo of selectedRepos) {
			const name = repo.split('/')[1] || repo;
			m.set(name, REPO_COLORS[i % REPO_COLORS.length]);
			i++;
		}
		return m;
	});

	function repoColor(repo: string): string {
		return repoColorMap.get(repo) ?? 'text-hud-blue';
	}

	function prStateColor(state?: string): string {
		if (state === 'merged') return 'text-hud-purple';
		if (state === 'open') return 'text-hud-green';
		return 'text-text-dim/50';
	}

	function prStateLabel(state?: string): string {
		if (state === 'merged') return 'merged';
		if (state === 'open') return 'open';
		return 'closed';
	}

	interface GroupedCommits {
		label: string;
		commits: ChangelogCommit[];
	}

	let grouped: GroupedCommits[] = $derived.by(() => {
		const groups: Map<string, ChangelogCommit[]> = new Map();
		for (const c of commits) {
			const label = dateLabel(c.date);
			if (!groups.has(label)) groups.set(label, []);
			groups.get(label)!.push(c);
		}
		return Array.from(groups.entries()).map(([label, commits]) => ({ label, commits }));
	});

	$effect(() => {
		Promise.all([
			getChangelogPrefs(),
			getChangelogRepos(),
		]).then(([saved, r]) => {
			repos = r;
			if (saved.length > 0) selectedRepos = new Set(saved);
			loaded = true;
			if (selectedRepos.size > 0) fetchCommits();
		}).catch(() => { loaded = true; });
	});
</script>

<div class="flex h-full flex-col">
	<div class="mb-2 flex items-center justify-between">
		<div class="flex items-center gap-1.5">
			{#each [...selectedRepos] as repo}
				{@const name = repo.split('/')[1] || repo}
				<span class="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider {repoColor(name)}">{name}</span>
			{/each}
		</div>
		<button
			onclick={() => { showPicker = !showPicker; search = ''; }}
			class="rounded border border-panel-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-dim/60 transition-colors hover:border-hud-cyan/40 hover:text-hud-cyan"
		>
			{showPicker ? 'done' : 'repos'}
		</button>
	</div>

	{#if showPicker}
		<div class="flex flex-col gap-2 overflow-hidden">
			<input
				type="text"
				bind:value={search}
				placeholder="search repos..."
				class="w-full rounded border border-panel-border bg-white/[0.02] px-2.5 py-1.5 font-mono text-xs text-text placeholder:text-text-dim/30 outline-none focus:border-hud-cyan/40"
			/>
			<div class="flex-1 space-y-0.5 overflow-y-auto pr-1" style="max-height: 400px; scrollbar-width: thin; scrollbar-color: rgba(77,168,255,0.15) transparent">
				{#each filteredRepos as repo}
					{@const selected = selectedRepos.has(repo.full_name)}
					<button
						onclick={() => toggleRepo(repo.full_name)}
						class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors {selected ? 'bg-hud-cyan/[0.08]' : 'hover:bg-white/[0.03]'}"
					>
						<span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border {selected ? 'border-hud-cyan bg-hud-cyan/20' : 'border-panel-border'}">
							{#if selected}
								<svg class="h-2.5 w-2.5 text-hud-cyan" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
							{/if}
						</span>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-1.5">
								<span class="font-mono text-xs text-text/90">{repo.name}</span>
								{#if repo.private}
									<span class="rounded bg-white/[0.05] px-1 py-px font-mono text-[7px] uppercase tracking-wider text-text-dim/40">private</span>
								{/if}
							</div>
							{#if repo.description}
								<div class="truncate font-mono text-[9px] text-text-dim/40">{repo.description}</div>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto pr-1" style="scrollbar-width: thin; scrollbar-color: rgba(77,168,255,0.15) transparent">
			{#if !loaded || loadingCommits}
				<div class="flex h-full items-center justify-center">
					<span class="font-mono text-[10px] text-text-dim" style="animation: hud-pulse 1s ease-in-out infinite">loading...</span>
				</div>
			{:else if selectedRepos.size === 0}
				<div class="flex h-full flex-col items-center justify-center gap-2">
					<span class="font-mono text-[10px] text-text-dim/50">no repos selected</span>
					<button
						onclick={() => { showPicker = true; }}
						class="rounded border border-hud-cyan/30 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-hud-cyan transition-colors hover:border-hud-cyan/60"
					>
						select repos
					</button>
				</div>
			{:else if commits.length === 0}
				<div class="flex h-full items-center justify-center">
					<span class="font-mono text-[10px] text-text-dim">no activity</span>
				</div>
			{:else}
				<div class="space-y-3">
					{#each grouped as group, gi}
						<div style="animation: hud-fade-in 0.2s ease-out {gi * 0.05}s both">
							<div class="sticky top-0 z-10 mb-1.5 flex items-center gap-2 bg-panel/80 py-1 backdrop-blur-sm">
								<div class="h-px flex-1 bg-gradient-to-r from-hud-cyan/20 to-transparent"></div>
								<span class="font-mono text-[9px] font-medium uppercase tracking-widest text-hud-cyan/60">{group.label}</span>
								<div class="h-px flex-1 bg-gradient-to-l from-hud-cyan/20 to-transparent"></div>
							</div>
							<div class="space-y-0.5">
								{#each group.commits as commit, ci}
									<a
										href={commit.url}
										target="_blank"
										rel="noopener"
										class="group flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
										style="animation: hud-fade-in 0.15s ease-out {(gi * 0.05) + (ci * 0.02)}s both; text-decoration: none"
									>
										<div class="mt-0.5 flex shrink-0 flex-col items-end gap-0.5">
											{#if commit.type === 'pr'}
												<span class="font-mono text-[10px] font-medium {prStateColor(commit.prState)} group-hover:brightness-125 transition-colors">{commit.hash}</span>
											{:else}
												<span class="font-mono text-[10px] font-medium text-hud-cyan/80 group-hover:text-hud-cyan transition-colors">{commit.hash}</span>
											{/if}
											<span class="font-mono text-[8px] font-medium uppercase tracking-wider {repoColor(commit.repo)}">{commit.repo}</span>
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-1.5">
												{#if commit.type === 'pr'}
													<span class="shrink-0 rounded px-1 py-px font-mono text-[7px] uppercase tracking-wider {commit.prState === 'merged' ? 'bg-hud-purple/15 text-hud-purple' : commit.prState === 'open' ? 'bg-hud-green/15 text-hud-green' : 'bg-white/5 text-text-dim/50'}">{prStateLabel(commit.prState)}</span>
												{/if}
												<div class="truncate font-mono text-xs leading-snug text-text/90 group-hover:text-hud-cyan transition-colors">{commit.message}</div>
											</div>
											<div class="mt-0.5 flex items-center gap-2">
												<span class="font-mono text-[9px] text-text-dim/50">{commit.author}</span>
												<span class="font-mono text-[9px] text-text-dim/30">{timeAgo(commit.date)}</span>
											</div>
										</div>
										<svg class="mt-1 h-3 w-3 shrink-0 text-text-dim/20 group-hover:text-hud-cyan/50 transition-colors" viewBox="0 0 16 16" fill="currentColor">
											<path d="M3.75 2h3.5a.75.75 0 010 1.5h-2.19l5.72 5.72a.75.75 0 11-1.06 1.06L4 4.56v2.19a.75.75 0 01-1.5 0v-3.5A1.25 1.25 0 013.75 2z"/>
											<path d="M3.5 7.75a.75.75 0 00-1.5 0v4.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 12.25v-4.5a.75.75 0 00-1.5 0v4.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-4.5z"/>
										</svg>
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
