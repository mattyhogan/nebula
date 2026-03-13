<script lang="ts">
	interface CalEvent {
		title: string;
		start: string;
		end: string;
		allDay: boolean;
		color: string | null;
		location: string | null;
	}

	interface ParsedEvent {
		title: string;
		startTime: string;
		endTime: string;
		allDay: boolean;
		color: string;
		location: string | null;
	}

	const GCAL_COLORS: Record<string, string> = {
		'1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
		'5': '#f6bf26', '6': '#f4511e', '7': '#039be5', '8': '#616161',
		'9': '#3f51b5', '10': '#0b8043', '11': '#d50000',
	};

	let events: ParsedEvent[] = $state([]);
	let loading = $state(true);
	let today = $state(new Date());

	const hours = Array.from({ length: 14 }, (_, i) => i + 7);

	function parseTime(isoOrDate: string): string {
		const d = new Date(isoOrDate);
		const h = d.getHours().toString().padStart(2, '0');
		const m = d.getMinutes().toString().padStart(2, '0');
		return `${h}:${m}`;
	}

	async function fetchEvents() {
		loading = true;
		try {
			const res = await fetch('/gcal/today');
			const raw: CalEvent[] = await res.json();
			events = raw.map((e) => ({
				title: e.title,
				startTime: e.allDay ? '07:00' : parseTime(e.start),
				endTime: e.allDay ? '21:00' : parseTime(e.end),
				allDay: e.allDay,
				color: e.color ? (GCAL_COLORS[e.color] || '#4da8ff') : '#4da8ff',
				location: e.location,
			}));
		} catch {
			events = [];
		}
		loading = false;
	}

	$effect(() => {
		fetchEvents();
		const id = setInterval(() => { today = new Date(); }, 60000);
		const refresh = setInterval(fetchEvents, 300000);
		return () => { clearInterval(id); clearInterval(refresh); };
	});

	function timeToY(time: string): number {
		const [h, m] = time.split(':').map(Number);
		return ((h - 7) + m / 60) / 14 * 100;
	}

	function eventHeight(start: string, end: string): number {
		return timeToY(end) - timeToY(start);
	}

	function formatHour(h: number): string {
		if (h === 0 || h === 12) return '12';
		return String(h > 12 ? h - 12 : h);
	}

	function amPm(h: number): string {
		return h >= 12 ? 'p' : 'a';
	}

	let nowY = $derived((() => {
		const h = today.getHours();
		const m = today.getMinutes();
		if (h < 7 || h > 20) return -1;
		return ((h - 7) + m / 60) / 14 * 100;
	})());

	let dayName = $derived(today.toLocaleDateString('en-US', { weekday: 'long' }));
	let dateStr = $derived(today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
</script>

<div class="flex h-full flex-col gap-2">
	<div class="flex items-baseline justify-between">
		<span class="font-mono text-xs text-text">{dayName}</span>
		<span class="font-mono text-[10px] text-text-dim">{dateStr}</span>
	</div>

	{#if events.some((e) => e.allDay)}
		<div class="space-y-1">
			{#each events.filter((e) => e.allDay) as ev}
				<div class="flex items-center gap-1.5 rounded px-1.5 py-0.5" style="background: {ev.color}20; border-left: 2px solid {ev.color}">
					<span class="font-mono text-[10px] text-text truncate">{ev.title}</span>
					<span class="ml-auto shrink-0 font-mono text-[8px] text-text-dim">all day</span>
				</div>
			{/each}
		</div>
	{/if}

	<div class="relative flex-1 overflow-y-auto" style="scrollbar-width: thin; scrollbar-color: rgba(77,168,255,0.2) transparent">
		<div class="relative" style="min-height: 400px">
			{#each hours as h}
				<div
					class="absolute left-0 right-0 flex items-start border-t border-panel-border/30"
					style="top: {((h - 7) / 14) * 100}%; height: {100 / 14}%"
				>
					<span class="w-8 shrink-0 pr-1 text-right font-mono text-[9px] text-text-dim/50 -translate-y-1.5">
						{formatHour(h)}{amPm(h)}
					</span>
				</div>
			{/each}

			{#if nowY >= 0}
				<div class="absolute left-7 right-0 z-10 flex items-center" style="top: {nowY}%">
					<span class="h-1.5 w-1.5 rounded-full bg-hud-cyan"></span>
					<div class="h-px flex-1 bg-hud-cyan/60"></div>
				</div>
			{/if}

			{#each events.filter((e) => !e.allDay) as ev}
				<div
					class="absolute left-9 right-1 rounded border-l-2 px-1.5 py-0.5"
					style="top: {timeToY(ev.startTime)}%; height: {Math.max(eventHeight(ev.startTime, ev.endTime), 3)}%; border-color: {ev.color}; background: {ev.color}15"
				>
					<div class="font-mono text-[10px] text-text leading-tight truncate">{ev.title}</div>
					<div class="font-mono text-[8px] text-text-dim">{ev.startTime} - {ev.endTime}</div>
				</div>
			{/each}

			{#if events.length === 0 && !loading}
				<div class="absolute inset-0 flex items-center justify-center">
					<span class="font-mono text-[10px] text-text-dim">no events today</span>
				</div>
			{/if}
		</div>
	</div>
</div>
